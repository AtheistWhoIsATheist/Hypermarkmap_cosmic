/**
 * Nihiltheism Knowledge Graph - Ingestion & Epistemic Graph Domain Contracts
 * Reconciles baseline topology compatibility with strict SourceSpan provenance,
 * propositional discrimination, and canonical taxonomic classification.
 */

export type SupportedMimeType =
  | 'text/csv'
  | 'application/json'
  | 'text/markdown'
  | 'application/pdf'
  | 'text/plain';

export type CanonicalSystemStage =
  | 'Stage I: Ontological Groundlessness'
  | 'Stage II: Deconstructive Dissolution'
  | 'Stage III: Apophatic Liminality'
  | 'Stage IV: Transcendent Presence'
  | 'Stage V: Praxis & Epistemic Synthesis'
  | 'Unclassified / Pending Review';

export type CanonicalThematicGroup =
  | 'Nihilistic Pivot'
  | 'Apophatic Dynamics'
  | 'Phenomenological Void'
  | 'Historical Lineage'
  | 'Epistemic Architecture'
  | 'Unclassified / Pending Review';

export type IngestionProcessingMode =
  | 'STRUCTURALLY_INGESTED'
  | 'SEMANTICALLY_ENRICHED';

export type EpistemicConfidenceStatus =
  | 'source-explicit'
  | 'strongly-supported-inference'
  | 'tentative-interpretation'
  | 'unclassified'
  | 'requires-review'
  | 'rejected';

export type ControlledRelationType =
  | 'contains'
  | 'mentions'
  | 'defines'
  | 'articulates'
  | 'develops'
  | 'supports'
  | 'qualifies'
  | 'questions'
  | 'criticizes'
  | 'contradicts'
  | 'contrasts_with'
  | 'parallels'
  | 'presupposes'
  | 'interprets'
  | 'references'
  | 'derived_from';

export type PropositionModality =
  | 'assertion'
  | 'question'
  | 'hypothesis'
  | 'objection'
  | 'qualification'
  | 'negation'
  | 'phenomenological-description'
  | 'metaphysical-commitment';

export interface SourceSpan {
  spanId: string;
  documentId: string;
  versionId: string;
  fileName: string;
  pageNumber?: number;
  headingPath: string[];
  paragraphIndex?: number;
  lineStart?: number;
  lineEnd?: number;
  charStart?: number;
  charEnd?: number;
  locationStatus: 'exact' | 'partial' | 'unavailable';
  verbatimText: string;
}

export interface NodeCitation {
  id: string;
  sourceTitle: string;
  authorOrOrigin?: string;
  referenceUrl?: string;
  quoteSnippet?: string;
  sourceSpanId?: string;
  isAttributedThirdPartyQuote?: boolean;
}

export interface GraphNode {
  id: string;
  hash: string;
  label: string;
  title: string;
  nodeKind?: 'document-hub' | 'section' | 'concept' | 'proposition' | 'passage' | 'unresolved-reference';
  sourceFile: string;
  mimeType: SupportedMimeType;
  content: string;
  description: string;
  systemStage: CanonicalSystemStage;
  thematicGroup: CanonicalThematicGroup;
  secondaryClassifications?: Array<{
    stage?: CanonicalSystemStage;
    group?: CanonicalThematicGroup;
    rationale: string;
  }>;
  processingMode?: IngestionProcessingMode;
  confidenceStatus?: EpistemicConfidenceStatus;
  sourceSpans?: SourceSpan[];
  citations: NodeCitation[];
  metadata: Record<string, string | number | boolean>;
  connectedNodeIds: string[];
  createdAt: number;
  
  // Optional hierarchical & visual properties for topology rendering compatibility
  level?: number;
  type?: 'root' | 'major_hub' | 'category' | 'concept' | 'quote' | 'leaf' | 'paradox' | string;
  color?: string;
  glowColor?: string;
  radius?: number;
  particleCount?: number;
  x?: number;
  y?: number;
  warrant?: string;
  epistemicStatus?: string;
  isIngested?: boolean;
  documentId?: string;
  modality?: PropositionModality;
}

export interface GraphEdge {
  id: string;
  source: string;
  target: string;
  relationType: ControlledRelationType | string;
  edgeCategory?: 'structural' | 'philosophical' | 'proposed';
  confidenceStatus?: EpistemicConfidenceStatus;
  sourceSpanId?: string;
  label?: string;
  weight?: number;
}

export interface ParsedPayload {
  nodes: GraphNode[];
  edges: GraphEdge[];
  rawTextLength?: number;
  summary: string;
  extractedMetadata?: Record<string, unknown>;
  documentId?: string;
  fileHash?: string;
  sourceSpans?: SourceSpan[];
}

export interface IngestionBatchItem {
  id: string;
  fileName: string;
  fileSize: number;
  mimeType: string;
  status: 'processing' | 'success' | 'duplicate' | 'error';
  stageLabel?: string;
  processingMode?: IngestionProcessingMode;
  hash?: string;
  extractedNodes?: GraphNode[];
  extractedEdges?: GraphEdge[];
  summary?: string;
  errorMessage?: string;
  warnings?: string[];
}

export interface SourceDocument {
  id: string;
  hash: string;
  fileName: string;
  fileSize: number;
  mimeType: SupportedMimeType;
  createdAt: number;
  updatedAt: number;
  versionCount: number;
  sectionsCount: number;
  spansCount: number;
  summary?: string;
  processingMode: IngestionProcessingMode;
}

export interface DocumentSection {
  id: string;
  documentId: string;
  headingPath: string[];
  title: string;
  level: number;
  charStart: number;
  charEnd: number;
}

export interface ExtractedPassage {
  id: string;
  documentId: string;
  text: string;
  charStart: number;
  charEnd: number;
  headingPath: string[];
  isBlockquote: boolean;
  author?: string;
  pageNumber?: number;
}

export interface Proposition {
  id: string;
  conceptId?: string;
  text: string;
  modality: PropositionModality;
  confidenceStatus: EpistemicConfidenceStatus;
  sourceSpanId: string;
}

export interface ConceptCandidate {
  id: string;
  label: string;
  description: string;
  systemStage: CanonicalSystemStage;
  thematicGroup: CanonicalThematicGroup;
  confidenceStatus: EpistemicConfidenceStatus;
  sourceSpans: SourceSpan[];
  citations: NodeCitation[];
}

export interface EvidenceRecord {
  id: string;
  claimText: string;
  sourceSpanId: string;
  verbatimQuote: string;
  confidenceStatus: EpistemicConfidenceStatus;
}

export interface ClassificationResult {
  systemStage: CanonicalSystemStage;
  thematicGroup: CanonicalThematicGroup;
  secondaryClassifications: Array<{
    stage?: CanonicalSystemStage;
    group?: CanonicalThematicGroup;
    rationale: string;
  }>;
  confidence: EpistemicConfidenceStatus;
}

export interface IngestionDiagnostic {
  code: string;
  severity: 'warning' | 'error' | 'info';
  message: string;
  spanId?: string;
  fileName?: string;
}

export interface GraphPersistenceSnapshot {
  documents: SourceDocument[];
  nodes: GraphNode[];
  edges: GraphEdge[];
  fileHashes: string[];
  timestamp: number;
}
