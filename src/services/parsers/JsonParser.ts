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
import { BaseParser, type FileParser, type ParserOptions } from './BaseParser';

export class JsonParser extends BaseParser implements FileParser {
  canHandle(mimeType: string, extension: string): boolean {
    const ext = extension.toLowerCase();
    return ext === '.json' || mimeType === 'application/json';
  }

  async parse(file: File, fileHash: string, _options?: ParserOptions): Promise<ParsedPayload> {
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

    const addNode = (n: GraphNode) => {
      if (!seenNodeIds.has(n.id)) {
        seenNodeIds.add(n.id);
        nodes.push(n);
      }
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

      for (let i = 0; i < rawNodes.length; i++) {
        const item = rawNodes[i] as Record<string, unknown>;
        const origId = String(item.id || `node_${i}`);
        const title = String(item.title || item.label || item.name || `Node ${i + 1}`);
        const description = String(item.description || item.content || title);
        const classification = this.classifyExcerpt(`${title} ${description}`);

        const scopedNodeId = generateScopedId('concept', fileHash, origId);
        idMap.set(origId, scopedNodeId);

        const span = this.createSourceSpan(
          docId,
          fileHash,
          fileName,
          JSON.stringify(item, null, 2),
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
        addNode(graphNode);

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

      // Process explicit edges
      for (const e of rawEdges) {
        if (typeof e === 'object' && e !== null) {
          const edgeObj = e as Record<string, unknown>;
          const rawSource = String(edgeObj.source || edgeObj.from || '');
          const rawTarget = String(edgeObj.target || edgeObj.to || '');
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
      for (let i = 0; i < parsedData.length; i++) {
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
            JSON.stringify(record, null, 2),
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
          addNode(node);

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
    // Case 3: Arbitrary object tree
    else if (typeof parsedData === 'object' && parsedData !== null) {
      const rootObj = parsedData as Record<string, unknown>;
      for (const [key, value] of Object.entries(rootObj)) {
        const keyTitle = key.replace(/[-_]/g, ' ');
        const valStr = typeof value === 'object' ? JSON.stringify(value, null, 2) : String(value);
        const classification = this.classifyExcerpt(`${keyTitle} ${valStr}`);

        const span = this.createSourceSpan(
          docId,
          fileHash,
          fileName,
          `"${key}": ${valStr}`,
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
        addNode(node);

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

    // Connect node IDs
    for (const edge of edges) {
      const srcNode = nodes.find(n => n.id === edge.source);
      const tgtNode = nodes.find(n => n.id === edge.target);
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
