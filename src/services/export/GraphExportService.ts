/**
 * Graph Export Serialization Engine
 * [REF: Export.Engine.Serialization]
 * [REF: Export.Storage.IndexedDBAdapter]
 * [REF: Export.Contract.PayloadManifest]
 * Extracts graph nodes, edges, documents, and provenance spans from IndexedDB,
 * normalizes baseline and dynamic topologies, validates edge referential integrity,
 * computes taxonomy metrics and SHA-256 digests, and triggers client downloads.
 */

import { GraphStorage } from '../../storage/GraphStorage';
import {
  MARKMAP_EPITEMIC_TOPOLOGY,
  type EpistemicTopologyNode
} from '../../components/GroundedEpistemicTopologyData';
import type {
  GraphNode,
  GraphEdge,
  SourceDocument,
  SourceSpan
} from '../../types/graph';
import type {
  TopologyExportOptions,
  TopologyExportPayload,
  TopologyExportManifest,
  TopologyExportResult,
  EpistemicTaxonomyMetrics
} from '../../types/export';
import {
  triggerBlobDownload,
  computeExportChecksum,
  sanitizeFilename
} from './downloadHelper';

export const SCHEMA_VERSION = '2.0.0';
export const GENERATOR_SIGNATURE = 'Nihiltheism Architect Epistemic Topology Engine';

export const DEFAULT_EXPORT_OPTIONS: TopologyExportOptions = {
  scope: 'unified',
  format: 'beautified',
  includeMetadata: true,
  includeSourceSpans: true,
  filenamePrefix: 'nihiltheism_topology'
};

export class ExportSerializationError extends Error {
  constructor(message: string, public readonly cause?: unknown) {
    super(message);
    this.name = 'ExportSerializationError';
  }
}

export class GraphExportService {
  /**
   * Recursively walks the baseline tree and converts it into flat GraphNode and GraphEdge records
   */
  private static extractBaselineNodesAndEdges(
    root: EpistemicTopologyNode
  ): { nodes: GraphNode[]; edges: GraphEdge[] } {
    const nodes: GraphNode[] = [];
    const edges: GraphEdge[] = [];

    function traverse(current: EpistemicTopologyNode, parentId?: string) {
      const nodeRecord: GraphNode = {
        id: current.id,
        hash: `baseline_${current.id}`,
        label: current.title,
        title: current.title,
        nodeKind: current.nodeKind || (current.id === 'markmap_root' ? 'document-hub' : 'concept'),
        sourceFile: 'GroundedEpistemicTopologyData.ts',
        mimeType: 'text/plain',
        content: current.description || current.title,
        description: current.description || current.title,
        systemStage: (current.systemStage as any) || 'Stage V: Praxis & Epistemic Synthesis',
        thematicGroup: (current.thematicGroup as any) || 'Epistemic Architecture',
        citations: (current.citations || []).map((c, i) =>
          typeof c === 'string'
            ? { id: `cit_${i}`, sourceTitle: 'Journal314 Baseline', quoteSnippet: c }
            : c
        ),
        metadata: Array.isArray(current.metadata)
          ? Object.fromEntries(
              current.metadata.map((m: { label: string; value: string | number | boolean }) => [m.label, m.value])
            )
          : (current.metadata && typeof current.metadata === 'object'
              ? (current.metadata as Record<string, string | number | boolean>)
              : {}),
        connectedNodeIds: current.connectedNodeIds || [],
        createdAt: 1700000000000,
        level: current.level,
        type: current.type,
        color: current.color,
        glowColor: current.glowColor,
        radius: current.radius
      };

      nodes.push(nodeRecord);

      if (parentId) {
        edges.push({
          id: `edge_baseline_${parentId}_to_${current.id}`,
          source: parentId,
          target: current.id,
          relationType: 'contains',
          edgeCategory: 'structural',
          label: 'subsumes',
          weight: 1
        });
      }

      if (current.children) {
        for (const child of current.children) {
          traverse(child, current.id);
        }
      }
    }

    traverse(root);
    return { nodes, edges };
  }

  /**
   * Computes multi-dimensional epistemic metrics for the export manifest
   */
  private static computeTaxonomyMetrics(
    nodes: GraphNode[],
    edges: GraphEdge[]
  ): EpistemicTaxonomyMetrics {
    const stageBreakdown: Record<string, number> = {};
    const thematicBreakdown: Record<string, number> = {};
    const nodeKindBreakdown: Record<string, number> = {};
    const edgeRelationBreakdown: Record<string, number> = {};

    for (const node of nodes) {
      const stage = node.systemStage || 'Unclassified / Pending Review';
      stageBreakdown[stage] = (stageBreakdown[stage] || 0) + 1;

      const group = node.thematicGroup || 'Unclassified / Pending Review';
      thematicBreakdown[group] = (thematicBreakdown[group] || 0) + 1;

      const kind = node.nodeKind || 'concept';
      nodeKindBreakdown[kind] = (nodeKindBreakdown[kind] || 0) + 1;
    }

    for (const edge of edges) {
      const rel = edge.relationType || 'unspecified';
      edgeRelationBreakdown[rel] = (edgeRelationBreakdown[rel] || 0) + 1;
    }

    return {
      stageBreakdown,
      thematicBreakdown,
      nodeKindBreakdown,
      edgeRelationBreakdown
    };
  }

  /**
   * Assembles and normalizes the graph topology payload based on scope and options
   */
  public static async assemblePayload(
    options: TopologyExportOptions
  ): Promise<TopologyExportPayload> {
    // 1. Ensure storage is fully hydrated from IndexedDB
    const snapshot = GraphStorage.getSnapshot();
    const storedNodes = snapshot.nodes;
    const storedEdges = snapshot.edges;
    const storedDocs = snapshot.documents;

    let targetNodes: GraphNode[] = [];
    let targetEdges: GraphEdge[] = [];
    let targetDocs: SourceDocument[] = [];

    if (options.scope === 'unified') {
      // Merge baseline skeleton + dynamic user corpus
      const baseline = this.extractBaselineNodesAndEdges(MARKMAP_EPITEMIC_TOPOLOGY);
      const nodeMap = new Map<string, GraphNode>();

      // Insert baseline first
      for (const n of baseline.nodes) {
        nodeMap.set(n.id, n);
      }
      // Ingested & custom nodes override or append
      for (const n of storedNodes) {
        nodeMap.set(n.id, n);
      }

      targetNodes = Array.from(nodeMap.values());

      const edgeMap = new Map<string, GraphEdge>();
      for (const e of baseline.edges) {
        edgeMap.set(e.id, e);
      }
      for (const e of storedEdges) {
        edgeMap.set(e.id, e);
      }
      targetEdges = Array.from(edgeMap.values());
      targetDocs = storedDocs;
    } else if (options.scope === 'custom_only') {
      targetNodes = storedNodes.filter(
        (n) => n.id.startsWith('node_custom_') || n.sourceFile === 'User Workspace'
      );
      const targetIdSet = new Set(targetNodes.map((n) => n.id));
      targetEdges = storedEdges.filter(
        (e) => targetIdSet.has(e.source) || targetIdSet.has(e.target)
      );
      targetDocs = [];
    } else {
      // 'ingested_only'
      targetNodes = storedNodes;
      targetEdges = storedEdges;
      targetDocs = storedDocs;
    }

    // 2. Strict Referential Integrity: eliminate orphan edges with non-existent source/target
    const validNodeIdSet = new Set(targetNodes.map((n) => n.id));
    targetEdges = targetEdges.filter(
      (e) => validNodeIdSet.has(e.source) && validNodeIdSet.has(e.target)
    );

    // 3. Collect SourceSpans if requested
    let targetSpans: SourceSpan[] | undefined;
    if (options.includeSourceSpans) {
      const spanMap = new Map<string, SourceSpan>();
      for (const n of targetNodes) {
        if (n.sourceSpans) {
          for (const s of n.sourceSpans) {
            spanMap.set(s.spanId, s);
          }
        }
      }
      targetSpans = Array.from(spanMap.values());
    }

    // 4. Filter metadata if excluded
    if (!options.includeMetadata) {
      targetNodes = targetNodes.map((n) => ({
        ...n,
        metadata: {},
        citations: []
      }));
    }

    // 5. Construct Epistemic Taxonomy Metrics
    const taxonomicMetrics = this.computeTaxonomyMetrics(targetNodes, targetEdges);

    const now = Date.now();
    const manifest: TopologyExportManifest = {
      schemaVersion: SCHEMA_VERSION,
      generator: GENERATOR_SIGNATURE,
      exportedAt: new Date(now).toISOString(),
      exportTimestampMs: now,
      scope: options.scope,
      format: options.format,
      nodeCount: targetNodes.length,
      edgeCount: targetEdges.length,
      documentCount: targetDocs.length,
      sourceSpanCount: targetSpans ? targetSpans.length : 0,
      taxonomicMetrics
    };

    return {
      manifest,
      documents: targetDocs,
      nodes: targetNodes,
      edges: targetEdges,
      sourceSpans: targetSpans
    };
  }

  /**
   * Generates manifest preview statistics for rapid UI rendering without full serialization
   */
  public static async getExportPreview(
    options: Partial<TopologyExportOptions> = {}
  ): Promise<TopologyExportManifest> {
    const mergedOptions: TopologyExportOptions = {
      ...DEFAULT_EXPORT_OPTIONS,
      ...options
    };
    const payload = await this.assemblePayload(mergedOptions);
    return payload.manifest;
  }

  /**
   * Serializes the graph topology into a JSON string, computes its checksum,
   * generates a Blob, and triggers a browser download.
   */
  public static async exportTopology(
    options: Partial<TopologyExportOptions> = {}
  ): Promise<TopologyExportResult> {
    const mergedOptions: TopologyExportOptions = {
      ...DEFAULT_EXPORT_OPTIONS,
      ...options
    };

    try {
      const payload = await this.assemblePayload(mergedOptions);

      // Serialize payload to JSON
      const indent = mergedOptions.format === 'beautified' ? 2 : 0;
      let jsonString = JSON.stringify(payload, null, indent);

      // Compute SHA-256 checksum of payload
      const checksum = await computeExportChecksum(jsonString);
      payload.manifest.checksumSha256 = checksum;

      // Re-serialize with checksum populated in manifest
      jsonString = JSON.stringify(payload, null, indent);

      // Construct binary Blob with standard UTF-8 JSON MIME type
      const blob = new Blob([jsonString], { type: 'application/json;charset=utf-8' });
      const byteSize = blob.size;

      // Deterministic timestamped filename
      const timestampIso = new Date(payload.manifest.exportTimestampMs)
        .toISOString()
        .replace(/[:.]/g, '-');
      const prefix = mergedOptions.filenamePrefix || 'nihiltheism_topology';
      const filename = sanitizeFilename(`${prefix}_${mergedOptions.scope}_${timestampIso}.json`);

      // Trigger client browser download
      triggerBlobDownload(blob, filename);

      return {
        success: true,
        filename,
        byteSize,
        manifest: payload.manifest,
        payload
      };
    } catch (err) {
      const msg = err instanceof Error ? err.message : String(err);
      throw new ExportSerializationError(`Graph topology export failed: ${msg}`, err);
    }
  }
}
