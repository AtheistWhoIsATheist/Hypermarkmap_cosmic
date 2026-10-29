import type {
  SourceSpan,
  NodeCitation,
  SupportedMimeType,
  CanonicalSystemStage,
  CanonicalThematicGroup,
  IngestionProcessingMode,
  EpistemicConfidenceStatus,
  PropositionModality
} from './types/graph';

export type {
  SourceSpan,
  NodeCitation,
  SupportedMimeType,
  CanonicalSystemStage,
  CanonicalThematicGroup,
  IngestionProcessingMode,
  EpistemicConfidenceStatus,
  PropositionModality
};

export interface NodeMetadataRecord {
  label: string;
  value: string | number | boolean;
  category?: 'system' | 'epistemic' | 'relational';
}

export interface EpistemicTopologyNode {
  id: string;
  title: string;
  systemStage?: string;
  thematicGroup?: string;
  description?: string;
  citations?: NodeCitation[];
  metadata?: Record<string, string | number | boolean> | NodeMetadataRecord[];
  connectedNodeIds?: string[];

  // Graph rendering & hierarchical geometry fields
  level?: number;
  type?: 'root' | 'major_hub' | 'category' | 'concept' | 'quote' | 'leaf' | 'paradox' | string;
  color?: string;
  glowColor?: string;
  quoteText?: string;
  author?: string;
  warrant?: 'W0' | 'W1' | 'W2' | 'W3' | 'W4' | 'W5' | string;
  epistemicStatus?: string;
  particleCount?: number;
  radius?: number;
  x?: number;
  y?: number;
  children?: EpistemicTopologyNode[];
  _collapsed?: boolean;

  // Ingestion & Epistemic Traceability fields
  nodeKind?: 'document-hub' | 'section' | 'concept' | 'proposition' | 'passage' | 'unresolved-reference';
  sourceSpans?: SourceSpan[];
  sourceFile?: string;
  processingMode?: IngestionProcessingMode;
  confidenceStatus?: EpistemicConfidenceStatus;
  isIngested?: boolean;
  documentId?: string;
  modality?: PropositionModality;
}

export interface RenderedEpistemicNode extends EpistemicTopologyNode {
  description: string;
  citations: NodeCitation[];
  metadata: NodeMetadataRecord[];
  connectedNodeIds: string[];
}
