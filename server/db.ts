/**
 * SQLite Database Connection & Schema using Node 22 native node:sqlite
 * Includes FTS5 full text search virtual tables
 */

import { DatabaseSync } from 'node:sqlite';
import path from 'node:path';
import fs from 'node:fs';

const DATA_DIR = path.resolve(process.env.DATA_DIR || path.join(process.cwd(), 'data'));
if (!fs.existsSync(DATA_DIR)) {
  fs.mkdirSync(DATA_DIR, { recursive: true });
}

export const DB_PATH = path.join(DATA_DIR, 'nihiltheism.db');

let _db: DatabaseSync | null = null;

export function getDb(): DatabaseSync {
  if (!_db) {
    _db = new DatabaseSync(DB_PATH);
    _db.exec('PRAGMA foreign_keys = ON;');
    _db.exec('PRAGMA busy_timeout = 5000;');
    _db.exec('PRAGMA journal_mode = WAL;');
    initSchema(_db);
  }
  return _db;
}

export function initSchema(db: DatabaseSync): void {
  db.exec(`
    CREATE TABLE IF NOT EXISTS projects (
      id TEXT PRIMARY KEY,
      name TEXT NOT NULL,
      description TEXT NOT NULL,
      created_at TEXT NOT NULL,
      updated_at TEXT NOT NULL
    );

    CREATE TABLE IF NOT EXISTS sources (
      id TEXT PRIMARY KEY,
      project_id TEXT NOT NULL,
      filename TEXT NOT NULL,
      media_type TEXT NOT NULL,
      sha256_hash TEXT NOT NULL,
      import_timestamp TEXT NOT NULL,
      extraction_method TEXT NOT NULL,
      content_completeness TEXT NOT NULL, -- 'complete', 'partial', 'summary_only'
      extraction_warnings TEXT NOT NULL, -- JSON array
      storage_path TEXT NOT NULL,
      passage_count INTEGER NOT NULL DEFAULT 0,
      FOREIGN KEY (project_id) REFERENCES projects(id) ON DELETE CASCADE
    );

    CREATE TABLE IF NOT EXISTS passages (
      id TEXT PRIMARY KEY,
      source_id TEXT NOT NULL,
      passage_index INTEGER NOT NULL,
      text TEXT NOT NULL,
      page_number INTEGER, -- NULL for summary or when unavailable
      section_heading TEXT,
      char_offset_start INTEGER NOT NULL,
      char_offset_end INTEGER NOT NULL,
      warnings TEXT NOT NULL DEFAULT '[]', -- JSON array
      FOREIGN KEY (source_id) REFERENCES sources(id) ON DELETE CASCADE
    );

    -- Full Text Search virtual table for passages
    CREATE VIRTUAL TABLE IF NOT EXISTS passages_fts USING fts5(
      id UNINDEXED,
      source_id UNINDEXED,
      text,
      section_heading
    );

    CREATE TABLE IF NOT EXISTS concepts (
      id TEXT PRIMARY KEY,
      project_id TEXT NOT NULL,
      name TEXT NOT NULL,
      canonical_term TEXT NOT NULL,
      definition TEXT NOT NULL,
      senses TEXT NOT NULL, -- JSON array of distinguished senses
      thesis TEXT,
      limit_condition TEXT,
      status TEXT NOT NULL, -- STATED, INFERRED, UNCERTAIN, PROPOSED
      tags TEXT NOT NULL DEFAULT '[]', -- JSON array
      created_at TEXT NOT NULL,
      updated_at TEXT NOT NULL,
      FOREIGN KEY (project_id) REFERENCES projects(id) ON DELETE CASCADE
    );

    CREATE TABLE IF NOT EXISTS claims (
      id TEXT PRIMARY KEY,
      project_id TEXT NOT NULL,
      text TEXT NOT NULL,
      claim_type TEXT NOT NULL,
      fidelity_label TEXT NOT NULL,
      source_attributions TEXT NOT NULL DEFAULT '[]', -- JSON array of attributions
      premise_claim_ids TEXT NOT NULL DEFAULT '[]', -- JSON array
      concise_inference_summary TEXT,
      warrant_category TEXT NOT NULL, -- W0 .. W5
      support_status TEXT NOT NULL, -- unreviewed, supported, partial, disputed, unsupported
      objection_ids TEXT NOT NULL DEFAULT '[]', -- JSON array
      revision_status TEXT NOT NULL DEFAULT 'current',
      created_at TEXT NOT NULL,
      updated_at TEXT NOT NULL,
      FOREIGN KEY (project_id) REFERENCES projects(id) ON DELETE CASCADE
    );

    CREATE TABLE IF NOT EXISTS objections (
      id TEXT PRIMARY KEY,
      project_id TEXT NOT NULL,
      claim_id TEXT NOT NULL,
      title TEXT NOT NULL,
      counter_argument TEXT NOT NULL,
      rival_model TEXT NOT NULL,
      severity TEXT NOT NULL,
      status TEXT NOT NULL,
      reply TEXT,
      created_at TEXT NOT NULL,
      FOREIGN KEY (project_id) REFERENCES projects(id) ON DELETE CASCADE
    );

    CREATE TABLE IF NOT EXISTS relations (
      id TEXT PRIMARY KEY,
      project_id TEXT NOT NULL,
      source_entity_id TEXT NOT NULL,
      source_entity_type TEXT NOT NULL,
      relation_type TEXT NOT NULL,
      target_entity_id TEXT NOT NULL,
      target_entity_type TEXT NOT NULL,
      notes TEXT,
      created_at TEXT NOT NULL,
      FOREIGN KEY (project_id) REFERENCES projects(id) ON DELETE CASCADE
    );

    CREATE TABLE IF NOT EXISTS contradictions (
      id TEXT PRIMARY KEY,
      project_id TEXT NOT NULL,
      claim_a_id TEXT NOT NULL,
      claim_b_id TEXT NOT NULL,
      relevant_senses TEXT NOT NULL,
      conflict_type TEXT NOT NULL,
      proposed_resolution TEXT,
      remaining_disagreement TEXT,
      status TEXT NOT NULL DEFAULT 'open',
      created_at TEXT NOT NULL,
      updated_at TEXT NOT NULL,
      FOREIGN KEY (project_id) REFERENCES projects(id) ON DELETE CASCADE
    );

    CREATE TABLE IF NOT EXISTS corrections (
      code TEXT PRIMARY KEY, -- CR-01 .. CR-12
      title TEXT NOT NULL,
      source_assertion TEXT NOT NULL,
      critical_revision TEXT NOT NULL,
      constitutional_rationale TEXT NOT NULL,
      enforced_in_system INTEGER NOT NULL DEFAULT 1
    );

    CREATE TABLE IF NOT EXISTS revisions (
      id TEXT PRIMARY KEY,
      project_id TEXT NOT NULL,
      entity_type TEXT NOT NULL,
      entity_id TEXT NOT NULL,
      original_content TEXT NOT NULL,
      proposed_content TEXT NOT NULL,
      role TEXT NOT NULL, -- analyst, critic, editor
      rationale TEXT NOT NULL,
      status TEXT NOT NULL DEFAULT 'pending',
      created_at TEXT NOT NULL,
      FOREIGN KEY (project_id) REFERENCES projects(id) ON DELETE CASCADE
    );

    CREATE TABLE IF NOT EXISTS review_decisions (
      id TEXT PRIMARY KEY,
      revision_id TEXT NOT NULL,
      decision TEXT NOT NULL, -- accepted, rejected
      reviewer_notes TEXT NOT NULL,
      decided_at TEXT NOT NULL,
      FOREIGN KEY (revision_id) REFERENCES revisions(id) ON DELETE CASCADE
    );

    CREATE TABLE IF NOT EXISTS research_jobs (
      id TEXT PRIMARY KEY,
      project_id TEXT NOT NULL,
      target_nodes TEXT NOT NULL, -- JSON array
      max_cycles INTEGER NOT NULL DEFAULT 3,
      max_requests INTEGER NOT NULL DEFAULT 36,
      current_cycle INTEGER NOT NULL DEFAULT 0,
      requests_executed INTEGER NOT NULL DEFAULT 0,
      status TEXT NOT NULL DEFAULT 'queued',
      candidate_additions INTEGER NOT NULL DEFAULT 0,
      accepted_additions INTEGER NOT NULL DEFAULT 0,
      rejected_additions INTEGER NOT NULL DEFAULT 0,
      duplicate_proposals INTEGER NOT NULL DEFAULT 0,
      checkpoint_data TEXT,
      created_at TEXT NOT NULL,
      updated_at TEXT NOT NULL,
      FOREIGN KEY (project_id) REFERENCES projects(id) ON DELETE CASCADE
    );

    CREATE TABLE IF NOT EXISTS job_events (
      id TEXT PRIMARY KEY,
      job_id TEXT NOT NULL,
      event_type TEXT NOT NULL,
      message TEXT NOT NULL,
      payload TEXT,
      timestamp TEXT NOT NULL,
      FOREIGN KEY (job_id) REFERENCES research_jobs(id) ON DELETE CASCADE
    );

    CREATE TABLE IF NOT EXISTS manuscript_sections (
      id TEXT PRIMARY KEY,
      chapter_number INTEGER NOT NULL UNIQUE,
      title TEXT NOT NULL,
      slug TEXT NOT NULL UNIQUE,
      word_count INTEGER NOT NULL,
      definitions_scope TEXT NOT NULL,
      developed_argument TEXT NOT NULL,
      counterargument TEXT NOT NULL,
      reply_or_revision TEXT NOT NULL,
      epistemic_status TEXT NOT NULL,
      cross_references TEXT NOT NULL DEFAULT '[]',
      open_questions TEXT NOT NULL DEFAULT '[]',
      full_text TEXT NOT NULL,
      updated_at TEXT NOT NULL
    );

    CREATE TABLE IF NOT EXISTS hypermap_nodes (
      id TEXT PRIMARY KEY,
      project_id TEXT NOT NULL,
      parent_id TEXT,
      root_tree_id TEXT NOT NULL,
      title TEXT NOT NULL,
      node_type TEXT NOT NULL,
      warrant_category TEXT,
      payload_text TEXT NOT NULL,
      epistemic_status TEXT NOT NULL DEFAULT 'supported',
      paradox_relation TEXT,
      fidelity_label TEXT DEFAULT 'STATED',
      claim_id TEXT,
      passage_id TEXT,
      order_index INTEGER NOT NULL DEFAULT 0,
      created_at TEXT NOT NULL,
      updated_at TEXT NOT NULL,
      FOREIGN KEY (project_id) REFERENCES projects(id) ON DELETE CASCADE
    );

    CREATE INDEX IF NOT EXISTS idx_hypermap_parent ON hypermap_nodes(parent_id);
    CREATE INDEX IF NOT EXISTS idx_hypermap_root ON hypermap_nodes(root_tree_id);
  `);

  // Auto-clean any abandoned running jobs on startup (Contract Acceptance Criterion A18)
  try {
    const updateAbandoned = db.prepare(`
      UPDATE research_jobs 
      SET status = 'interrupted', updated_at = ? 
      WHERE status = 'running'
    `);
    updateAbandoned.run(new Date().toISOString());
  } catch (err) {
    console.error('Error checking interrupted jobs:', err);
  }
}

export function closeDb(): void {
  _db?.close();
  _db = null;
}
