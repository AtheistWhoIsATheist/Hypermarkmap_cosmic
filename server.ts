/**
 * Express Server for Nihiltheism Architect v1.0
 * Handles all REST API routes, SQLite interactions, background research loops,
 * file ingestion, exports, and mounts Vite middleware.
 */

import './server/config';
import express from 'express';
import type { Request, Response, NextFunction } from 'express';
import * as nodeCrypto from 'node:crypto';
import { getOpenRouterStatus } from './server/openrouter';
import { InputError } from './server/errors';

function apiError(res: Response, error: unknown) {
  if (error instanceof InputError) return res.status(error.status).json({ error: error.message });
  return res.status(500).json({ error: 'The operation failed. Please check the request and try again.' });
}
import path from 'node:path';
import { getDb, closeDb } from './server/db';
import { seedDatabase } from './server/seedData';
import {
  ingestDocument,
  searchPassages,
  getPassageWithContext,
  performAudit,
  createResearchJob,
  runResearchLoopStep,
  getFullExportBundle,
  generateManuscriptMarkdown,
  createExportZip,
  getHypermapHierarchy,
  getHypermapStats,
  addHypermapNode,
  updateHypermapNode,
  deleteHypermapNode,
  densifyHypermapNode
} from './server/services';

async function startServer() {
  const app = express();
  const PORT = Number(process.env.PORT || 3000);
  if (!Number.isInteger(PORT) || PORT < 1 || PORT > 65535) throw new Error('PORT must be an integer between 1 and 65535.');
  const HOST = process.env.HOST || '127.0.0.1';
  const production = process.env.NODE_ENV === 'production' || process.argv[1]?.endsWith('server.cjs');
  app.disable('x-powered-by');
  app.use((req: Request, res: Response, next: NextFunction) => {
    res.setHeader('X-Content-Type-Options', 'nosniff');
    res.setHeader('Referrer-Policy', 'same-origin');
    res.setHeader('X-Frame-Options', 'DENY');
    if (req.path.startsWith('/api/')) res.setHeader('Cache-Control', 'no-store');
    if (!['GET', 'HEAD', 'OPTIONS'].includes(req.method) && req.get('origin')) {
      try {
        if (new URL(req.get('origin')!).host !== (req.get('x-forwarded-host') || req.get('host'))) {
          return res.status(403).json({ error: 'Cross-origin mutations are not allowed.' });
        }
      } catch { return res.status(403).json({ error: 'Invalid request origin.' }); }
    }
    next();
  });

  // ── Write-endpoint authentication ─────────────────────────────────────
  // Mutations on /api/* require a bearer token when WRITE_API_KEY (or
  // ADMIN_API_KEY) is configured. Reads are never token-gated. Without a key
  // the API runs in single-user mode, guarded only by the same-origin policy
  // above and the rate limiter below.
  const WRITE_API_KEY = process.env.WRITE_API_KEY || process.env.ADMIN_API_KEY || '';
  if (!WRITE_API_KEY) {
    console.log('[WARN] No WRITE_API_KEY configured. Write endpoints operate in single-user mode guarded only by same-origin policy.');
  }
  const timingSafeEqual = (a: string, b: string): boolean => {
    const ab = Buffer.from(a);
    const bb = Buffer.from(b);
    if (ab.length !== bb.length) return false;
    return nodeCrypto.timingSafeEqual(ab, bb);
  };
  app.use((req: Request, res: Response, next: NextFunction) => {
    if (!WRITE_API_KEY) return next();
    if (['GET', 'HEAD', 'OPTIONS'].includes(req.method)) return next();
    if (!req.path.startsWith('/api/')) return next();
    const auth = req.get('authorization') || '';
    const token = auth.startsWith('Bearer ') ? auth.slice(7) : '';
    if (token && timingSafeEqual(token, WRITE_API_KEY)) return next();
    return res.status(401).json({ error: 'Write endpoints require Authorization: Bearer <WRITE_API_KEY>.' });
  });

  // ── Write-endpoint rate limiting ──────────────────────────────────────
  // The deployment is publicly reachable and, in single-user mode, unauthenticated.
  // A fixed-window limiter bounds mutation traffic, request bytes, and AI spend
  // per client identity (first hop of x-forwarded-for, else socket peer).
  const RATE_WINDOW_MS = 60_000;
  const RATE_MAX_WRITES = 120;
  const RATE_MAX_AI_CALLS = 20;
  const RATE_MAX_BYTES = 256 * 1024 * 1024;
  const AI_PATHS = ['/api/hypermap/densify', '/api/research'];
  const rateBuckets = new Map<string, { writes: number; ai: number; bytes: number; resetAt: number }>();
  const clientKey = (req: Request): string => {
    const forwarded = req.get('x-forwarded-for');
    if (forwarded) return forwarded.split(',')[0].trim() || 'unknown';
    return req.socket.remoteAddress || 'unknown';
  };
  app.use((req: Request, res: Response, next: NextFunction) => {
    if (['GET', 'HEAD', 'OPTIONS'].includes(req.method)) return next();
    if (!req.path.startsWith('/api/')) return next();
    const now = Date.now();
    const key = clientKey(req);
    let bucket = rateBuckets.get(key);
    if (!bucket || now >= bucket.resetAt) {
      bucket = { writes: 0, ai: 0, bytes: 0, resetAt: now + RATE_WINDOW_MS };
      rateBuckets.set(key, bucket);
    }
    const isAi = AI_PATHS.some((p) => req.path === p || req.path.startsWith(p + '/'));
    bucket.writes += 1;
    if (isAi) bucket.ai += 1;
    const declared = Number(req.get('content-length') || 0);
    if (Number.isFinite(declared) && declared > 0) bucket.bytes += declared;
    if (bucket.writes > RATE_MAX_WRITES) {
      res.setHeader('Retry-After', String(Math.max(1, Math.ceil((bucket.resetAt - now) / 1000))));
      return res.status(429).json({ error: 'Too many write requests. Retry after the cooldown.' });
    }
    if (isAi && bucket.ai > RATE_MAX_AI_CALLS) {
      res.setHeader('Retry-After', String(Math.max(1, Math.ceil((bucket.resetAt - now) / 1000))));
      return res.status(429).json({ error: 'Too many AI-generation requests. Retry after the cooldown.' });
    }
    if (bucket.bytes > RATE_MAX_BYTES) {
      res.setHeader('Retry-After', String(Math.max(1, Math.ceil((bucket.resetAt - now) / 1000))));
      return res.status(429).json({ error: 'Upload volume limit reached for this window. Retry after the cooldown.' });
    }
    next();
  });
  // Sweep expired buckets so the limiter cannot grow without bound.
  const rateSweep = setInterval(() => {
    const now = Date.now();
    for (const [k, b] of rateBuckets) if (now >= b.resetAt) rateBuckets.delete(k);
  }, RATE_WINDOW_MS);
  if (typeof rateSweep.unref === 'function') rateSweep.unref();

  // Configure JSON and text limits for large document and PDF base64 payloads
  app.use(express.json({ limit: '60mb' }));
  app.use(express.urlencoded({ extended: true, limit: '60mb' }));

  // Initialize DB and run initial seed if required
  const db = getDb();
  seedDatabase(db);

  // -------------------------------------------------------------------------
  // REST API ROUTES
  // -------------------------------------------------------------------------

  // Health check
  app.get('/api/health', (req: Request, res: Response) => {
    res.json({
      status: 'ok',
      mode: 'Nihiltheism Architect v1.0',
      database: 'connected',
      ai: getOpenRouterStatus(),
      timestamp: new Date().toISOString()
    });
  });

  // Project Info
  app.get('/api/project', (req: Request, res: Response) => {
    try {
      const project = db.prepare('SELECT * FROM projects LIMIT 1').get() as any;
      if (!project) return res.status(404).json({ error: 'No project found' });

      const counts = {
        sources: (db.prepare('SELECT COUNT(*) as count FROM sources WHERE project_id = ?').get(project.id) as any).count,
        passages: (db.prepare('SELECT COUNT(*) as count FROM passages p JOIN sources s ON p.source_id = s.id WHERE s.project_id = ?').get(project.id) as any).count,
        concepts: (db.prepare('SELECT COUNT(*) as count FROM concepts WHERE project_id = ?').get(project.id) as any).count,
        claims: (db.prepare('SELECT COUNT(*) as count FROM claims WHERE project_id = ?').get(project.id) as any).count,
        objections: (db.prepare('SELECT COUNT(*) as count FROM objections WHERE project_id = ?').get(project.id) as any).count,
        contradictions: (db.prepare('SELECT COUNT(*) as count FROM contradictions WHERE project_id = ?').get(project.id) as any).count,
        revisions: (db.prepare('SELECT COUNT(*) as count FROM revisions WHERE project_id = ?').get(project.id) as any).count,
        corrections: (db.prepare('SELECT COUNT(*) as count FROM corrections').get() as any).count,
      };

      res.json({ project, counts });
    } catch (err: any) {
      apiError(res, err);
    }
  });

  // System Stats (for DashboardView & UI metrics)
  app.get('/api/stats', (req: Request, res: Response) => {
    try {
      const sourcesCount = (db.prepare('SELECT COUNT(*) as count FROM sources').get() as any)?.count || 0;
      const passagesCount = (db.prepare('SELECT COUNT(*) as count FROM passages').get() as any)?.count || 0;
      const conceptsCount = (db.prepare('SELECT COUNT(*) as count FROM concepts').get() as any)?.count || 0;
      const claimsCount = (db.prepare('SELECT COUNT(*) as count FROM claims').get() as any)?.count || 0;
      const correctionsCount = (db.prepare('SELECT COUNT(*) as count FROM corrections').get() as any)?.count || 0;
      const objectionsCount = (db.prepare('SELECT COUNT(*) as count FROM objections').get() as any)?.count || 0;
      const contradictionsCount = (db.prepare('SELECT COUNT(*) as count FROM contradictions').get() as any)?.count || 0;
      const researchJobsCount = (db.prepare('SELECT COUNT(*) as count FROM research_jobs').get() as any)?.count || 0;
      const chaptersCount = (db.prepare('SELECT COUNT(*) as count FROM manuscript_sections').get() as any)?.count || 0;

      const wordsRow = db.prepare('SELECT SUM(word_count) as totalWords FROM manuscript_sections').get() as any;
      const totalWords = wordsRow?.totalWords || 0;

      res.json({
        sources: sourcesCount,
        passages: passagesCount,
        concepts: conceptsCount,
        claims: claimsCount,
        corrections: correctionsCount,
        objections: objectionsCount,
        contradictions: contradictionsCount,
        researchJobs: researchJobsCount,
        manuscriptChapters: chaptersCount,
        totalManuscriptWords: totalWords
      });
    } catch (err: any) {
      apiError(res, err);
    }
  });

  // Sources & Ingestion
  app.get('/api/sources', (req: Request, res: Response) => {
    try {
      const sources = db.prepare('SELECT * FROM sources ORDER BY import_timestamp DESC').all();
      res.json(sources.map((s: any) => ({
        ...s,
        extraction_warnings: JSON.parse(s.extraction_warnings || '[]')
      })));
    } catch (err: any) {
      apiError(res, err);
    }
  });

  app.post('/api/sources/ingest', async (req: Request, res: Response) => {
    try {
      const { projectId, filename, mediaType, contentBase64, contentText, customMetadata } = req.body;
      if (typeof filename !== 'string' || !filename.trim() || filename.length > 255 || /[\\/]/.test(filename) || (typeof contentBase64 !== 'string' && typeof contentText !== 'string')) {
        return res.status(400).json({ error: 'filename and content (base64 or text) are required.' });
      }

      const projId = projectId || 'proj_journal314_canonical';
      const result = await ingestDocument({
        projectId: projId,
        filename,
        mediaType: mediaType || 'text/plain',
        contentBase64,
        contentText,
        customMetadata
      });

      res.status(201).json(result);
    } catch (err: any) {
      apiError(res, err);
    }
  });

  // Search Passages (FTS5)
  app.get('/api/passages/search', (req: Request, res: Response) => {
    try {
      const q = (req.query.q as string) || '';
      const sourceId = req.query.source_id as string | undefined;
      const requestedLimit = Number(req.query.limit || 50);
      if (!Number.isInteger(requestedLimit) || requestedLimit < 1 || requestedLimit > 200) return res.status(400).json({ error: 'limit must be between 1 and 200.' });
      const limit = requestedLimit;

      const results = searchPassages(q, sourceId, limit);
      res.json(results);
    } catch (err: any) {
      apiError(res, err);
    }
  });

  // Single Passage with Context Viewer
  app.get('/api/passages/:id', (req: Request, res: Response) => {
    try {
      const context = getPassageWithContext(req.params.id as string);
      if (!context) return res.status(404).json({ error: 'Passage not found' });
      res.json(context);
    } catch (err: any) {
      apiError(res, err);
    }
  });

  // Concepts CRUD
  app.get('/api/concepts', (req: Request, res: Response) => {
    try {
      const concepts = db.prepare('SELECT * FROM concepts ORDER BY canonical_term ASC').all();
      res.json(concepts.map((c: any) => ({
        ...c,
        senses: JSON.parse(c.senses || '[]'),
        tags: JSON.parse(c.tags || '[]')
      })));
    } catch (err: any) {
      apiError(res, err);
    }
  });

  app.post('/api/concepts', (req: Request, res: Response) => {
    try {
      const { name, canonical_term, definition, senses, thesis, limit_condition, status, tags } = req.body;
      const id = 'c_' + (canonical_term || name || '').toLowerCase().replace(/[^\w]/g, '_').slice(0, 20) + '_' + Date.now().toString().slice(-4);
      const now = new Date().toISOString();

      const insert = db.prepare(`
        INSERT INTO concepts (id, project_id, name, canonical_term, definition, senses, thesis, limit_condition, status, tags, created_at, updated_at)
        VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
      `);
      insert.run(
        id,
        'proj_journal314_canonical',
        name,
        canonical_term,
        definition,
        JSON.stringify(senses || []),
        thesis || null,
        limit_condition || null,
        status || 'STATED',
        JSON.stringify(tags || []),
        now,
        now
      );

      res.status(201).json({ id, name, canonical_term, definition });
    } catch (err: any) {
      apiError(res, err);
    }
  });

  // Claims CRUD
  app.get('/api/claims', (req: Request, res: Response) => {
    try {
      const claims = db.prepare('SELECT * FROM claims ORDER BY created_at DESC').all();
      res.json(claims.map((cl: any) => ({
        ...cl,
        source_attributions: JSON.parse(cl.source_attributions || '[]'),
        premise_claim_ids: JSON.parse(cl.premise_claim_ids || '[]'),
        objection_ids: JSON.parse(cl.objection_ids || '[]')
      })));
    } catch (err: any) {
      apiError(res, err);
    }
  });

  app.post('/api/claims', (req: Request, res: Response) => {
    try {
      const {
        text,
        claim_type,
        fidelity_label,
        source_attributions,
        premise_claim_ids,
        concise_inference_summary,
        warrant_category,
        support_status,
        objection_ids
      } = req.body;

      const id = 'clm_' + Date.now().toString(36) + '_' + Math.random().toString(36).slice(2, 6);
      const now = new Date().toISOString();

      const insert = db.prepare(`
        INSERT INTO claims (id, project_id, text, claim_type, fidelity_label, source_attributions, premise_claim_ids, concise_inference_summary, warrant_category, support_status, objection_ids, revision_status, created_at, updated_at)
        VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
      `);

      insert.run(
        id,
        'proj_journal314_canonical',
        text,
        claim_type || 'phenomenological_description',
        fidelity_label || 'STATED',
        JSON.stringify(source_attributions || []),
        JSON.stringify(premise_claim_ids || []),
        concise_inference_summary || null,
        warrant_category || 'W1',
        support_status || 'supported',
        JSON.stringify(objection_ids || []),
        'current',
        now,
        now
      );

      res.status(201).json({ id, text, warrant_category });
    } catch (err: any) {
      apiError(res, err);
    }
  });

  // Objections
  app.get('/api/objections', (req: Request, res: Response) => {
    try {
      const objections = db.prepare('SELECT * FROM objections ORDER BY created_at DESC').all();
      res.json(objections);
    } catch (err: any) {
      apiError(res, err);
    }
  });

  app.post('/api/objections', (req: Request, res: Response) => {
    try {
      const { claim_id, title, counter_argument, rival_model, severity, status, reply } = req.body;
      const id = 'obj_' + Date.now().toString(36) + '_' + Math.random().toString(36).slice(2, 6);
      const now = new Date().toISOString();

      const insert = db.prepare(`
        INSERT INTO objections (id, project_id, claim_id, title, counter_argument, rival_model, severity, status, reply, created_at)
        VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
      `);
      insert.run(
        id,
        'proj_journal314_canonical',
        claim_id,
        title,
        counter_argument,
        rival_model,
        severity || 'serious',
        status || 'addressed',
        reply || null,
        now
      );

      // Link objection to claim if exists
      const claim = db.prepare('SELECT objection_ids FROM claims WHERE id = ?').get(claim_id) as any;
      if (claim) {
        let objs: string[] = [];
        try { objs = JSON.parse(claim.objection_ids || '[]'); } catch {}
        if (!objs.includes(id)) {
          objs.push(id);
          db.prepare('UPDATE claims SET objection_ids = ? WHERE id = ?').run(JSON.stringify(objs), claim_id);
        }
      }

      res.status(201).json({ id, title, rival_model });
    } catch (err: any) {
      apiError(res, err);
    }
  });

  // Relations
  app.get('/api/relations', (req: Request, res: Response) => {
    try {
      const relations = db.prepare('SELECT * FROM relations').all();
      res.json(relations);
    } catch (err: any) {
      apiError(res, err);
    }
  });

  // Contradictions
  app.get('/api/contradictions', (req: Request, res: Response) => {
    try {
      const contradictions = db.prepare('SELECT * FROM contradictions').all();
      res.json(contradictions);
    } catch (err: any) {
      apiError(res, err);
    }
  });

  // Mandatory Critical Revisions (CR-01 through CR-12)
  app.get('/api/corrections', (req: Request, res: Response) => {
    try {
      const corrections = db.prepare('SELECT * FROM corrections ORDER BY code ASC').all();
      res.json(corrections);
    } catch (err: any) {
      apiError(res, err);
    }
  });

  // Revisions & Review Decisions
  app.get('/api/revisions', (req: Request, res: Response) => {
    try {
      const revisions = db.prepare('SELECT * FROM revisions ORDER BY created_at DESC').all();
      res.json(revisions);
    } catch (err: any) {
      apiError(res, err);
    }
  });

  app.post('/api/revisions/:id/decide', (req: Request, res: Response) => {
    try {
      const { decision, reviewer_notes } = req.body;
      if (!['accepted', 'rejected'].includes(decision)) return res.status(400).json({ error: 'decision must be accepted or rejected.' });
      const revId = req.params.id as string;
      if (!db.prepare('SELECT id FROM revisions WHERE id = ?').get(revId)) return res.status(404).json({ error: 'Revision not found' });
      const now = new Date().toISOString();

      const updateRev = db.prepare('UPDATE revisions SET status = ? WHERE id = ?');
      updateRev.run(decision, revId);

      const insertDecision = db.prepare(`
        INSERT INTO review_decisions (id, revision_id, decision, reviewer_notes, decided_at)
        VALUES (?, ?, ?, ?, ?)
      `);
      insertDecision.run('dec_' + Date.now().toString(36), revId, decision, reviewer_notes || '', now);

      res.json({ success: true, revision_id: revId, status: decision });
    } catch (err: any) {
      apiError(res, err);
    }
  });

  // Manuscript Sections
  app.get('/api/manuscript', (req: Request, res: Response) => {
    try {
      const chapters = db.prepare('SELECT * FROM manuscript_sections ORDER BY chapter_number ASC').all();
      res.json(chapters.map((ch: any) => ({
        ...ch,
        cross_references: JSON.parse(ch.cross_references || '[]'),
        open_questions: JSON.parse(ch.open_questions || '[]')
      })));
    } catch (err: any) {
      apiError(res, err);
    }
  });

  app.get('/api/manuscript/:num', (req: Request, res: Response) => {
    try {
      const chapter = db.prepare('SELECT * FROM manuscript_sections WHERE chapter_number = ?').get(req.params.num as string) as any;
      if (!chapter) return res.status(404).json({ error: 'Chapter not found' });
      res.json({
        ...chapter,
        cross_references: JSON.parse(chapter.cross_references || '[]'),
        open_questions: JSON.parse(chapter.open_questions || '[]')
      });
    } catch (err: any) {
      apiError(res, err);
    }
  });

  // Full Citation & Constitutional Audit
  app.get('/api/audit', (req: Request, res: Response) => {
    try {
      const report = performAudit();
      res.json(report);
    } catch (err: any) {
      apiError(res, err);
    }
  });

  // Research Loop Jobs
  app.get('/api/jobs', (req: Request, res: Response) => {
    try {
      const jobs = db.prepare('SELECT * FROM research_jobs ORDER BY created_at DESC').all();
      res.json(jobs.map((j: any) => ({
        ...j,
        target_nodes: JSON.parse(j.target_nodes || '[]')
      })));
    } catch (err: any) {
      apiError(res, err);
    }
  });

  app.get('/api/jobs/:id', (req: Request, res: Response) => {
    try {
      const jobId = req.params.id as string;
      const job = db.prepare('SELECT * FROM research_jobs WHERE id = ?').get(jobId) as any;
      if (!job) return res.status(404).json({ error: 'Job not found' });
      const events = db.prepare('SELECT * FROM job_events WHERE job_id = ? ORDER BY timestamp ASC').all(jobId);
      res.json({
        ...job,
        target_nodes: JSON.parse(job.target_nodes || '[]'),
        events: events.map((e: any) => ({
          ...e,
          payload: e.payload ? JSON.parse(e.payload) : null
        }))
      });
    } catch (err: any) {
      apiError(res, err);
    }
  });

  app.post('/api/jobs/run', async (req: Request, res: Response) => {
    try {
      const { focus_area, max_claims } = req.body;
      const initialClaims = (db.prepare('SELECT COUNT(*) as count FROM claims').get() as any)?.count || 0;
      const initialObjections = (db.prepare('SELECT COUNT(*) as count FROM objections').get() as any)?.count || 0;

      let job = db.prepare("SELECT * FROM research_jobs WHERE status IN ('queued', 'running', 'paused') ORDER BY created_at DESC LIMIT 1").get() as any;
      let jobId: string;
      if (!job) {
        jobId = await createResearchJob(
          'proj_journal314_canonical',
          [focus_area || 'all_passages'],
          3,
          36
        );
      } else {
        jobId = job.id;
      }

      const updatedJob = await runResearchLoopStep(jobId);

      const finalClaims = (db.prepare('SELECT COUNT(*) as count FROM claims').get() as any)?.count || 0;
      const finalObjections = (db.prepare('SELECT COUNT(*) as count FROM objections').get() as any)?.count || 0;

      res.json({
        job: {
          ...updatedJob,
          target_nodes: typeof updatedJob.target_nodes === 'string' ? JSON.parse(updatedJob.target_nodes || '[]') : updatedJob.target_nodes,
          cycles_completed: updatedJob.current_cycle,
          total_tokens: JSON.parse(updatedJob.checkpoint_data || '{}').totalTokens || 0,
          summary: `Bounded Cycle ${updatedJob.current_cycle}/${updatedJob.max_cycles} completed with PEC-Ω warrant validation.`
        },
        newClaimsCount: Math.max(0, finalClaims - initialClaims),
        newObjectionsCount: Math.max(0, finalObjections - initialObjections)
      });
    } catch (err: any) {
      apiError(res, err);
    }
  });

  app.post('/api/research/jobs', async (req: Request, res: Response) => {
    try {
      const { targetNodes, maxCycles, maxRequests } = req.body;
      const jobId = await createResearchJob(
        'proj_journal314_canonical',
        targetNodes || ['all_passages'],
        maxCycles ?? 3,
        maxRequests ?? 36
      );
      res.status(201).json({ jobId, status: 'queued' });
    } catch (err: any) {
      apiError(res, err);
    }
  });

  app.get('/api/research/jobs/:id', (req: Request, res: Response) => {
    try {
      const jobId = req.params.id as string;
      const job = db.prepare('SELECT * FROM research_jobs WHERE id = ?').get(jobId) as any;
      if (!job) return res.status(404).json({ error: 'Job not found' });
      const events = db.prepare('SELECT * FROM job_events WHERE job_id = ? ORDER BY timestamp ASC').all(jobId);
      res.json({
        ...job,
        target_nodes: JSON.parse(job.target_nodes || '[]'),
        events: events.map((e: any) => ({
          ...e,
          payload: e.payload ? JSON.parse(e.payload) : null
        }))
      });
    } catch (err: any) {
      apiError(res, err);
    }
  });

  app.post('/api/research/jobs/:id/step', async (req: Request, res: Response) => {
    try {
      const updatedJob = await runResearchLoopStep(req.params.id as string);
      res.json(updatedJob);
    } catch (err: any) {
      apiError(res, err);
    }
  });

  // Hypermap Dialectic Matrix Routes
  app.get('/api/hypermap/tree', (req: Request, res: Response) => {
    try {
      const root = req.query.root as string | undefined;
      const hierarchy = getHypermapHierarchy(root);
      res.json(hierarchy);
    } catch (err: any) {
      apiError(res, err);
    }
  });

  app.get('/api/hypermap/stats', (req: Request, res: Response) => {
    try {
      const stats = getHypermapStats();
      res.json(stats);
    } catch (err: any) {
      apiError(res, err);
    }
  });

  app.get('/api/hypermap/node/:id', (req: Request, res: Response) => {
    try {
      const node = db.prepare('SELECT * FROM hypermap_nodes WHERE id = ?').get(req.params.id as string);
      if (!node) return res.status(404).json({ error: 'Hypermap node not found' });
      res.json(node);
    } catch (err: any) {
      apiError(res, err);
    }
  });

  app.post('/api/hypermap/node', (req: Request, res: Response) => {
    try {
      const { parent_id, root_tree_id, title, node_type, warrant_category, payload_text, epistemic_status, paradox_relation, fidelity_label } = req.body;
      if (!parent_id || !title || !payload_text) {
        return res.status(400).json({ error: 'parent_id, title, and payload_text are required.' });
      }

      const newNode = addHypermapNode({
        parent_id,
        root_tree_id,
        title,
        node_type: node_type || 'claim',
        warrant_category,
        payload_text,
        epistemic_status,
        paradox_relation,
        fidelity_label
      });

      res.status(201).json(newNode);
    } catch (err: any) {
      apiError(res, err);
    }
  });

  app.put('/api/hypermap/node/:id', (req: Request, res: Response) => {
    try {
      const updated = updateHypermapNode(req.params.id as string, req.body);
      res.json(updated);
    } catch (err: any) {
      apiError(res, err);
    }
  });

  app.delete('/api/hypermap/node/:id', (req: Request, res: Response) => {
    try {
      const result = deleteHypermapNode(req.params.id as string);
      res.json(result);
    } catch (err: any) {
      apiError(res, err);
    }
  });

  app.post('/api/hypermap/densify', async (req: Request, res: Response) => {
    try {
      const { nodeId, strategy } = req.body;
      if (typeof nodeId !== 'string' || !nodeId.trim()) {
        return res.status(400).json({ error: 'nodeId is required for densification.' });
      }

      if (strategy != null && (typeof strategy !== 'string' || strategy.length > 4000)) return res.status(400).json({ error: 'strategy must be text of at most 4,000 characters.' });
      if (!db.prepare('SELECT id FROM hypermap_nodes WHERE id = ?').get(nodeId)) return res.status(404).json({ error: 'Hypermap node not found' });
      const result = await densifyHypermapNode(nodeId, strategy);
      res.json(result);
    } catch (err: any) {
      apiError(res, err);
    }
  });

  // Exports
  app.get('/api/export/bundle', (req: Request, res: Response) => {
    try {
      const bundle = getFullExportBundle();
      res.json(bundle);
    } catch (err: any) {
      apiError(res, err);
    }
  });

  app.get('/api/export/markdown', (req: Request, res: Response) => {
    try {
      const chapters = db.prepare('SELECT * FROM manuscript_sections ORDER BY chapter_number ASC').all() as any[];
      const markdown = generateManuscriptMarkdown(chapters);
      res.setHeader('Content-Type', 'text/markdown');
      res.setHeader('Content-Disposition', 'attachment; filename="nihiltheism_reference_edition_v1.0.md"');
      res.send(markdown);
    } catch (err: any) {
      apiError(res, err);
    }
  });

  app.get('/api/export/zip', async (req: Request, res: Response) => {
    try {
      const zipBuffer = await createExportZip();
      res.setHeader('Content-Type', 'application/zip');
      res.setHeader('Content-Disposition', 'attachment; filename="nihiltheism_architect_release_archive.zip"');
      res.send(zipBuffer);
    } catch (err: any) {
      apiError(res, err);
    }
  });

  // Explicit 404 handler for any unhandled /api routes to prevent falling through to Vite SPA HTML fallback
  app.all('/api/*', (req: Request, res: Response) => {
    res.status(404).json({ error: `API endpoint not found: ${req.method} ${req.originalUrl}` });
  });

  // -------------------------------------------------------------------------
  // VITE MIDDLEWARE SETUP
  // -------------------------------------------------------------------------

  let vite: import('vite').ViteDevServer | undefined;
  if (!production) {
    const { createServer: createViteServer } = await import('vite');
    vite = await createViteServer({
      server: { middlewareMode: true, hmr: false, ws: false },
      appType: 'spa',
    });
    app.use(vite.middlewares);
  } else {
    const distPath = path.join(process.cwd(), 'dist');
    app.use(express.static(distPath));
    app.get('*', (req: Request, res: Response) => {
      res.sendFile(path.join(distPath, 'index.html'));
    });
  }

  app.use((err: any, _req: Request, res: Response, _next: NextFunction) => {
    const status = err.type === 'entity.too.large' ? 413 : err instanceof SyntaxError ? 400 : 500;
    res.status(status).json({ error: status === 413 ? 'Request body exceeds the upload limit.' : status === 400 ? 'Invalid JSON request body.' : 'Internal server error.' });
  });

  return { app, vite };
}

// ---------------------------------------------------------------------------
// ZO PLATFORM BRIDGE
// Express is a node-http request listener, while this platform hosts Bun
// fetch servers (export default { fetch, port }). A loopback node http server
// hosts the Express app, and the fetch handler proxies requests to it,
// forwarding the original Host via x-forwarded-* headers so the app's
// cross-origin write guard keeps working.
// ---------------------------------------------------------------------------
import http from 'node:http';
import config from './zosite.json';

// No top-level await: `bun build --format=cjs` cannot emit it. This shape also
// binds the platform port immediately while the bridge boots in the background;
// requests wait on handlerReady until the Express loopback listener is up.
let handlerReady: Promise<void> | null = null;
let currentHandler: ((request: globalThis.Request) => Promise<globalThis.Response>) | null = null;

async function initBridge(): Promise<void> {
  const { app, vite } = await startServer();
  const bridge = http.createServer((req, res) => { app(req as any, res as any); });
  await new Promise<void>((resolve, reject) => {
    bridge.once('error', reject);
    bridge.listen(0, '127.0.0.1', () => resolve());
  });
  const internalPort = (bridge.address() as import('node:net').AddressInfo).port;
  currentHandler = async (request: globalThis.Request): Promise<globalThis.Response> => {
    const url = new URL(request.url);
    const target = `http://127.0.0.1:${internalPort}${url.pathname}${url.search}`;
    // Headers is an iterable, not a plain record: Object.entries() on it yields
    // nothing and silently drops every client header (breaking JSON bodies and
    // the same-origin guard). Copy through the iterator instead.
    const headers = new Headers();
    for (const [name, value] of request.headers) headers.set(name, value);
    // The Zo platform proxy sets x-forwarded-host/x-forwarded-proto to the real
    // site address; pass those through untouched. Only fill them in for direct
    // local access (dev preview, runtime smoke tests) where no proxy is involved.
    if (!headers.has('x-forwarded-host')) headers.set('x-forwarded-host', url.host);
    if (!headers.has('x-forwarded-proto')) headers.set('x-forwarded-proto', url.protocol === 'https:' ? 'https' : 'http');
    const body = request.method === 'GET' || request.method === 'HEAD' ? undefined : request.body;
    return await fetch(target, { method: request.method, headers, body: body as any, duplex: 'half' } as RequestInit);
  };
}

handlerReady = initBridge();
handlerReady.catch((err) => {
  console.error('Fatal server startup error:', err);
  process.exit(1);
});

const handler = async (request: globalThis.Request): Promise<globalThis.Response> => {
  await handlerReady;
  if (!currentHandler) return new globalThis.Response('Server initializing', { status: 503 });
  return currentHandler(request);
};

const mode = process.env.NODE_ENV === 'production' ? 'production' : 'development';
const portArgIdx = process.argv.indexOf('--port');
const portFromArg = portArgIdx !== -1 && process.argv[portArgIdx + 1] ? parseInt(process.argv[portArgIdx + 1], 10) : NaN;
const port = Number.isInteger(portFromArg)
  ? portFromArg
  : (process.env.PORT ? parseInt(process.env.PORT, 10) : (config?.local_port || 3000));

const hostArgIdx = process.argv.indexOf('--host');
const hostFromArg = hostArgIdx !== -1 && process.argv[hostArgIdx + 1] ? process.argv[hostArgIdx + 1] : undefined;
const host = hostFromArg || process.env.HOST || '0.0.0.0';

export default { fetch: handler, port, hostname: host, idleTimeout: 255 };

// ---------------------------------------------------------------------------
// NODE (NON-BUN) ENTRYPOINT
// Bun auto-serves a module whose default export has a `fetch` handler. Node has
// no such convention, so the CJS bundle produced by `bun run build:server` would
// import cleanly and then serve nothing. When that bundle is executed by Node,
// this adapter binds the same port and translates node requests into the same
// fetch handler, so the bundle is a verified artifact rather than a dead file.
// ---------------------------------------------------------------------------
const isBunRuntime = typeof (globalThis as { Bun?: unknown }).Bun !== 'undefined';
const isNodeEntrypoint = !isBunRuntime
  && typeof process.argv[1] === 'string'
  && /server\.cjs$/.test(process.argv[1]);

if (isNodeEntrypoint) {
  void handlerReady.then(() => {
    const nodeServer = http.createServer((req, res) => {
      void (async () => {
        try {
          const chunks: Buffer[] = [];
          for await (const chunk of req) chunks.push(chunk as Buffer);
          const body = chunks.length > 0 ? Buffer.concat(chunks) : undefined;
          const headers = new Headers();
          for (const [name, value] of Object.entries(req.headers)) {
            if (value === undefined) continue;
            if (Array.isArray(value)) { for (const item of value) headers.append(name, item); }
            else headers.set(name, value);
          }
          const host = req.headers.host || '127.0.0.1';
          const request = new globalThis.Request(`http://${host}${req.url || '/'}`, {
            method: req.method,
            headers,
            body: req.method === 'GET' || req.method === 'HEAD' ? undefined : body
          });
          const response = await handler(request);
          res.statusCode = response.status;
          response.headers.forEach((value, key) => { res.setHeader(key, value); });
          const payload = Buffer.from(await response.arrayBuffer());
          res.end(payload);
        } catch (error) {
          console.error('Request handling failed:', error);
          if (!res.headersSent) {
            res.statusCode = 500;
            res.setHeader('Content-Type', 'application/json');
            res.end(JSON.stringify({ error: 'Internal server error.' }));
          } else {
            res.end();
          }
        }
      })();
    });
    const nodeHost = process.env.HOST || '127.0.0.1';
    nodeServer.listen(port, nodeHost, () => {
      console.log(`Nihiltheism Architect (node bundle): http://${nodeHost}:${port}`);
    });
  }).catch((error) => {
    console.error('Fatal server startup error:', error);
    process.exit(1);
  });
}
