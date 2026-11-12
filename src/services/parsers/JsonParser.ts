/**
 * Structured JSON Parser (.json)
 * Parses graph payloads { nodes, edges }, concept collections, and arbitrary hierarchical objects.
 * Guarantees isolated per-file rejection for malformed JSON without corrupting prior state.
 */

import type {
  ParsedPayload,
  GraphNode,
  GraphEdge
} from '../../types/graph';
import { generateScopedId, sanitizeDisplayText } from '../../utils/crypto';
import { BaseParser, type FileParser, type ParserOptions, yieldToMain } from './BaseParser';

export const MAX_NODES_PER_DOCUMENT = 2500;
export const MAX_NODE_TEXT_CHARS = 2000;
const DANGEROUS_KEYS = new Set(['__proto__', 'constructor', 'prototype']);

export class JsonParser extends BaseParser implements FileParser {
  canHandle(mimeType: string, extension: string): boolean {
    const ext = extension.toLowerCase();
    return ext === '.json' || mimeType === 'application/json';
  }

  async parse(file: File, fileHash: string, options?: ParserOptions): Promise<ParsedPayload> {
    if (options?.signal?.aborted) {
      throw new Error('JSON parsing aborted due to timeout or cancellation.');
    }
    const rawText = await file.text();
    const docId = generateScopedId('doc', fileHash, file.name);
    const fileName = file.name;
    const docTitle = fileName.replace(/\.[^/.]+$/, '').replace(/[-_]/g, ' ');

    let parsedData: unknown;
    try {
      parsedData = JSON.parse(rawText);
    } catch (err: unknown) {
      const message = err instanceof Error ? err.message : 'Invalid JSON syntax';
      throw new Error(`JSON parse error in '${fileName}': ${message}`);
    }

    const nodes: GraphNode[] = [];
    const edges: GraphEdge[] = [];
    const seenNodeIds = new Set<string>();
    const nodeMap = new Map<string, GraphNode>();

    const addNode = (n: GraphNode): boolean => {
      if (nodes.length >= MAX_NODES_PER_DOCUMENT) {
        return false;
      }
      if (!seenNodeIds.has(n.id)) {
        seenNodeIds.add(n.id);
        if (n.content && n.content.length > MAX_NODE_TEXT_CHARS) {
          n.content = n.content.substring(0, MAX_NODE_TEXT_CHARS) + '… [truncated]';
        }
        if (n.description && n.description.length > MAX_NODE_TEXT_CHARS) {
          n.description = n.description.substring(0, MAX_NODE_TEXT_CHARS) + '… [truncated]';
        }
        nodes.push(n);
        nodeMap.set(n.id, n);
        return true;
      }
      return true;
    };

    const docHub = this.createDocumentHubNode(
      docId,
      fileHash,
      fileName,
      'application/json',
      docTitle,
      `JSON Document Structure: ${docTitle}`,
      rawText
    );
    addNode(docHub);

    // Case 1: Explicit Graph Schema { nodes: [...], edges: [...] }
    if (
      parsedData &&
      typeof parsedData === 'object' &&
      'nodes' in (parsedData as Record<string, unknown>) &&
      Array.isArray((parsedData as Record<string, unknown>).nodes)
    ) {
      const inputObj = parsedData as { nodes: unknown[]; edges?: unknown[] };
      const rawNodes = inputObj.nodes;
      const rawEdges = Array.isArray(inputObj.edges) ? inputObj.edges : [];

      const idMap = new Map<string, string>();

      for (let i = 0; i < rawNodes.length && nodes.length < MAX_NODES_PER_DOCUMENT; i++) {
        if (i % 200 === 0 && i > 0) {
          if (options?.signal?.aborted) throw new Error('JSON parsing aborted.');
          options?.onProgress?.(`Parsing JSON nodes (${Math.round((i / rawNodes.length) * 100)}%)...`);
          await yieldToMain();
        }
        const rawItem = rawNodes[i];
        if (!rawItem || typeof rawItem !== 'object') continue;
        const item = rawItem as Record<string, unknown>;
        const origId =
          item.id !== undefined && item.id !== null && String(item.id).trim() !== ''
            ? String(item.id)
            : `node_${i}`;
        const title = String(item.title ?? item.label ?? item.name ?? `Node ${i + 1}`) || `Node ${i + 1}`;
        const description = String(item.description ?? item.content ?? title) || title;
        const classification = this.classifyExcerpt(`${title} ${description}`);

        const scopedNodeId = generateScopedId('concept', fileHash, origId);
        idMap.set(origId, scopedNodeId);

        const span = this.createSourceSpan(
          docId,
          fileHash,
          fileName,
          JSON.stringify(item, null, 2).substring(0, MAX_NODE_TEXT_CHARS),
          0,
          0,
          [docTitle, title]
        );

        const graphNode: GraphNode = {
          id: scopedNodeId,
          hash: fileHash,
          label: title,
          title,
          nodeKind: (item.nodeKind as any) || 'concept',
          sourceFile: fileName,
          mimeType: 'application/json',
          content: sanitizeDisplayText(description),
          description: sanitizeDisplayText(description),
          systemStage: (item.systemStage as any) || classification.stage,
          thematicGroup: (item.thematicGroup as any) || classification.group,
          processingMode: 'STRUCTURALLY_INGESTED',
          confidenceStatus: (item.confidenceStatus as any) || 'source-explicit',
          sourceSpans: [span],
          citations: [
            {
              id: generateScopedId('cit', fileHash, `json_${scopedNodeId}`),
              sourceTitle: `${fileName} (item ${i + 1})`,
              quoteSnippet: description.substring(0, 160)
            }
          ],
          metadata: {
            originalId: origId,
            documentId: docId
          },
          connectedNodeIds: [docId],
          createdAt: Date.now(),
          type: 'concept',
          color: '#38bdf8',
          glowColor: '#0284c7',
          radius: 12,
          particleCount: 14,
          isIngested: true,
          documentId: docId
        };
        if (addNode(graphNode)) {
          // Edge from Document Hub to node
          edges.push(
            this.createEdge(
              fileHash,
              docId,
              graphNode.id,
              'contains',
              'structural',
              'source-explicit',
              span.spanId
            )
          );
        }
      }

      // Process explicit edges
      for (let i = 0; i < rawEdges.length; i++) {
        if (i % 500 === 0 && i > 0) {
          if (options?.signal?.aborted) throw new Error('JSON parsing aborted.');
          await yieldToMain();
        }
        const e = rawEdges[i];
        if (typeof e === 'object' && e !== null) {
          const edgeObj = e as Record<string, unknown>;
          const rawSourceVal =
            edgeObj.source !== undefined && edgeObj.source !== null && String(edgeObj.source) !== ''
              ? edgeObj.source
              : edgeObj.from;
          const rawTargetVal =
            edgeObj.target !== undefined && edgeObj.target !== null && String(edgeObj.target) !== ''
              ? edgeObj.target
              : edgeObj.to;
          const rawSource =
            rawSourceVal !== undefined && rawSourceVal !== null ? String(rawSourceVal) : '';
          const rawTarget =
            rawTargetVal !== undefined && rawTargetVal !== null ? String(rawTargetVal) : '';
          const mappedSource = idMap.get(rawSource);
          const mappedTarget = idMap.get(rawTarget);

          if (mappedSource && mappedTarget) {
            edges.push(
              this.createEdge(
                fileHash,
                mappedSource,
                mappedTarget,
                String(edgeObj.relationType || edgeObj.type || edgeObj.relation || 'relates_to'),
                (edgeObj.edgeCategory as any) || 'philosophical',
                'source-explicit',
                undefined,
                edgeObj.label ? String(edgeObj.label) : undefined
              )
            );
          }
        }
      }
    }
    // Case 2: Array of objects (e.g. concept collections)
    else if (Array.isArray(parsedData)) {
      for (let i = 0; i < parsedData.length && nodes.length < MAX_NODES_PER_DOCUMENT; i++) {
        if (i % 200 === 0 && i > 0) {
          if (options?.signal?.aborted) throw new Error('JSON parsing aborted.');
          options?.onProgress?.(`Parsing JSON records (${Math.round((i / parsedData.length) * 100)}%)...`);
          await yieldToMain();
        }
        const item = parsedData[i];
        if (typeof item === 'object' && item !== null) {
          const record = item as Record<string, unknown>;
          const title = String(record.title || record.name || record.label || `Record ${i + 1}`);
          const desc = String(record.description || record.text || record.summary || JSON.stringify(record));
          const classification = this.classifyExcerpt(`${title} ${desc}`);

          const span = this.createSourceSpan(
            docId,
            fileHash,
            fileName,
            JSON.stringify(record, null, 2).substring(0, MAX_NODE_TEXT_CHARS),
            0,
            0,
            [docTitle, title]
          );

          const node = this.createEpistemicNode(
            docId,
            fileHash,
            fileName,
            'application/json',
            title,
            title,
            'concept',
            desc,
            span,
            classification.stage,
            classification.group,
            'source-explicit'
          );
          if (addNode(node)) {
            edges.push(
              this.createEdge(
                fileHash,
                docId,
                node.id,
                'contains',
                'structural',
                'source-explicit',
                span.spanId
              )
            );
          }
        }
      }
    }
    // Case 3: Arbitrary object tree
    else if (typeof parsedData === 'object' && parsedData !== null) {
      const rootObj = parsedData as Record<string, unknown>;
      const entries = Object.entries(rootObj);
      for (let i = 0; i < entries.length && nodes.length < MAX_NODES_PER_DOCUMENT; i++) {
        if (i % 200 === 0 && i > 0) {
          if (options?.signal?.aborted) throw new Error('JSON parsing aborted.');
          await yieldToMain();
        }
        const [key, value] = entries[i];
        if (DANGEROUS_KEYS.has(key)) continue;

        const keyTitle = key.replace(/[-_]/g, ' ');
        const valStr = typeof value === 'object' ? JSON.stringify(value, null, 2) : String(value);
        const classification = this.classifyExcerpt(`${keyTitle} ${valStr}`);

        const span = this.createSourceSpan(
          docId,
          fileHash,
          fileName,
          `"${key}": ${valStr}`.substring(0, MAX_NODE_TEXT_CHARS),
          0,
          0,
          [docTitle, keyTitle]
        );

        const node = this.createEpistemicNode(
          docId,
          fileHash,
          fileName,
          'application/json',
          keyTitle,
          keyTitle,
          'concept',
          valStr,
          span,
          classification.stage,
          classification.group,
          'source-explicit'
        );
        if (addNode(node)) {
          edges.push(
            this.createEdge(
              fileHash,
              docId,
              node.id,
              'contains',
              'structural',
              'source-explicit',
              span.spanId
            )
          );
        }
      }
    }

    // Connect node IDs in O(E)
    for (const edge of edges) {
      const srcNode = nodeMap.get(edge.source);
      const tgtNode = nodeMap.get(edge.target);
      if (srcNode && !srcNode.connectedNodeIds.includes(edge.target)) {
        srcNode.connectedNodeIds.push(edge.target);
      }
      if (tgtNode && !tgtNode.connectedNodeIds.includes(edge.source)) {
        tgtNode.connectedNodeIds.push(edge.source);
      }
    }

    return {
      nodes,
      edges,
      rawTextLength: rawText.length,
      summary: `Parsed JSON document '${docTitle}': ${nodes.length} nodes, ${edges.length} edges.`
    };
  }
}
