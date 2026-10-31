/**
 * Nihiltheism Architect - Topology Export Data Contracts
 * [REF: Export.Contract.PayloadManifest]
 * Strict type specifications for serialized graph topology, manifest metadata,
 * taxonomic breakdowns, and client export configuration options.
 */

import type {
  GraphNode,
  GraphEdge,
  SourceDocument,
  SourceSpan,
  CanonicalSystemStage,
  CanonicalThematicGroup
} from './graph';

export type TopologyExportScope = 'unified' | 'ingested_only' | 'custom_only';

export type TopologyExportFormat = 'beautified' | 'minified';

export interface TopologyExportOptions {
  scope: TopologyExportScope;
  format: TopologyExportFormat;
  includeMetadata: boolean;
  includeSourceSpans: boolean;
  filenamePrefix?: string;
}

export interface EpistemicTaxonomyMetrics {
  stageBreakdown: Record<CanonicalSystemStage | string, number>;
  thematicBreakdown: Record<CanonicalThematicGroup | string, number>;
  nodeKindBreakdown: Record<string, number>;
  edgeRelationBreakdown: Record<string, number>;
}

export interface TopologyExportManifest {
  schemaVersion: string;
  generator: string;
  exportedAt: string;
  exportTimestampMs: number;
  scope: TopologyExportScope;
  format: TopologyExportFormat;
  nodeCount: number;
  edgeCount: number;
  documentCount: number;
  sourceSpanCount: number;
  taxonomicMetrics: EpistemicTaxonomyMetrics;
  checksumSha256?: string;
}

export interface TopologyExportPayload {
  manifest: TopologyExportManifest;
  documents: SourceDocument[];
  nodes: GraphNode[];
  edges: GraphEdge[];
  sourceSpans?: SourceSpan[];
}

export interface TopologyExportResult {
  success: boolean;
  filename: string;
  byteSize: number;
  manifest: TopologyExportManifest;
  payload: TopologyExportPayload;
  error?: string;
}
