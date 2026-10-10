/**
 * Nihiltheism Architect - Shared Data Models & Types
 * Compliant with Build Contract v1.0 & PEC-Ω Constitution
 */

export type ClaimType =
  | 'experiential_report'
  | 'phenomenological_description'
  | 'comparative_interpretation'
  | 'metaphysical_hypothesis'
  | 'normative_commitment'
  | 'methodological_rule'
  | 'historical_claim'
  | 'empirical_claim';

export type FidelityLabel = 'STATED' | 'INFERRED' | 'UNCERTAIN' | 'PROPOSED';

export type WarrantCategory = 'W0' | 'W1' | 'W2' | 'W3' | 'W4' | 'W5';

export type SupportStatus = 'unreviewed' | 'supported' | 'partial' | 'disputed' | 'unsupported';

export type RelationType =
  | 'defines'
  | 'depends_on'
  | 'supports'
  | 'objects_to'
  | 'contradicts'
  | 'analogous_to'
  | 'historically_influences'
  | 'qualifies'
  | 'revises'
  | 'phenomenologically_precedes';

export type ContradictionType = 'logical' | 'semantic' | 'evidential' | 'normative' | 'practical' | 'apparent';

export type ContradictionStatus = 'open' | 'under_review' | 'resolved' | 'accepted_tension';

export type JobStatus = 'queued' | 'running' | 'completed' | 'failed' | 'cancelled' | 'interrupted' | 'paused';

export interface Project {
  id: string;
  name: string;
  description: string;
  created_at: string;
  updated_at: string;
}

export interface Source {
  id: string;
  project_id: string;
  filename: string;
  media_type: string;
  sha256_hash: string;
  import_timestamp: string;
  extraction_method: string;
  content_completeness: 'complete' | 'partial' | 'summary_only';
  extraction_warnings: string[];
  storage_path: string;
  passage_count: number;
}

export interface Passage {
  id: string;
  source_id: string;
  source_filename?: string;
  passage_index: number;
  text: string;
  page_number: number | null; // genuinely available or null (never fabricated)
  section_heading: string | null;
  char_offset_start: number;
  char_offset_end: number;
  warnings: string[];
}

export interface Concept {
  id: string;
  project_id: string;
  name: string;
  canonical_term: string;
  definition: string;
  senses: string[]; // competing senses explicitly distinguished
  thesis?: string;
  limit_condition?: string;
  status: FidelityLabel;
  tags: string[];
  created_at: string;
  updated_at: string;
}

export interface SourceAttribution {
  passage_id: string;
  source_id: string;
  source_name: string;
  quoted_text: string;
  page_number: number | null;
  reference_integrity: boolean; // passage & quote exists
  semantic_support: SupportStatus; // does passage support claim
  review_note?: string;
}

export interface Claim {
  id: string;
  project_id: string;
  text: string;
  claim_type: ClaimType;
  fidelity_label: FidelityLabel;
  source_attributions: SourceAttribution[];
  premise_claim_ids: string[];
  concise_inference_summary: string | null;
  warrant_category: WarrantCategory;
  support_status: SupportStatus;
  objection_ids: string[];
  revision_status: 'current' | 'under_review' | 'superseded';
  created_at: string;
  updated_at: string;
}

export interface Argument {
  id: string;
  project_id: string;
  title: string;
  claim_id: string;
  premises: string[];
  inference_rule: string;
  conclusion: string;
  validity_status: 'valid' | 'invalid' | 'tentative';
  created_at: string;
}

export interface Objection {
  id: string;
  project_id: string;
  claim_id: string;
  title: string;
  counter_argument: string;
  rival_model: string;
  severity: 'fatal' | 'serious' | 'moderate' | 'minor';
  status: 'open' | 'addressed' | 'retained_disagreement';
  reply?: string;
  created_at: string;
}

export interface Relation {
  id: string;
  project_id: string;
  source_entity_id: string;
  source_entity_type: 'concept' | 'claim';
  relation_type: RelationType;
  target_entity_id: string;
  target_entity_type: 'concept' | 'claim';
  notes?: string;
  created_at: string;
}

export interface Contradiction {
  id: string;
  project_id: string;
  claim_a_id: string;
  claim_b_id: string;
  claim_a_text?: string;
  claim_b_text?: string;
  relevant_senses: string;
  conflict_type: ContradictionType;
  proposed_resolution: string | null;
  remaining_disagreement: string | null;
  status: ContradictionStatus;
  created_at: string;
  updated_at: string;
}

export interface Correction {
  code: string; // CR-01 .. CR-12
  title: string;
  source_assertion: string;
  critical_revision: string;
  constitutional_rationale: string;
  enforced_in_system: boolean;
}

export interface Revision {
  id: string;
  project_id: string;
  entity_type: 'claim' | 'concept' | 'section';
  entity_id: string;
  original_content: string;
  proposed_content: string;
  role: 'analyst' | 'critic' | 'editor';
  rationale: string;
  status: 'pending' | 'accepted' | 'rejected';
  created_at: string;
}

export interface ReviewDecision {
  id: string;
  revision_id: string;
  decision: 'accepted' | 'rejected';
  reviewer_notes: string;
  decided_at: string;
}

export interface ResearchJob {
  id: string;
  project_id: string;
  target_nodes: string[];
  max_cycles: number;
  max_requests: number;
  current_cycle: number;
  requests_executed: number;
  status: JobStatus;
  candidate_additions: number;
  accepted_additions: number;
  rejected_additions: number;
  duplicate_proposals: number;
  checkpoint_data: string | null;
  created_at: string;
  updated_at: string;
}

export interface JobEvent {
  id: string;
  job_id: string;
  event_type: 'info' | 'warning' | 'error' | 'checkpoint' | 'phase_start' | 'phase_complete';
  message: string;
  payload?: any;
  timestamp: string;
}

export interface ManuscriptSection {
  id: string;
  chapter_number: number;
  title: string;
  slug: string;
  word_count: number;
  definitions_scope: string;
  developed_argument: string;
  counterargument: string;
  reply_or_revision: string;
  epistemic_status: string;
  cross_references: string[];
  open_questions: string[];
  full_text: string;
  updated_at: string;
}

export interface CitationValidationResult {
  valid: boolean;
  reference_integrity: boolean;
  semantic_support: SupportStatus;
  passage_exists: boolean;
  source_matches: boolean;
  exact_quote_match: boolean;
  normalized_quote_match: boolean;
  stored_quote?: string;
  extracted_passage_slice?: string;
  message: string;
}

export type MandatoryCorrection = Correction;
export type AdversarialObjection = Objection;

export interface AuditReport {
  timestamp: string;
  project_id: string;
  overall_status: 'PASSED' | 'DEFECTS_FOUND';
  metrics: {
    total_claims: number;
    total_attributions: number;
    intact_attributions: number;
    broken_attributions: number;
    unsupported_claims: number;
    total_objections: number;
    total_corrections_enforced: number;
  };
  reference_integrity: {
    status: 'valid' | 'broken';
    broken_references: Array<{ claim_id: string; attribution_index?: number; passage_id?: string; reason: string }>;
  };
  warrant_discipline: {
    w5_closure_violations: Array<{ claim_id: string; text: string; violation: string }>;
    claims_lacking_adversarial_objections: Array<{ claim_id: string; text: string; warrant: string }>;
  };
  mandatory_corrections_compliance: Array<{
    code: string;
    title: string;
    enforced: boolean;
    rationale: string;
  }>;
}

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
  manuscriptChapters: ManuscriptSection[];
}

// ---------------------------------------------------------------------------
// HYPERMAP DIALECTIC MATRIX TYPES
// ---------------------------------------------------------------------------

export type HypermapNodeType =
  | 'root'
  | 'cosmos'
  | 'domain'
  | 'category'
  | 'concept'
  | 'claim'
  | 'paradox'
  | 'objection'
  | 'revision'
  | 'insight'
  | 'citation';

export interface HypermapNode {
  id: string;
  project_id: string;
  parent_id: string | null;
  root_tree_id: 'tree_journal314_phenomenology' | 'tree_pec_omega_dialectic';
  title: string;
  node_type: HypermapNodeType;
  warrant_category?: WarrantCategory;
  payload_text: string;
  epistemic_status: 'directly_attested' | 'strongly_supported' | 'supported' | 'plausible' | 'underdetermined' | 'disputed';
  paradox_relation?: string;
  fidelity_label: 'DIRECT_QUOTE' | 'PARAPHRASE' | 'INFERRED' | 'PROPOSED' | 'STATED';
  claim_id?: string | null;
  passage_id?: string | null;
  order_index: number;
  created_at: string;
  updated_at: string;
}

export interface HypermapTreeNode extends HypermapNode {
  children?: HypermapTreeNode[];
  _collapsed?: boolean;
}

export interface HypermapNodeInput {
  parent_id: string;
  root_tree_id?: 'tree_journal314_phenomenology' | 'tree_pec_omega_dialectic';
  title: string;
  node_type: HypermapNodeType;
  warrant_category?: WarrantCategory;
  payload_text: string;
  epistemic_status?: 'directly_attested' | 'strongly_supported' | 'supported' | 'plausible' | 'underdetermined' | 'disputed';
  paradox_relation?: string;
  fidelity_label?: 'DIRECT_QUOTE' | 'PARAPHRASE' | 'INFERRED' | 'PROPOSED' | 'STATED';
}

export interface HypermapStats {
  totalNodes: number;
  tree1Nodes: number;
  tree2Nodes: number;
  byType: Record<string, number>;
  byWarrant: Record<string, number>;
  byEpistemic: Record<string, number>;
}

export interface HypermapDensifyResult {
  parentNode: HypermapNode;
  newNodes: HypermapNode[];
  totalTreeNodes: number;
  generationMode: 'openrouter' | 'deterministic';
  warning?: string;
}

