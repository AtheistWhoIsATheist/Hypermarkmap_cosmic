/**
 * Ingestion Orchestrator Service (src/services/ingestion/IngestionService.ts)
 * Orchestrates the 16-stage ingestion lifecycle: validation, Web Crypto SHA-256,
 * deduplication, parser strategy dispatch, semantic discrimination, atomic persistence,
 * and reactive progress dispatch.
 */

import type {
  IngestionBatchItem,
  SupportedMimeType,
  GraphNode,
  GraphEdge,
  SourceDocument,
  IngestionProcessingMode
} from '../../types/graph';
import { computeFileSha256, validateFileHeaderAndMime, generateScopedId } from '../../utils/crypto';
import { GraphStorage } from '../../storage/GraphStorage';
import type { FileParser, ParserOptions } from '../parsers/BaseParser';
import { MarkdownParser } from '../parsers/MarkdownParser';
import { TextParser } from '../parsers/TextParser';
import { JsonParser } from '../parsers/JsonParser';
import { CsvParser } from '../parsers/CsvParser';
import { PdfParser } from '../parsers/PdfParser';

export interface IngestionOptions extends ParserOptions {
  processingMode?: IngestionProcessingMode;
}

export class IngestionService {
  private parsers: FileParser[] = [
    new MarkdownParser(),
    new TextParser(),
    new JsonParser(),
    new CsvParser(),
    new PdfParser()
  ];

  /**
   * Dispatches parser strategy based on MIME type and file extension
   */
  private selectParser(mimeType: string, fileName: string): FileParser {
    const ext = `.${fileName.split('.').pop()?.toLowerCase() || ''}`;
    for (const parser of this.parsers) {
      if (parser.canHandle(mimeType, ext)) {
        return parser;
      }
    }
    // Default fallback to TextParser
    return this.parsers[1];
  }

  /**
   * Processes a single file through the 16-stage ingestion pipeline
   */
  public async ingestFile(
    file: File,
    options: IngestionOptions = {}
  ): Promise<IngestionBatchItem> {
    const fileId = generateScopedId('doc', Date.now().toString(), file.name);

    const batchItem: IngestionBatchItem = {
      id: fileId,
      fileName: file.name,
      fileSize: file.size,
      mimeType: file.type || 'text/plain',
      status: 'processing',
      stageLabel: 'Validating format & size guardrails',
      processingMode: options.processingMode || 'STRUCTURALLY_INGESTED',
      warnings: []
    };

    try {
      // Step 1: File Validation (Size check, MIME detection, Magic bytes)
      const validation = await validateFileHeaderAndMime(file);
      if (!validation.isValid) {
        batchItem.status = 'error';
        batchItem.errorMessage = validation.error || 'File validation failed.';
        return batchItem;
      }

      batchItem.mimeType = validation.detectedMime;
      batchItem.stageLabel = 'Computing SHA-256 fingerprint';
      // Yield to microtask queue
      await new Promise(r => setTimeout(r, 0));

      // Step 2: Cryptographic Hashing
      const hash = await computeFileSha256(file);
      batchItem.hash = hash;

      // Step 3: Deduplication Check
      const alreadyIngested = await GraphStorage.hasFileHash(hash);
      if (alreadyIngested) {
        batchItem.status = 'duplicate';
        batchItem.stageLabel = 'Identical file already ingested (SHA-256 match)';
        batchItem.summary = `File '${file.name}' matches an existing fingerprint in the knowledge graph. Skipped duplicate re-ingestion.`;
        return batchItem;
      }

      // Step 4: Parser Strategy Dispatch
      batchItem.stageLabel = 'Parsing document structure';
      await new Promise(r => setTimeout(r, 0));

      const parser = this.selectParser(batchItem.mimeType, file.name);
      const parsedPayload = await parser.parse(file, hash, options);

      // Step 5: Semantic Discrimination & Philosophical Anchoring
      batchItem.stageLabel = 'Grounding philosophical coordinates & baseline relata';
      await new Promise(r => setTimeout(r, 0));

      const nodes = parsedPayload.nodes;
      const edges = parsedPayload.edges;

      // Ensure processing mode is labeled on all nodes
      const mode = options.processingMode || 'STRUCTURALLY_INGESTED';
      for (const n of nodes) {
        n.processingMode = mode;
      }

      // Step 6: Baseline Grounding Links (connect section/thematic concepts to baseline hubs)
      this.groundToBaselineTopology(nodes, edges, hash);

      // Step 7: Atomic Persistence to IndexedDB
      batchItem.stageLabel = 'Committing atomic IndexedDB transaction';
      await new Promise(r => setTimeout(r, 0));

      const docRecord: SourceDocument = {
        id: nodes[0]?.id || fileId,
        hash,
        fileName: file.name,
        fileSize: file.size,
        mimeType: validation.detectedMime,
        createdAt: Date.now(),
        updatedAt: Date.now(),
        versionCount: 1,
        sectionsCount: nodes.filter(n => n.nodeKind === 'section').length,
        spansCount: nodes.reduce((sum, n) => sum + (n.sourceSpans?.length || 0), 0),
        summary: parsedPayload.summary,
        processingMode: mode
      };

      await GraphStorage.commitBatchExtraction(hash, nodes, edges, docRecord);

      // Step 8: Success State
      batchItem.status = 'success';
      batchItem.stageLabel = 'Ingestion complete & graph committed';
      batchItem.extractedNodes = nodes;
      batchItem.extractedEdges = edges;
      batchItem.summary = parsedPayload.summary;

      return batchItem;
    } catch (err: unknown) {
      batchItem.status = 'error';
      const msg = err instanceof Error ? err.message : 'Unknown ingestion error';
      batchItem.errorMessage = msg;
      batchItem.stageLabel = 'Failed';
      return batchItem;
    }
  }

  /**
   * Deterministically links newly extracted thematic nodes to corresponding baseline topology hubs
   * (e.g. Nihilistic Pivot -> mm_orientation; Apophatic Dynamics -> mm_knowledge_engine)
   */
  private groundToBaselineTopology(
    nodes: GraphNode[],
    edges: GraphEdge[],
    fileHash: string
  ): void {
    for (const node of nodes) {
      if (node.nodeKind === 'document-hub') continue;

      let targetBaselineId: string | null = null;
      let relationType = 'parallels';

      if (node.thematicGroup === 'Nihilistic Pivot') {
        targetBaselineId = 'mm_orientation';
        relationType = 'develops';
      } else if (node.thematicGroup === 'Apophatic Dynamics') {
        targetBaselineId = 'mm_apophatic_theology';
        relationType = 'articulates';
      } else if (node.thematicGroup === 'Phenomenological Void') {
        targetBaselineId = 'mm_phenomenological_bracketting';
        relationType = 'develops';
      } else if (node.thematicGroup === 'Historical Lineage') {
        targetBaselineId = 'mm_figure';
        relationType = 'interprets';
      }

      if (targetBaselineId) {
        const edgeId = generateScopedId('edge', fileHash, `${node.id}_${targetBaselineId}_ground`);
        edges.push({
          id: edgeId,
          source: node.id,
          target: targetBaselineId,
          relationType,
          edgeCategory: 'philosophical',
          confidenceStatus: node.confidenceStatus || 'strongly-supported-inference',
          label: relationType,
          weight: 0.7
        });
        if (!node.connectedNodeIds.includes(targetBaselineId)) {
          node.connectedNodeIds.push(targetBaselineId);
        }
      }
    }
  }

  /**
   * Processes a batch of files sequentially to guarantee memory containment and isolated error handling
   */
  public async processBatch(
    files: File[],
    onProgress?: (index: number, total: number, item: IngestionBatchItem) => void,
    options?: IngestionOptions
  ): Promise<IngestionBatchItem[]> {
    const results: IngestionBatchItem[] = [];
    const total = files.length;

    for (let i = 0; i < total; i++) {
      const file = files[i];
      // Yield to UI between files
      await new Promise(r => setTimeout(r, 0));

      const item = await this.ingestFile(file, options);
      results.push(item);

      if (onProgress) {
        onProgress(i, total, item);
      }
    }

    return results;
  }
}

export const ingestionService = new IngestionService();

/**
 * Canonical modal invocation function matching the contract:
 * const results = await processIngestionBatch(files, (idx, total, item) => { ... });
 */
export async function processIngestionBatch(
  files: File[],
  onProgress?: (index: number, total: number, item: IngestionBatchItem) => void,
  options?: IngestionOptions
): Promise<IngestionBatchItem[]> {
  return ingestionService.processBatch(files, onProgress, options);
}
