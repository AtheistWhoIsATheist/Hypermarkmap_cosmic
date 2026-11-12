/**
 * Delimited Table Parser (.csv)
 * RFC-4180 compliant CSV parser handling quoted fields, escaped quotes, embedded commas,
 * and multiline cells. Maps rows to entity nodes and groups them via bounded category hubs
 * rather than creating quadratic all-to-all row edges.
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

export class CsvParser extends BaseParser implements FileParser {
  canHandle(mimeType: string, extension: string): boolean {
    const ext = extension.toLowerCase();
    return ext === '.csv' || mimeType === 'text/csv' || mimeType === 'application/csv';
  }

  /**
   * Streaming RFC-4180 compliant CSV row reader over bounded File.slice windows
   */
  private async streamCsvRows(
    file: File,
    onRows: (rows: string[][], bytesRead: number, totalBytes: number) => Promise<boolean | void> | boolean | void,
    signal?: AbortSignal
  ): Promise<number> {
    const CHUNK_SIZE = 2 * 1024 * 1024;
    const decoder = new TextDecoder('utf-8');
    const totalBytes = file.size;
    let offset = 0;

    let currentRow: string[] = [];
    let currentCell = '';
    let inQuotes = false;
    let prevWasQuoteInQuotes = false;
    let totalChars = 0;

    while (offset < totalBytes) {
      if (signal?.aborted) {
        throw new Error('CSV parsing aborted due to timeout or cancellation.');
      }
      const end = Math.min(offset + CHUNK_SIZE, totalBytes);
      const sliceBuf = await file.slice(offset, end).arrayBuffer();
      const isLastChunk = end >= totalBytes;
      const chunk = decoder.decode(sliceBuf, { stream: !isLastChunk });
      totalChars += chunk.length;

      const batchRows: string[][] = [];
      for (let i = 0; i < chunk.length; i++) {
        const ch = chunk[i];

        if (prevWasQuoteInQuotes) {
          prevWasQuoteInQuotes = false;
          if (ch === '"') {
            currentCell += '"';
            continue;
          }
          inQuotes = false;
          // fall through to unquoted handling of ch
        }

        if (inQuotes) {
          if (ch === '"') {
            prevWasQuoteInQuotes = true;
          } else {
            currentCell += ch;
          }
          continue;
        }

        if (ch === '"') {
          inQuotes = true;
        } else if (ch === ',') {
          currentRow.push(currentCell.trim());
          currentCell = '';
        } else if (ch === '\r') {
          if (i + 1 < chunk.length && chunk[i + 1] === '\n') {
            i++;
          }
          currentRow.push(currentCell.trim());
          if (currentRow.some((c) => c.length > 0)) {
            batchRows.push(currentRow);
          }
          currentRow = [];
          currentCell = '';
        } else if (ch === '\n') {
          if (currentCell.length > 0 || currentRow.length > 0) {
            currentRow.push(currentCell.trim());
            if (currentRow.some((c) => c.length > 0)) {
              batchRows.push(currentRow);
            }
          }
          currentRow = [];
          currentCell = '';
        } else {
          currentCell += ch;
        }
      }

      if (batchRows.length > 0) {
        const shouldContinue = await onRows(batchRows, end, totalBytes);
        if (shouldContinue === false) {
          offset = end;
          return totalChars;
        }
      }

      offset = end;
      await yieldToMain();
    }

    if (prevWasQuoteInQuotes) {
      inQuotes = false;
    }
    if (currentCell.length > 0 || currentRow.length > 0) {
      currentRow.push(currentCell.trim());
      if (currentRow.some((c) => c.length > 0)) {
        await onRows([currentRow], totalBytes, totalBytes);
      }
    }

    return totalChars;
  }

  async parse(file: File, fileHash: string, options?: ParserOptions): Promise<ParsedPayload> {
    const docId = generateScopedId('doc', fileHash, file.name);
    const fileName = file.name;
    const docTitle = fileName.replace(/\.[^/.]+$/, '').replace(/[-_]/g, ' ');

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
      'text/csv',
      docTitle,
      `Tabular Dataset: ${docTitle}`,
      ''
    );
    addNode(docHub);

    let headers: string[] | null = null;
    let isEdgeTable = false;
    let srcIdx = -1;
    let targetIdx = -1;
    let relIdx = -1;
    let catIdx = -1;
    let titleColIdx = 0;
    let categoryColIdx = -1;
    let descColIdx = -1;

    const categoryHubMap = new Map<string, string>();
    const edgeTableEndpointMap = new Map<string, string>();
    let rowCounter = 0;

    const rawChars = await this.streamCsvRows(
      file,
      async (batchRows, bytesRead, totalBytes) => {
        for (const row of batchRows) {
          if (headers === null) {
            headers = row.map((h) => h.trim());
            isEdgeTable =
              headers.some((h) => /^(source|from|origin)/i.test(h)) &&
              headers.some((h) => /^(target|to|dest)/i.test(h));

            if (isEdgeTable) {
              srcIdx = headers.findIndex((h) => /^(source|from|origin)/i.test(h));
              targetIdx = headers.findIndex((h) => /^(target|to|dest)/i.test(h));
              relIdx = headers.findIndex((h) => /^(relation|relationship|predicate|rel|type)/i.test(h));
              catIdx = headers.findIndex((h) => /^(category|edge_category)/i.test(h));
            } else {
              titleColIdx = headers.findIndex((h) => /^(title|name|label|concept|term|topic)/i.test(h));
              if (titleColIdx === -1) titleColIdx = 0;
              categoryColIdx = headers.findIndex((h) => /^(category|stage|group|type|theme|class)/i.test(h));
              descColIdx = headers.findIndex((h) => /^(description|desc|content|definition|summary|text|notes)/i.test(h));
            }
            continue;
          }

          if (nodes.length >= MAX_NODES_PER_DOCUMENT) {
            return false;
          }

          const rIdx = rowCounter++;
          const rowNum = rIdx + 2;

          if (isEdgeTable) {
            const s = row[srcIdx]?.trim();
            const t = row[targetIdx]?.trim();
            const rel = (relIdx !== -1 ? row[relIdx]?.trim() : 'relates') || 'relates';
            const cat = (catIdx !== -1 ? row[catIdx]?.trim() : 'philosophical') || 'philosophical';
            if (!s || !t) continue;

            const resolveEndpoint = (rawId: string): string => {
              if (rawId.startsWith('mm_')) {
                return rawId;
              }
              const existing = edgeTableEndpointMap.get(rawId);
              if (existing) return existing;

              const span = this.createSourceSpan(
                docId,
                fileHash,
                fileName,
                rawId,
                0,
                rawId.length,
                [docTitle, rawId],
                rowNum,
                rowNum
              );
              const cNode = this.createEpistemicNode(
                docId,
                fileHash,
                fileName,
                'text/csv',
                rawId,
                rawId,
                'concept',
                `Node: ${rawId}`,
                span,
                'Stage V: Praxis & Epistemic Synthesis',
                'Epistemic Architecture',
                'source-explicit'
              );
              addNode(cNode);
              edgeTableEndpointMap.set(rawId, cNode.id);
              return cNode.id;
            };

            const resolvedSource = resolveEndpoint(s);
            const resolvedTarget = resolveEndpoint(t);

            const edgeId = generateScopedId('edge', fileHash, `${resolvedSource}_${resolvedTarget}_${rIdx}`);
            edges.push({
              id: edgeId,
              source: resolvedSource,
              target: resolvedTarget,
              relationType: rel,
              edgeCategory: cat === 'proposed' ? 'proposed' : cat === 'structural' ? 'structural' : 'philosophical',
              confidenceStatus: cat === 'proposed' ? 'tentative-interpretation' : 'strongly-supported-inference',
              label: rel,
              weight: 0.8
            });
            continue;
          }

          const rowTitle = row[titleColIdx] || `Row ${rIdx + 1}`;
          const rawCategory = categoryColIdx !== -1 && row[categoryColIdx] ? row[categoryColIdx] : 'General';
          const rowDesc =
            descColIdx !== -1 && row[descColIdx]
              ? row[descColIdx]
              : row.map((val, idx) => `${headers![idx] || `Col ${idx + 1}`}: ${val}`).join('; ');

          const rowTextVerbatim = row.join(',').substring(0, MAX_NODE_TEXT_CHARS);
          const span = this.createSourceSpan(
            docId,
            fileHash,
            fileName,
            rowTextVerbatim,
            0,
            0,
            [docTitle, rawCategory, rowTitle],
            rowNum,
            rowNum
          );

          const classification = this.classifyExcerpt(`${rowTitle} ${rowDesc}`);

          // Ensure Category Hub node exists
          let catHubId = categoryHubMap.get(rawCategory);
          if (!catHubId) {
            catHubId = generateScopedId('sec', fileHash, `cat_${rawCategory}`);
            categoryHubMap.set(rawCategory, catHubId);

            const catNode: GraphNode = {
              id: catHubId,
              hash: fileHash,
              label: rawCategory,
              title: `Category: ${rawCategory}`,
              nodeKind: 'section',
              sourceFile: fileName,
              mimeType: 'text/csv',
              content: `Category grouping '${rawCategory}' from ${fileName}`,
              description: `Category hub aggregating tabular entities belonging to '${rawCategory}'.`,
              systemStage: classification.stage,
              thematicGroup: classification.group,
              processingMode: 'STRUCTURALLY_INGESTED',
              confidenceStatus: 'source-explicit',
              sourceSpans: [],
              citations: [],
              metadata: {
                categoryName: rawCategory,
                documentId: docId
              },
              connectedNodeIds: [docId],
              createdAt: Date.now(),
              type: 'major_hub',
              color: '#38bdf8',
              glowColor: '#0284c7',
              radius: 14,
              particleCount: 16,
              isIngested: true,
              documentId: docId
            };
            if (addNode(catNode)) {
              edges.push(
                this.createEdge(
                  fileHash,
                  docId,
                  catHubId,
                  'contains',
                  'structural',
                  'source-explicit',
                  undefined,
                  'contains category'
                )
              );
            }
          }

          // Create Entity Node for row
          const entityId = generateScopedId('concept', fileHash, `row_${rIdx}_${rowTitle}`);
          const rowMetadata: Record<string, string | number | boolean> = {
            csvRowNumber: rowNum,
            documentId: docId
          };
          headers.forEach((h, hIdx) => {
            if (h && !DANGEROUS_KEYS.has(h) && row[hIdx] !== undefined) {
              rowMetadata[h] = row[hIdx].substring(0, MAX_NODE_TEXT_CHARS);
            }
          });

          const entityNode: GraphNode = {
            id: entityId,
            hash: fileHash,
            label: rowTitle,
            title: rowTitle,
            nodeKind: 'concept',
            sourceFile: fileName,
            mimeType: 'text/csv',
            content: sanitizeDisplayText(rowDesc),
            description: sanitizeDisplayText(rowDesc),
            systemStage: classification.stage,
            thematicGroup: classification.group,
            processingMode: 'STRUCTURALLY_INGESTED',
            confidenceStatus: 'source-explicit',
            sourceSpans: [span],
            citations: [
              {
                id: generateScopedId('cit', fileHash, `csv_${entityId}`),
                sourceTitle: `${fileName} (Row ${rowNum}: ${rowTitle})`,
                quoteSnippet: rowDesc.substring(0, 160)
              }
            ],
            metadata: rowMetadata,
            connectedNodeIds: [catHubId],
            createdAt: Date.now(),
            type: 'concept',
            color: '#00f0ff',
            glowColor: '#0284c7',
            radius: 11,
            particleCount: 12,
            isIngested: true,
            documentId: docId
          };
          if (addNode(entityNode)) {
            edges.push(
              this.createEdge(
                fileHash,
                catHubId,
                entityId,
                'contains',
                'structural',
                'source-explicit',
                span.spanId
              )
            );
          }
        }

        const pct = totalBytes > 0 ? Math.round((bytesRead / totalBytes) * 100) : 100;
        options?.onProgress?.(`Streaming CSV rows (${pct}%)...`, totalBytes > 0 ? bytesRead / totalBytes : 1);
      },
      options?.signal
    );

    if (!headers) {
      throw new Error(`CSV file '${fileName}' is empty.`);
    }
    const headerColumns: string[] = headers;

    docHub.description = sanitizeDisplayText(
      `Tabular Dataset: ${docTitle} (${rowCounter} records, ${headerColumns.length} columns)`
    );

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
      documentId: docId,
      fileHash,
      nodes,
      edges,
      rawTextLength: rawChars,
      summary: isEdgeTable
        ? `Imported ${edges.length} graph edges from CSV table '${fileName}'.`
        : `Parsed CSV dataset '${docTitle}': ${rowCounter} entities in ${categoryHubMap.size} category hubs.`
    };
  }
}
