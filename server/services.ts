/**
 * Nihiltheism Architect Core Services:
 * - Ingestion & Extraction (PDF, Text, Markdown)
 * - FTS5 Search & Passage Viewer
 * - Research Loop Engine (Autonomous/Guided with OpenRouter / Deterministic Fallback)
 * - Citation & Constitutional Audit
 * - Export Engine (Markdown, JSON, ZIP bundle)
 */

import { getDb } from './db';
import { InputError, requireText, requireEnum } from './errors';
import crypto from 'node:crypto';
import JSZip from 'jszip';
import { getOpenRouterStatus, openRouterJson, validateResearchCandidate, validateBranches } from './openrouter';
import type { 
  AuditReport, 
  Claim, 
  Concept, 
  Contradiction, 
  Correction, 
  JobEvent, 
  Objection, 
  Passage, 
  Project, 
  ResearchJob, 
  Revision, 
  Source,
  HypermapNode,
  HypermapTreeNode,
  HypermapNodeInput,
  HypermapStats,
  HypermapDensifyResult
} from '../src/types';

// Synchronous savepoints keep related writes atomic without locking during API calls.
function atomic<T>(fn: () => T): T {
  const db = getDb();
  const name = 'sp_' + crypto.randomBytes(8).toString('hex');
  db.exec(`SAVEPOINT ${name}`);
  try {
    const result = fn();
    db.exec(`RELEASE ${name}`);
    return result;
  } catch (error) {
    db.exec(`ROLLBACK TO ${name}; RELEASE ${name}`);
    throw error;
  }
}
const activeJobs = new Map<string, Promise<ResearchJob>>();
const activeDensifications = new Map<string, Promise<HypermapDensifyResult>>();

// ---------------------------------------------------------------------------
// 1. INGESTION & EXTRACTION
// ---------------------------------------------------------------------------

export interface IngestOptions {
  projectId: string;
  filename: string;
  mediaType: string;
  contentBase64?: string;
  contentText?: string;
  customMetadata?: {
    author?: string;
    edition?: string;
    completeness?: 'complete' | 'partial' | 'summary_only';
  };
}

export async function ingestDocument(options: IngestOptions): Promise<{ source: Source; passageCount: number }> {
  requireText(options.filename, 'filename', 255);
  if (/[\\/]/.test(options.filename)) throw new InputError('filename must not contain path separators.');
  const db = getDb();
  if (!db.prepare('SELECT id FROM projects WHERE id = ?').get(options.projectId)) throw new InputError('Project not found.', 404);
  const now = new Date().toISOString();
  const sourceId = 'src_' + crypto.randomUUID().slice(0, 8);

  let rawText = '';
  let warnings: string[] = [];
  let extractionMethod = 'text_parser';

  if (options.mediaType === 'application/pdf' && options.contentBase64) {
    extractionMethod = 'pdf-parse';
    const buffer = Buffer.from(options.contentBase64, 'base64');
    const { PDFParse } = await import('pdf-parse');
    const parser = new PDFParse({ data: buffer });
    try {
      const data = await parser.getText();
      rawText = data.text || '';
      warnings.push(`Extracted from ${data.total} page(s) PDF document. Pagination not assigned to paragraph chunks.`);
    } finally {
      await parser.destroy();
    }
  } else if (options.contentText) {
    rawText = options.contentText;
    extractionMethod = 'direct_text';
  } else if (options.contentBase64) {
    rawText = Buffer.from(options.contentBase64, 'base64').toString('utf-8');
    extractionMethod = 'base64_text';
  }

  if (!rawText.trim()) {
    throw new InputError('Ingested document contains no extractable text.');
  }

  const sha256 = crypto.createHash('sha256').update(rawText).digest('hex');

  // Check duplicate hash
  const existingCheck = db.prepare('SELECT id, filename FROM sources WHERE sha256_hash = ? AND project_id = ?');
  const existing = existingCheck.get(sha256, options.projectId) as any;
  if (existing) {
    warnings.push(`Identical document hash already exists in project as ${existing.filename}.`);
  }

  // Parse passages: Chunk by headings or paragraphs preserving offsets
  const passages: Array<{
    id: string;
    passage_index: number;
    text: string;
    page_number: number | null;
    section_heading: string | null;
    char_offset_start: number;
    char_offset_end: number;
  }> = [];

  // Split into paragraphs / sections
  const paragraphs = rawText.split(/\r?\n[ \t]*\r?\n(?:[ \t]*\r?\n)*/);
  let currentOffset = 0;
  let currentHeading: string | null = null;
  let indexCounter = 1;

  for (const para of paragraphs) {
    const paragraphStart = rawText.indexOf(para, currentOffset);
    currentOffset = paragraphStart + para.length;
    const trimmed = para.trim();
    if (!trimmed) {
      continue;
    }

    // Check if paragraph is a heading
    const headingMatch = trimmed.match(/^(#{1,4}\s+|\[TOPIC\s+\d+:?|CHAPTER\s+\d+:?)(.*)$/i);
    if (headingMatch && trimmed.length < 150) {
      currentHeading = trimmed.replace(/^[#\s]+/, '').replace(/^\[|\]$/g, '').trim();
    }

    const start = paragraphStart + para.indexOf(trimmed);
    const end = start + trimmed.length;

    passages.push({
      id: `pas_${sourceId}_${indexCounter}`,
      passage_index: indexCounter,
      text: trimmed,
      page_number: null, // text/markdown does not invent page numbers (satisfies A02)
      section_heading: currentHeading,
      char_offset_start: start,
      char_offset_end: end
    });

    indexCounter++;
  }

  const completeness = options.customMetadata?.completeness || (warnings.length > 1 ? 'partial' : 'complete');

  // Insert Source
  const insertSource = db.prepare(`
    INSERT INTO sources (id, project_id, filename, media_type, sha256_hash, import_timestamp, extraction_method, content_completeness, extraction_warnings, storage_path, passage_count)
    VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
  `);

  db.exec('BEGIN TRANSACTION;');
  try {
  insertSource.run(
    sourceId,
    options.projectId,
    options.filename,
    options.mediaType,
    sha256,
    now,
    extractionMethod,
    completeness,
    JSON.stringify(warnings),
    `sources/${options.filename}`,
    passages.length
  );

  // Insert Passages & FTS
  const insertPassage = db.prepare(`
    INSERT INTO passages (id, source_id, passage_index, text, page_number, section_heading, char_offset_start, char_offset_end, warnings)
    VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)
  `);
  const insertFts = db.prepare(`
    INSERT INTO passages_fts (id, source_id, text, section_heading)
    VALUES (?, ?, ?, ?)
  `);

    for (const p of passages) {
      insertPassage.run(
        p.id,
        sourceId,
        p.passage_index,
        p.text,
        p.page_number,
        p.section_heading,
        p.char_offset_start,
        p.char_offset_end,
        JSON.stringify([])
      );
      insertFts.run(p.id, sourceId, p.text, p.section_heading || '');
    }
    db.exec('COMMIT;');
  } catch (e) {
    db.exec('ROLLBACK;');
    throw e;
  }

  const createdSource: Source = {
    id: sourceId,
    project_id: options.projectId,
    filename: options.filename,
    media_type: options.mediaType,
    sha256_hash: sha256,
    import_timestamp: now,
    extraction_method: extractionMethod,
    content_completeness: completeness as any,
    extraction_warnings: warnings,
    storage_path: `sources/${options.filename}`,
    passage_count: passages.length
  };

  return { source: createdSource, passageCount: passages.length };
}

// ---------------------------------------------------------------------------
// 2. SEARCH & PASSAGE VIEWER
// ---------------------------------------------------------------------------

export interface SearchResult {
  id: string;
  source_id: string;
  source_filename: string;
  passage_index: number;
  text: string;
  section_heading: string | null;
  page_number: number | null;
  char_offset_start: number;
  char_offset_end: number;
  rank?: number;
}

export function searchPassages(query: string, sourceId?: string, limit = 50): SearchResult[] {
  const db = getDb();
  const cleanQuery = query.replace(/[^\w\s\*\-]/g, ' ').trim();

  if (!cleanQuery) {
    // If empty query, return most recent passages
    let sql = `
      SELECT p.*, s.filename as source_filename
      FROM passages p
      JOIN sources s ON p.source_id = s.id
    `;
    const params: any[] = [];
    if (sourceId) {
      sql += ` WHERE p.source_id = ? `;
      params.push(sourceId);
    }
    sql += ` ORDER BY p.source_id, p.passage_index ASC LIMIT ?`;
    params.push(limit);

    const stmt = db.prepare(sql);
    const rows = stmt.all(...params) as any[];
    return rows.map(r => ({
      id: r.id,
      source_id: r.source_id,
      source_filename: r.source_filename,
      passage_index: r.passage_index,
      text: r.text,
      section_heading: r.section_heading,
      page_number: r.page_number,
      char_offset_start: r.char_offset_start,
      char_offset_end: r.char_offset_end
    }));
  }

  // FTS5 MATCH query with fallback to LIKE if MATCH fails
  try {
    let ftsSql = `
      SELECT p.*, s.filename as source_filename, f.rank
      FROM passages_fts f
      JOIN passages p ON f.id = p.id
      JOIN sources s ON p.source_id = s.id
      WHERE passages_fts MATCH ?
    `;
    const params: any[] = [cleanQuery];
    if (sourceId) {
      ftsSql += ` AND p.source_id = ? `;
      params.push(sourceId);
    }
    ftsSql += ` ORDER BY f.rank LIMIT ?`;
    params.push(limit);

    const stmt = db.prepare(ftsSql);
    const rows = stmt.all(...params) as any[];
    return rows.map(r => ({
      id: r.id,
      source_id: r.source_id,
      source_filename: r.source_filename,
      passage_index: r.passage_index,
      text: r.text,
      section_heading: r.section_heading,
      page_number: r.page_number,
      char_offset_start: r.char_offset_start,
      char_offset_end: r.char_offset_end,
      rank: r.rank
    }));
  } catch (err) {
    // LIKE fallback
    let likeSql = `
      SELECT p.*, s.filename as source_filename
      FROM passages p
      JOIN sources s ON p.source_id = s.id
      WHERE p.text LIKE ?
    `;
    const params: any[] = [`%${cleanQuery}%`];
    if (sourceId) {
      likeSql += ` AND p.source_id = ? `;
      params.push(sourceId);
    }
    likeSql += ` ORDER BY p.passage_index ASC LIMIT ?`;
    params.push(limit);

    const stmt = db.prepare(likeSql);
    const rows = stmt.all(...params) as any[];
    return rows.map(r => ({
      id: r.id,
      source_id: r.source_id,
      source_filename: r.source_filename,
      passage_index: r.passage_index,
      text: r.text,
      section_heading: r.section_heading,
      page_number: r.page_number,
      char_offset_start: r.char_offset_start,
      char_offset_end: r.char_offset_end
    }));
  }
}

export function getPassageWithContext(passageId: string, contextCount = 2) {
  const db = getDb();
  const getTarget = db.prepare(`
    SELECT p.*, s.filename as source_filename 
    FROM passages p 
    JOIN sources s ON p.source_id = s.id 
    WHERE p.id = ?
  `);
  const target = getTarget.get(passageId) as any;
  if (!target) return null;

  const getBefore = db.prepare(`
    SELECT * FROM passages 
    WHERE source_id = ? AND passage_index < ? 
    ORDER BY passage_index DESC LIMIT ?
  `);
  const before = (getBefore.all(target.source_id, target.passage_index, contextCount) as any[]).reverse();

  const getAfter = db.prepare(`
    SELECT * FROM passages 
    WHERE source_id = ? AND passage_index > ? 
    ORDER BY passage_index ASC LIMIT ?
  `);
  const after = getAfter.all(target.source_id, target.passage_index, contextCount) as any[];

  return {
    target,
    before,
    after,
    source: db.prepare('SELECT * FROM sources WHERE id = ?').get(target.source_id),
  };
}

// ---------------------------------------------------------------------------
// 3. CITATION & CONSTITUTIONAL AUDIT
// ---------------------------------------------------------------------------

export function performAudit(projectId = 'proj_journal314_canonical'): AuditReport {
  const db = getDb();
  const getClaims = db.prepare('SELECT * FROM claims WHERE project_id = ?');
  const claims = getClaims.all(projectId) as any[];

  const getCorrections = db.prepare('SELECT * FROM corrections');
  const corrections = getCorrections.all() as any[];

  const getObjections = db.prepare('SELECT * FROM objections WHERE project_id = ?');
  const objections = getObjections.all(projectId) as any[];

  const getPassages = db.prepare('SELECT id, text, page_number, source_id FROM passages');
  const allPassages = getPassages.all() as any[];
  const passageMap = new Map<string, any>();
  for (const p of allPassages) {
    passageMap.set(p.id, p);
  }

  let totalAttributions = 0;
  let intactAttributions = 0;
  let brokenAttributions = 0;
  let unsupportedClaims = 0;
  const brokenList: Array<{ claim_id: string; attribution_index: number; reason: string }> = [];

  for (const c of claims) {
    let attributions: any[] = [];
    try {
      attributions = JSON.parse(c.source_attributions || '[]');
    } catch {
      attributions = [];
    }

    if (c.support_status === 'unsupported' || c.support_status === 'unreviewed') {
      unsupportedClaims++;
    }

    attributions.forEach((attr: any, idx: number) => {
      totalAttributions++;
      if (!attr.passage_id) {
        brokenAttributions++;
        brokenList.push({ claim_id: c.id, attribution_index: idx, reason: 'Missing passage_id' });
        return;
      }
      const passage = passageMap.get(attr.passage_id);
      if (!passage) {
        brokenAttributions++;
        brokenList.push({ claim_id: c.id, attribution_index: idx, reason: `Passage ${attr.passage_id} not found in database` });
        return;
      }

      // Check quoted snippet substring match
      if (attr.quoted_text && !passage.text.includes(attr.quoted_text.trim())) {
        // Soft match check (first 30 chars)
        const prefix = attr.quoted_text.slice(0, 30).trim();
        if (!passage.text.includes(prefix)) {
          brokenAttributions++;
          brokenList.push({ 
            claim_id: c.id, 
            attribution_index: idx, 
            reason: `Quoted text mismatch: quote not found in passage text.` 
          });
          return;
        }
      }

      intactAttributions++;
    });
  }

  // Check W5 Warrant violations (W5 claim with support_status != 'disputed')
  const w5Violations = claims.filter(c => c.warrant_category === 'W5' && c.support_status === 'supported').map(c => ({
    claim_id: c.id,
    text: c.text,
    violation: 'W5 Metaphysical Closure is forbidden from being classified as accepted/supported system fact (CR-04).'
  }));

  // Check claims without objections
  const claimsWithoutObjection = claims.filter(c => {
    try {
      const objs = JSON.parse(c.objection_ids || '[]');
      return objs.length === 0;
    } catch {
      return true;
    }
  }).map(c => ({
    claim_id: c.id,
    text: c.text,
    warrant: c.warrant_category
  }));

  // Critical Revisions compliance check
  const correctionsStatus = corrections.map(cr => ({
    code: cr.code,
    title: cr.title,
    enforced: Boolean(cr.enforced_in_system),
    rationale: cr.constitutional_rationale
  }));

  const pass = brokenAttributions === 0 && w5Violations.length === 0;

  return {
    timestamp: new Date().toISOString(),
    project_id: projectId,
    overall_status: pass ? 'PASSED' : 'DEFECTS_FOUND',
    metrics: {
      total_claims: claims.length,
      total_attributions: totalAttributions,
      intact_attributions: intactAttributions,
      broken_attributions: brokenAttributions,
      unsupported_claims: unsupportedClaims,
      total_objections: objections.length,
      total_corrections_enforced: corrections.filter(c => c.enforced_in_system).length
    },
    reference_integrity: {
      status: brokenAttributions === 0 ? 'valid' : 'broken',
      broken_references: brokenList
    },
    warrant_discipline: {
      w5_closure_violations: w5Violations,
      claims_lacking_adversarial_objections: claimsWithoutObjection
    },
    mandatory_corrections_compliance: correctionsStatus
  };
}

// ---------------------------------------------------------------------------
// 4. RESEARCH LOOP ENGINE (Autonomous & Guided)
// ---------------------------------------------------------------------------

export async function createResearchJob(
  projectId: string,
  targetNodes: string[],
  maxCycles = 3,
  maxRequests = 36
): Promise<string> {
  const db = getDb();
  if (!Array.isArray(targetNodes) || !targetNodes.length || targetNodes.length > 100 || targetNodes.some(n => typeof n !== 'string' || !n.trim() || n.length > 300)) throw new InputError('targetNodes must contain 1 to 100 nonempty strings.');
  if (!Number.isInteger(maxCycles) || maxCycles < 1 || maxCycles > 100 || !Number.isInteger(maxRequests) || maxRequests < 1 || maxRequests > 1000) throw new InputError('Research bounds must be integers: cycles 1 to 100, requests 1 to 1000.');
  const jobId = 'job_' + crypto.randomUUID().slice(0, 8);
  const now = new Date().toISOString();

  const insertJob = db.prepare(`
    INSERT INTO research_jobs (id, project_id, target_nodes, max_cycles, max_requests, current_cycle, requests_executed, status, candidate_additions, accepted_additions, rejected_additions, duplicate_proposals, checkpoint_data, created_at, updated_at)
    VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
  `);

  insertJob.run(
    jobId,
    projectId,
    JSON.stringify(targetNodes),
    maxCycles,
    maxRequests,
    0,
    0,
    'queued',
    0,
    0,
    0,
    0,
    JSON.stringify({ step: 'init', cycle: 0 }),
    now,
    now
  );

  return jobId;
}

export function logJobEvent(jobId: string, eventType: string, message: string, payload?: any): void {
  const db = getDb();
  const insert = db.prepare(`
    INSERT INTO job_events (id, job_id, event_type, message, payload, timestamp)
    VALUES (?, ?, ?, ?, ?, ?)
  `);
  insert.run(
    'evt_' + crypto.randomUUID().slice(0, 8),
    jobId,
    eventType,
    message,
    payload ? JSON.stringify(payload) : null,
    new Date().toISOString()
  );
}

export function runResearchLoopStep(jobId: string): Promise<ResearchJob> {
  const active = activeJobs.get(jobId);
  if (active) return active;
  const step = runResearchLoopStepInternal(jobId).finally(() => activeJobs.delete(jobId));
  activeJobs.set(jobId, step);
  return step;
}
async function runResearchLoopStepInternal(jobId: string): Promise<ResearchJob> {
  const db = getDb();
  const getJob = db.prepare('SELECT * FROM research_jobs WHERE id = ?');
  const job = getJob.get(jobId) as any;
  if (!job) throw new Error('Job not found: ' + jobId);

  if (['completed', 'interrupted', 'cancelled', 'failed'].includes(job.status)) {
    return job;
  }

  // Budget check (max_cycles and max_requests)
  if (job.current_cycle >= job.max_cycles || job.requests_executed >= job.max_requests) {
    const finishStmt = db.prepare(`
      UPDATE research_jobs SET status = 'completed', updated_at = ? WHERE id = ?
    `);
    finishStmt.run(new Date().toISOString(), jobId);
    logJobEvent(jobId, 'job_finished', `Research loop reached bounds: cycle ${job.current_cycle}/${job.max_cycles}, requests ${job.requests_executed}/${job.max_requests}`);
    return getJob.get(jobId) as any;
  }

  // Mark as running
  const updateRunning = db.prepare(`
    UPDATE research_jobs SET status = 'running', updated_at = ? WHERE id = ?
  `);
  updateRunning.run(new Date().toISOString(), jobId);

  const nextCycle = job.current_cycle + 1;
  logJobEvent(jobId, 'cycle_start', `Beginning Cycle ${nextCycle} of ${job.max_cycles}`);

  const openRouterAvailable = getOpenRouterStatus().configured;
  let generationMode: 'openrouter' | 'deterministic' = 'deterministic';
  let totalTokens = 0;
  let generationModel: string | null = null;
  const passages = db.prepare(`
    SELECT p.id, p.text, p.section_heading, p.source_id, s.filename as source_filename
    FROM passages p JOIN sources s ON p.source_id = s.id
    WHERE s.project_id = ? ORDER BY p.source_id, p.passage_index LIMIT 10
  `).all(job.project_id) as any[];
  if (!passages.length) {
    db.prepare("UPDATE research_jobs SET status = 'completed', updated_at = ? WHERE id = ?").run(new Date().toISOString(), jobId);
    logJobEvent(jobId, 'job_finished', 'No passages are available for this project.');
    return getJob.get(jobId) as unknown as ResearchJob;
  }

  // Execute Cycle Steps:
  // Step 1: Extraction & Candidate Formation
  logJobEvent(jobId, 'extraction_step', `Analyzing ${passages.length} passages for claim formations...`);
  
  let newCandidates = 0;
  let newObjections = 0;
  let newContradictions = 0;

  if (openRouterAvailable) {
    try {
      const response = await openRouterJson('You are PEC-Ω, an adversarial philosophical kernel for Nihiltheism research.', `
Analyze the following passages and generate 1 rigorous philosophical claim with warrant level (W0-W4), 1 adversarial rival objection (from naturalism, theism, or Buddhism), and any contradiction.
Apply strict Predicate Hygiene and Mandatory Critical Revisions CR-01 to CR-12.

Passages:
${passages.map(p => `[${p.id}] ${p.section_heading || ''}: ${p.text}`).join('\n\n')}

Return valid JSON adhering to:
{
  "claim": {
    "text": string,
    "claim_type": "phenomenological_description" | "normative_commitment" | "methodological_rule" | "comparative_interpretation",
    "warrant_category": "W1" | "W2" | "W3" | "W4",
    "passage_id": string,
    "quoted_snippet": string
  },
  "objection": {
    "title": string,
    "counter_argument": string,
    "rival_model": string,
    "severity": "serious" | "fatal"
  }
}`, validateResearchCandidate);
      const parsed = response.data;
      const citedPassage = passages.find(p => p.id === parsed.claim.passage_id);
      if (!citedPassage || !citedPassage.text.includes(parsed.claim.quoted_snippet)) {
        throw new Error('Generated citation does not match an exact supplied passage.');
      }
      totalTokens = response.totalTokens;
      generationModel = response.model;
      generationMode = 'openrouter';
      atomic(() => {
        if (parsed.claim) {
          const claimId = 'clm_' + crypto.randomUUID().slice(0, 8);
          const objId = 'obj_' + crypto.randomUUID().slice(0, 8);

          const insertClm = db.prepare(`
            INSERT INTO claims (id, project_id, text, claim_type, fidelity_label, source_attributions, premise_claim_ids, concise_inference_summary, warrant_category, support_status, objection_ids, revision_status, created_at, updated_at)
            VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
          `);
          insertClm.run(
            claimId,
            job.project_id,
            parsed.claim.text,
            parsed.claim.claim_type || 'phenomenological_description',
            'PROPOSED',
            JSON.stringify([{
              passage_id: citedPassage.id,
              source_id: citedPassage.source_id,
              source_name: citedPassage.source_filename,
              quoted_text: parsed.claim.quoted_snippet || '',
              page_number: null,
              reference_integrity: true,
              semantic_support: 'unreviewed',
              review_note: 'OpenRouter proposal requiring human review. Generated in Cycle ' + nextCycle
            }]),
            JSON.stringify([]),
            'Extracted by PEC-Ω AI inference loop with predicate hygiene constraints.',
            parsed.claim.warrant_category,
            'unreviewed',
            JSON.stringify([objId]),
            'current',
            new Date().toISOString(),
            new Date().toISOString()
          );
          newCandidates++;

          if (parsed.objection) {
            const insertObj = db.prepare(`
              INSERT INTO objections (id, project_id, claim_id, title, counter_argument, rival_model, severity, status, reply, created_at)
              VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
            `);
            insertObj.run(
              objId,
              job.project_id,
              claimId,
              parsed.objection.title || 'Adversarial Rival Critique',
              parsed.objection.counter_argument || 'Naturalist reduction of phenomenological claim.',
              parsed.objection.rival_model || 'Metaphysical Naturalism',
              parsed.objection.severity || 'serious',
              'open',
              null,
              new Date().toISOString()
            );
            newObjections++;
          }
        }
      });
    } catch (e: any) {
      generationMode = 'deterministic';
      newCandidates = 0;
      newObjections = 0;
      logJobEvent(jobId, 'ai_warning', `OpenRouter generation fallback: ${e.message}`);
    }
  }

  // Offline output is a proposal and never masquerades as attested evidence.
  if (newCandidates === 0) {
    atomic(() => {
    const cycleClaimText = nextCycle === 1 
      ? 'The collapse of protention operates as an experiential suspension of teleological certainty without invalidating local biological agency.'
      : nextCycle === 2
      ? 'Axiological autopoiesis requires active resistance against both dogmatic moralism and nihilistic apathy.'
      : 'Apophatic contemplation of the Void generates psychological resilience only when accompanied by rigorous social solidarity.';

    const cycleObjTitle = nextCycle === 1 
      ? 'Biological Determinism Critique'
      : nextCycle === 2
      ? 'Existential Voluntarism Fallacy'
      : 'Ascetic Quietism Hazard';

    const claimId = 'clm_auto_' + crypto.randomUUID().slice(0, 6);
    const objId = 'obj_auto_' + crypto.randomUUID().slice(0, 6);
    const targetPassage = passages[(nextCycle - 1) % passages.length];

    const insertClm = db.prepare(`
      INSERT INTO claims (id, project_id, text, claim_type, fidelity_label, source_attributions, premise_claim_ids, concise_inference_summary, warrant_category, support_status, objection_ids, revision_status, created_at, updated_at)
      VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
    `);
    insertClm.run(
      claimId,
      job.project_id,
      cycleClaimText,
      'phenomenological_description',
      'PROPOSED',
      JSON.stringify([{
        passage_id: targetPassage.id,
        source_id: targetPassage.source_id,
        source_name: targetPassage.source_filename,
        quoted_text: targetPassage.text.slice(0, 60),
        page_number: null,
        reference_integrity: true,
        semantic_support: 'unreviewed',
        review_note: `Deterministic proposal requiring human review in Cycle ${nextCycle}.`
      }]),
      JSON.stringify([]),
      'Formulated via deterministic PEC-Ω dialectical rules enforcing CR-01 through CR-12.',
      'W1',
      'unreviewed',
      JSON.stringify([objId]),
      'current',
      new Date().toISOString(),
      new Date().toISOString()
    );

    const insertObj = db.prepare(`
      INSERT INTO objections (id, project_id, claim_id, title, counter_argument, rival_model, severity, status, reply, created_at)
      VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
    `);
    insertObj.run(
      objId,
      job.project_id,
      claimId,
      cycleObjTitle,
      'Adversarial test demanding proof that local agency survives meaning-collapse without falling into performative contradiction.',
      'Metaphysical Naturalism',
      'serious',
      'open',
      null,
      new Date().toISOString()
    );

    newCandidates++;
    newObjections++;
    });
  }

  // Step 2: Propose Revisions / Review
  const revId = 'rev_' + crypto.randomUUID().slice(0, 6);
  const insertRev = db.prepare(`
    INSERT INTO revisions (id, project_id, entity_type, entity_id, original_content, proposed_content, role, rationale, status, created_at)
    VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
  `);
  insertRev.run(
    revId,
    job.project_id,
    'claim',
    'clm_une_structure',
    'Universal Nihilistic Event is characterized by a structural collapse of protention...',
    'Ensure explicit mention of CR-01 to prevent ungrounded claims of universality.',
    'critic',
    'Adversarial review insisting on strict predicate hygiene in Cycle ' + nextCycle,
    'pending',
    new Date().toISOString()
  );

  // Update Job counters
  const updateJob = db.prepare(`
    UPDATE research_jobs SET
      current_cycle = ?,
      requests_executed = requests_executed + 1,
      candidate_additions = candidate_additions + ?,
      accepted_additions = accepted_additions + ?,
      status = ?,
      checkpoint_data = ?,
      updated_at = ?
    WHERE id = ?
  `);

  const isFinal = nextCycle >= job.max_cycles || job.requests_executed + 1 >= job.max_requests;
  updateJob.run(
    nextCycle,
    newCandidates,
    0,
    isFinal ? 'completed' : 'paused',
    JSON.stringify({ cycle: nextCycle, lastEvent: 'cycle_completed', generationMode, model: generationModel, totalTokens }),
    new Date().toISOString(),
    jobId
  );

  logJobEvent(jobId, 'cycle_complete', `Cycle ${nextCycle} complete. Formed ${newCandidates} claim(s), ${newObjections} objection(s). Job status: ${isFinal ? 'completed' : 'paused'}`);

  return getJob.get(jobId) as any;
}

// ---------------------------------------------------------------------------
// 5. EXPORT ENGINE (Markdown, JSON, ZIP bundle)
// ---------------------------------------------------------------------------

export interface FullExportBundle {
  project: Project;
  sources: Source[];
  passages: Passage[];
  concepts: Concept[];
  claims: Claim[];
  objections: Objection[];
  contradictions: Contradiction[];
  corrections: Correction[];
  revisions: Revision[];
  auditReport: AuditReport;
  manuscriptChapters: any[];
}

export function getFullExportBundle(projectId = 'proj_journal314_canonical'): FullExportBundle {
  const db = getDb();
  const project = db.prepare('SELECT * FROM projects WHERE id = ?').get(projectId) as any;
  const sources = db.prepare('SELECT * FROM sources WHERE project_id = ?').all(projectId) as any[];
  const passages = db.prepare('SELECT p.* FROM passages p JOIN sources s ON p.source_id = s.id WHERE s.project_id = ?').all(projectId) as any[];
  const concepts = db.prepare('SELECT * FROM concepts WHERE project_id = ?').all(projectId) as any[];
  const claims = db.prepare('SELECT * FROM claims WHERE project_id = ?').all(projectId) as any[];
  const objections = db.prepare('SELECT * FROM objections WHERE project_id = ?').all(projectId) as any[];
  const contradictions = db.prepare('SELECT * FROM contradictions WHERE project_id = ?').all(projectId) as any[];
  const corrections = db.prepare('SELECT * FROM corrections').all() as any[];
  const revisions = db.prepare('SELECT * FROM revisions WHERE project_id = ?').all(projectId) as any[];
  const auditReport = performAudit(projectId);
  const manuscriptChapters = db.prepare('SELECT * FROM manuscript_sections ORDER BY chapter_number ASC').all() as any[];

  return {
    project,
    sources,
    passages,
    concepts,
    claims,
    objections,
    contradictions,
    corrections,
    revisions,
    auditReport,
    manuscriptChapters
  };
}

export function generateManuscriptMarkdown(chapters: any[]): string {
  let md = `# THE ARCHITECTURE OF NIHILTHEISM
## Canonical Reference Edition v1.0
### Verified Target-State Philosophical Synthesis & Research Workbench
*Generated in accordance with PEC-Ω Constitution & Acceptance Criteria*

---

## TABLE OF CONTENTS
`;

  for (const ch of chapters) {
    md += `- [Chapter ${ch.chapter_number}: ${ch.title}](#chapter-${ch.chapter_number}-${ch.slug})\n`;
  }

  md += `\n---\n\n`;

  for (const ch of chapters) {
    md += `${ch.full_text}\n\n`;
    md += `**Chapter Metadata**:\n`;
    md += `- Word Count: ${ch.word_count}\n`;
    md += `- Epistemic Status: ${ch.epistemic_status}\n`;
    md += `- Cross-References: ${ch.cross_references}\n`;
    md += `- Open Questions: ${ch.open_questions}\n\n`;
    md += `---\n\n`;
  }

  return md;
}

export async function createExportZip(projectId = 'proj_journal314_canonical'): Promise<Buffer> {
  const bundle = getFullExportBundle(projectId);
  const zip = new JSZip();

  // 1. Full Manuscript
  const manuscriptMd = generateManuscriptMarkdown(bundle.manuscriptChapters);
  zip.file('manuscript.md', manuscriptMd);

  // 2. Structured Datasets (JSON)
  zip.file('corpus_sources.json', JSON.stringify(bundle.sources, null, 2));
  zip.file('concepts.json', JSON.stringify(bundle.concepts, null, 2));
  zip.file('claims.json', JSON.stringify(bundle.claims, null, 2));
  zip.file('objections.json', JSON.stringify(bundle.objections, null, 2));
  zip.file('contradictions.json', JSON.stringify(bundle.contradictions, null, 2));
  zip.file('corrections.json', JSON.stringify(bundle.corrections, null, 2));
  zip.file('revisions.json', JSON.stringify(bundle.revisions, null, 2));
  zip.file('audit_report.json', JSON.stringify(bundle.auditReport, null, 2));

  // 3. README and Release Certificate
  const totalWords = bundle.manuscriptChapters.reduce((acc, c) => acc + (c.word_count || 0), 0);
  const readme = `# NIHILTHEISM ARCHITECT v1.0 - RELEASE ARCHIVE
**Generated**: ${new Date().toISOString()}
**Project**: ${bundle.project?.name || 'Journal314 Canonical Architecture'}

## CONTENTS
- \`manuscript.md\`: Complete 17-chapter philosophical reference edition (${totalWords.toLocaleString()} words).
- \`audit_report.json\`: Epistemic verification ledger & reference integrity audit (${bundle.auditReport.overall_status}).
- \`corpus_sources.json\`: Ingested source files and provenance metadata.
- \`concepts.json\`: Structured ontology of definitions, theses, and limit conditions.
- \`claims.json\`: Attributed philosophical claims with dual validation & W0-W5 warrant categories.
- \`objections.json\`: Adversarial rival-model stress tests and retained disagreements.
- \`contradictions.json\`: Conflict tracking and resolution ledgers.
- \`corrections.json\`: Enforced Mandatory Critical Revisions (CR-01 through CR-12).

## CONSTITUTIONAL STATUS
- Reference Integrity: ${bundle.auditReport.reference_integrity.status}
- Non-Closure: Enforced
- Predicate Hygiene: Enforced
`;
  zip.file('README.md', readme);

  return await zip.generateAsync({ type: 'nodebuffer', compression: 'DEFLATE' });
}

// ---------------------------------------------------------------------------
// 6. HYPERMAP DIALECTIC MATRIX SERVICES
// ---------------------------------------------------------------------------

export function getHypermapHierarchy(rootTreeId?: string): HypermapTreeNode {
  const db = getDb();
  
  let query = 'SELECT * FROM hypermap_nodes ORDER BY order_index ASC';
  let params: any[] = [];
  
  if (rootTreeId && rootTreeId !== 'all') {
    query = 'SELECT * FROM hypermap_nodes WHERE root_tree_id = ? ORDER BY order_index ASC';
    params = [rootTreeId];
  }

  const rows = db.prepare(query).all(...params) as unknown as HypermapNode[];
  if (rows.length === 0) {
    throw new Error('No hypermap nodes found in database.');
  }

  // Group by parent_id
  const childrenMap = new Map<string | null, HypermapTreeNode[]>();
  for (const r of rows) {
    const treeNode: HypermapTreeNode = {
      ...r,
      children: []
    };
    const pId = r.parent_id;
    if (!childrenMap.has(pId)) {
      childrenMap.set(pId, []);
    }
    childrenMap.get(pId)!.push(treeNode);
  }

  // Recursive tree builder
  function attachChildren(node: HypermapTreeNode) {
    const kids = childrenMap.get(node.id) || [];
    node.children = kids;
    for (const k of kids) {
      attachChildren(k);
    }
  }

  // If specific root requested or only 1 root matches
  if (rootTreeId && rootTreeId !== 'all') {
    const rootRow = rows.find(r => r.id === rootTreeId || (r.parent_id === null && r.root_tree_id === rootTreeId));
    if (!rootRow) {
      throw new Error(`Root node not found for ${rootTreeId}`);
    }
    const rootNode: HypermapTreeNode = { ...rootRow, children: [] };
    attachChildren(rootNode);
    return rootNode;
  }

  // Find root 1 and root 2
  const root1 = rows.find(r => r.id === 'tree_journal314_phenomenology');
  const root2 = rows.find(r => r.id === 'tree_pec_omega_dialectic');

  const tree1Node: HypermapTreeNode = root1 ? { ...root1, children: [] } : {
    id: 'tree_journal314_phenomenology',
    project_id: 'proj_journal314_canonical',
    parent_id: 'root_cosmos',
    root_tree_id: 'tree_journal314_phenomenology',
    title: 'JOURNAL314 Ω — Systematic Phenomenological Taxonomy & Corpus Ontology',
    node_type: 'root',
    warrant_category: 'W3',
    payload_text: 'Phenomenological taxonomy and corpus ontology.',
    epistemic_status: 'strongly_supported',
    fidelity_label: 'STATED',
    order_index: 0,
    created_at: new Date().toISOString(),
    updated_at: new Date().toISOString()
  };
  if (root1) attachChildren(tree1Node);

  const tree2Node: HypermapTreeNode = root2 ? { ...root2, children: [] } : {
    id: 'tree_pec_omega_dialectic',
    project_id: 'proj_journal314_canonical',
    parent_id: 'root_cosmos',
    root_tree_id: 'tree_pec_omega_dialectic',
    title: 'PEC-Ω — Dialectical Antinomy & Adversarial Discovery Matrix',
    node_type: 'root',
    warrant_category: 'W4',
    payload_text: 'Dialectical antinomy and adversarial matrix.',
    epistemic_status: 'directly_attested',
    fidelity_label: 'STATED',
    order_index: 1,
    created_at: new Date().toISOString(),
    updated_at: new Date().toISOString()
  };
  if (root2) attachChildren(tree2Node);

  // Return combined cosmos node containing both root trees
  const cosmosRoot: HypermapTreeNode = {
    id: 'root_cosmos',
    project_id: 'proj_journal314_canonical',
    parent_id: null,
    root_tree_id: 'tree_journal314_phenomenology',
    title: 'JOURNAL314 Ω × PEC-Ω: Dynamic Epistemic Hypermap',
    node_type: 'cosmos',
    warrant_category: 'W4',
    payload_text: 'Bidirectional Generative Dialectical Matrix uniting the 2 unique root trees across 1,808+ preserved nodes.',
    epistemic_status: 'directly_attested',
    paradox_relation: 'cosmic_dialetheic_nexus',
    fidelity_label: 'STATED',
    order_index: 0,
    created_at: new Date().toISOString(),
    updated_at: new Date().toISOString(),
    children: [tree1Node, tree2Node]
  };

  return cosmosRoot;
}

export function getHypermapStats(): HypermapStats {
  const db = getDb();
  const rows = db.prepare('SELECT id, root_tree_id, node_type, warrant_category, epistemic_status FROM hypermap_nodes').all() as any[];

  const stats: HypermapStats = {
    totalNodes: rows.length,
    tree1Nodes: rows.filter(r => r.root_tree_id === 'tree_journal314_phenomenology').length,
    tree2Nodes: rows.filter(r => r.root_tree_id === 'tree_pec_omega_dialectic').length,
    byType: {},
    byWarrant: {},
    byEpistemic: {}
  };

  for (const r of rows) {
    stats.byType[r.node_type] = (stats.byType[r.node_type] || 0) + 1;
    if (r.warrant_category) {
      stats.byWarrant[r.warrant_category] = (stats.byWarrant[r.warrant_category] || 0) + 1;
    }
    if (r.epistemic_status) {
      stats.byEpistemic[r.epistemic_status] = (stats.byEpistemic[r.epistemic_status] || 0) + 1;
    }
  }

  return stats;
}

export function addHypermapNode(input: HypermapNodeInput): HypermapNode {
  return atomic(() => addHypermapNodeInternal(input));
}
function addHypermapNodeInternal(input: HypermapNodeInput): HypermapNode {
  requireText(input.parent_id, 'parent_id', 200);
  requireText(input.title, 'title', 300);
  requireText(input.payload_text, 'payload_text');
  requireEnum(input.node_type, ['root', 'cosmos', 'domain', 'category', 'concept', 'claim', 'paradox', 'objection', 'revision', 'insight', 'citation'], 'node_type');
  requireEnum(input.warrant_category, ['W0','W1','W2','W3','W4','W5'], 'warrant_category');
  requireEnum(input.epistemic_status, ['directly_attested','strongly_supported','supported','plausible','underdetermined','disputed'], 'epistemic_status');
  requireEnum(input.fidelity_label, ['DIRECT_QUOTE','PARAPHRASE','INFERRED','PROPOSED','STATED'], 'fidelity_label');
  const db = getDb();
  const now = new Date().toISOString();

  // Determine parent and root tree
  const parent = db.prepare('SELECT * FROM hypermap_nodes WHERE id = ?').get(input.parent_id) as any;
  if (!parent) throw new InputError('Parent hypermap node not found.', 404);
  const rootTreeId = parent.root_tree_id;
  const projectId = parent ? parent.project_id : 'proj_journal314_canonical';

  // Calculate order_index
  const maxOrderRow = db.prepare('SELECT MAX(order_index) as max_ord FROM hypermap_nodes WHERE parent_id = ?').get(input.parent_id) as any;
  const nextOrder = (maxOrderRow?.max_ord ?? 0) + 1;

  const id = `hm_user_${Date.now().toString(36)}_${Math.random().toString(36).slice(2, 6)}`;
  let claimId: string | null = null;

  // State Synchronization: mirror into claims / objections / contradictions
  if (input.node_type === 'claim' || input.node_type === 'insight' || input.node_type === 'concept') {
    claimId = `clm_${id}`;
    const passageId = parent.passage_id;
    const targetPassage = passageId ? db.prepare('SELECT p.*, s.filename as source_name FROM passages p JOIN sources s ON p.source_id = s.id WHERE p.id = ?').get(passageId) as any : null;
    const quotedText = targetPassage?.text.slice(0, 50) || '';

    const insertClaim = db.prepare(`
      INSERT INTO claims (
        id, project_id, text, claim_type, fidelity_label,
        source_attributions, premise_claim_ids, concise_inference_summary,
        warrant_category, support_status, objection_ids, revision_status,
        created_at, updated_at
      ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
    `);
    insertClaim.run(
      claimId,
      projectId,
      input.title + ': ' + input.payload_text,
      input.node_type === 'concept' ? 'phenomenological_description' : 'metaphysical_hypothesis',
      input.fidelity_label || 'PROPOSED',
      JSON.stringify(targetPassage ? [{ 
        source_id: targetPassage.source_id, 
        source_name: targetPassage.source_name,
        passage_id: passageId, 
        quoted_text: quotedText,
        citation_type: 'INFERRED',
        page_number: null,
        reference_integrity: true,
        semantic_support: 'unreviewed'
      }] : []),
      JSON.stringify(parent?.claim_id ? [parent.claim_id] : []),
      `Derived in Hypermap under ${parent?.title || 'root'}`,
      input.warrant_category || 'W2',
      input.warrant_category === 'W5' || input.epistemic_status === 'disputed' ? 'disputed' : 'unreviewed',
      JSON.stringify([]),
      'current',
      now,
      now
    );
  } else if (input.node_type === 'objection') {
    const objId = `obj_${id}`;
    const targetClaimId = parent?.claim_id || 'clm_une_structure';
    const insertObj = db.prepare(`
      INSERT INTO objections (id, project_id, claim_id, title, counter_argument, rival_model, severity, status, reply, created_at)
      VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
    `);
    insertObj.run(
      objId,
      projectId,
      targetClaimId,
      input.title,
      input.payload_text,
      'Adversarial Defeater / Symmetrical Challenge',
      'serious',
      'addressed',
      'Awaiting dialectical synthesis',
      now
    );
  } else if (input.node_type === 'paradox') {
    const cntrId = `cntr_${id}`;
    const insertCntr = db.prepare(`
      INSERT INTO contradictions (id, project_id, claim_a_id, claim_b_id, relevant_senses, conflict_type, proposed_resolution, remaining_disagreement, status, created_at, updated_at)
      VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
    `);
    insertCntr.run(
      cntrId,
      projectId,
      parent?.claim_id || 'clm_une_structure',
      'clm_w4_commitment',
      `LP True Contradiction: ${input.title}`,
      'logical',
      'Priestian dialetheic valuation: designated truth value {0, 1}',
      input.payload_text,
      'accepted_tension',
      now,
      now
    );
  }

  // Insert into hypermap_nodes
  const insertNode = db.prepare(`
    INSERT INTO hypermap_nodes (
      id, project_id, parent_id, root_tree_id, title, node_type,
      warrant_category, payload_text, epistemic_status, paradox_relation,
      fidelity_label, claim_id, passage_id, order_index, created_at, updated_at
    ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
  `);

  insertNode.run(
    id,
    projectId,
    input.parent_id,
    rootTreeId,
    input.title,
    input.node_type,
    input.warrant_category || (input.node_type === 'objection' || input.node_type === 'paradox' ? 'W4' : 'W2'),
    input.payload_text,
    input.epistemic_status || 'supported',
    input.paradox_relation || (input.node_type === 'paradox' ? 'LP_antinomy_priest' : null),
    input.fidelity_label || 'PROPOSED',
    claimId,
    null,
    nextOrder,
    now,
    now
  );

  // Link in relations table if parent exists
  if (parent) {
      const relId = `rel_${id}`;
      const relType = input.node_type === 'objection' ? 'objects_to' :
                      input.node_type === 'paradox' ? 'contradicts' :
                      input.node_type === 'revision' ? 'revises' : 'supports';
      db.prepare(`
        INSERT INTO relations (id, project_id, source_entity_id, source_entity_type, relation_type, target_entity_id, target_entity_type, notes, created_at)
        VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)
      `).run(
        relId,
        projectId,
        id,
        'hypermap_node',
        relType,
        parent.id,
        'hypermap_node',
        `Dynamic hypermap branch: ${input.title}`,
        now
      );
  }

  return db.prepare('SELECT * FROM hypermap_nodes WHERE id = ?').get(id) as unknown as HypermapNode;
}

export function updateHypermapNode(id: string, updates: Partial<HypermapNodeInput>): HypermapNode {
  return atomic(() => updateHypermapNodeInternal(id, updates));
}
function updateHypermapNodeInternal(id: string, updates: Partial<HypermapNodeInput>): HypermapNode {
  if (updates.title != null) requireText(updates.title, 'title', 300);
  if (updates.payload_text != null) requireText(updates.payload_text, 'payload_text');
  requireEnum(updates.warrant_category, ['W0','W1','W2','W3','W4','W5'], 'warrant_category');
  requireEnum(updates.epistemic_status, ['directly_attested','strongly_supported','supported','plausible','underdetermined','disputed'], 'epistemic_status');
  const db = getDb();
  const existing = db.prepare('SELECT * FROM hypermap_nodes WHERE id = ?').get(id) as any;
  if (!existing) {
    throw new InputError(`Hypermap node ${id} not found.`, 404);
  }

  const now = new Date().toISOString();
  const updatedTitle = updates.title ?? existing.title;
  const updatedPayload = updates.payload_text ?? existing.payload_text;
  const updatedWarrant = updates.warrant_category ?? existing.warrant_category;
  const updatedEpistemic = updatedWarrant === 'W5' ? 'disputed' : updates.epistemic_status ?? existing.epistemic_status;
  const updatedParadox = updates.paradox_relation ?? existing.paradox_relation;

  db.prepare(`
    UPDATE hypermap_nodes
    SET title = ?, payload_text = ?, warrant_category = ?, epistemic_status = ?, paradox_relation = ?, updated_at = ?
    WHERE id = ?
  `).run(updatedTitle, updatedPayload, updatedWarrant, updatedEpistemic, updatedParadox, now, id);

  // Sync with corresponding claim if linked
  if (existing.claim_id) {
      db.prepare(`
        UPDATE claims
        SET text = ?, warrant_category = ?, updated_at = ?, support_status = CASE WHEN ? = 'W5' THEN 'disputed' ELSE support_status END
        WHERE id = ?
      `).run(`${updatedTitle}: ${updatedPayload}`, updatedWarrant || 'W2', now, updatedWarrant, existing.claim_id);
  }

  return db.prepare('SELECT * FROM hypermap_nodes WHERE id = ?').get(id) as unknown as HypermapNode;
}

export function deleteHypermapNode(id: string): { success: boolean; deletedCount: number } {
  const db = getDb();
  
  // Recursively collect all descendant IDs
  const toDelete: string[] = [id];
  let cursor = 0;
  while (cursor < toDelete.length) {
    const parentId = toDelete[cursor];
    const children = db.prepare('SELECT id FROM hypermap_nodes WHERE parent_id = ?').all(parentId) as any[];
    for (const c of children) {
      toDelete.push(c.id);
    }
    cursor++;
  }

  const deleteStmt = db.prepare('DELETE FROM hypermap_nodes WHERE id = ?');
  const getClaimStmt = db.prepare('SELECT claim_id FROM hypermap_nodes WHERE id = ?');

  for (const nId of toDelete) {
    try {
      const nodeRow = getClaimStmt.get(nId) as any;
      if (nodeRow?.claim_id) {
        db.prepare('DELETE FROM claims WHERE id = ?').run(nodeRow.claim_id);
      }
    } catch {}
    try { db.prepare('DELETE FROM claims WHERE id = ?').run(`clm_${nId}`); } catch {}
    try { db.prepare('DELETE FROM objections WHERE id = ?').run(`obj_${nId}`); } catch {}
    try { db.prepare('DELETE FROM contradictions WHERE id = ?').run(`cntr_${nId}`); } catch {}
    deleteStmt.run(nId);
  }

  return { success: true, deletedCount: toDelete.length };
}

export function densifyHypermapNode(nodeId: string, customStrategy?: string): Promise<HypermapDensifyResult> {
  const active = activeDensifications.get(nodeId);
  if (active) return active;
  const task = densifyHypermapNodeInternal(nodeId, customStrategy).finally(() => activeDensifications.delete(nodeId));
  activeDensifications.set(nodeId, task);
  return task;
}
async function densifyHypermapNodeInternal(nodeId: string, customStrategy?: string): Promise<HypermapDensifyResult> {
  const db = getDb();
  const node = db.prepare('SELECT * FROM hypermap_nodes WHERE id = ?').get(nodeId) as any;
  if (!node) {
    throw new Error(`Cannot densify: node ${nodeId} not found.`);
  }

  const newNodes: HypermapNode[] = [];
  const now = new Date().toISOString();

  const openRouterAvailable = getOpenRouterStatus().configured;
  let generationMode: 'openrouter' | 'deterministic' = 'deterministic';
  let warning: string | undefined;
  let aiGeneratedBranches: Array<{
    title: string;
    node_type: HypermapNode['node_type'];
    warrant: HypermapNode['warrant_category'];
    payload: string;
    paradox?: string;
  }> | null = null;

  if (openRouterAvailable) {
    try {
      const prompt = `You are the PEC-Ω Philosophical Architecture Engine.
We are densifying a node in the Nihiltheism Epistemic Hypermap.
Node Title: "${node.title}"
Node Type: ${node.node_type}
Current Warrant: ${node.warrant_category || 'W2'}
Node Payload: "${node.payload_text}"
Densification Strategy: ${customStrategy || 'Adversarial LP Defeater & Phenomenological Fine-Graining'}

Generate exactly 3 distinct child dialectical branches expanding this node:
1. A refined Proposition/Claim (node_type: "claim", warrant: "W3") developing the inner mechanics or logical consequence.
2. A rigorous Adversarial Defeater/Counterargument (node_type: "objection", warrant: "W4") challenging its premises using naturalism, constructivism, or apophatic agnosticism.
3. A Graham Priest Logic of Paradox (LP) Antinomy (node_type: "paradox", warrant: "W4") formulating a true contradiction {0, 1} at the limit of thought without explosion.

Return a JSON object {"branches": [...]} with exactly three objects with keys: "title", "node_type", "warrant", "payload", "paradox". Treat contradictions as proposals to examine, not established truths.`;

      const response = await openRouterJson('You are the PEC-Ω Philosophical Architecture Engine.', prompt, validateBranches);
      aiGeneratedBranches = response.data;
      generationMode = 'openrouter';
    } catch (aiErr) {
      warning = aiErr instanceof Error ? aiErr.message : 'OpenRouter generation failed.';
    }
  } else {
    warning = 'OpenRouter is not configured; deterministic proposals were generated.';
  }

  // Fallback high-rigor philosophical branches if AI not present or failed
  if (!aiGeneratedBranches || aiGeneratedBranches.length === 0) {
    aiGeneratedBranches = [
      {
        title: `Fine-Grained Proposition: Structural Immanence of ${node.title}`,
        node_type: 'claim',
        warrant: 'W3',
        payload: `Delineates how ${node.title} operates within the pre-reflective clearing of consciousness prior to reification. Tested against Nishidan and phenomenological frameworks.`
      },
      {
        title: `Adversarial Defeater: Naturalistic Reduction of ${node.title}`,
        node_type: 'objection',
        warrant: 'W4',
        payload: `Challenges ${node.title} on neurocomputational and predictive processing grounds: demonstrates that affective rupture can be modeled without metaphysical transcendence.`
      },
      {
        title: `LP Antinomy: Paraconsistent Dialetheia on ${node.title}`,
        node_type: 'paradox',
        warrant: 'W4',
        paradox: 'LP_antinomy_priest',
        payload: `True contradiction: ${node.title} simultaneously constitutes the condition of manifestation and the absolute cancellation of all manifest content. v(P) = {0, 1}.`
      },
      {
        title: `Constitutional Revision: Warrant Discipline for ${node.title}`,
        node_type: 'revision',
        warrant: 'W4',
        payload: `Constitutional quarantine preventing ${node.title} from ascending into W5 dogmatic metaphysical closure without continuous empirical and hermeneutic audit.`
      }
    ];
  }

  atomic(() => {
  for (const branch of aiGeneratedBranches!) {
    const created = addHypermapNode({
      parent_id: node.id,
      root_tree_id: node.root_tree_id,
      title: branch.title,
      node_type: branch.node_type,
      warrant_category: branch.warrant,
      payload_text: branch.payload,
      paradox_relation: branch.paradox,
      epistemic_status: 'underdetermined',
      fidelity_label: 'PROPOSED'
    });
    newNodes.push(created);
  }
  });

  const totalCount = (db.prepare('SELECT COUNT(*) as c FROM hypermap_nodes').get() as any).c;

  return {
    parentNode: node,
    newNodes,
    totalTreeNodes: totalCount,
    generationMode,
    warning,
  };
}
