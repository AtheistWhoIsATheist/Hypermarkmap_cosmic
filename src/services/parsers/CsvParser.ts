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
import { BaseParser, type FileParser, type ParserOptions } from './BaseParser';

export class CsvParser extends BaseParser implements FileParser {
  canHandle(mimeType: string, extension: string): boolean {
    const ext = extension.toLowerCase();
    return ext === '.csv' || mimeType === 'text/csv' || mimeType === 'application/csv';
  }

  /**
   * RFC-4180 compliant CSV line tokenizer
   */
  private parseCsvRows(text: string): string[][] {
    const rows: string[][] = [];
    let currentRow: string[] = [];
    let currentCell = '';
    let inQuotes = false;
    let i = 0;

    while (i < text.length) {
      const char = text[i];
      const nextChar = text[i + 1];

      if (inQuotes) {
        if (char === '"' && nextChar === '"') {
          // Escaped quote: "" -> "
          currentCell += '"';
          i += 2;
          continue;
        } else if (char === '"') {
          // Closing quote
          inQuotes = false;
          i++;
          continue;
        } else {
          currentCell += char;
          i++;
          continue;
        }
      } else {
        if (char === '"') {
          // Opening quote
          inQuotes = true;
          i++;
          continue;
        } else if (char === ',') {
          currentRow.push(currentCell.trim());
          currentCell = '';
          i++;
          continue;
        } else if (char === '\r') {
          if (nextChar === '\n') i++;
          currentRow.push(currentCell.trim());
          rows.push(currentRow);
          currentRow = [];
          currentCell = '';
          i++;
          continue;
        } else if (char === '\n') {
          currentRow.push(currentCell.trim());
          rows.push(currentRow);
          currentRow = [];
          currentCell = '';
          i++;
          continue;
        } else {
          currentCell += char;
          i++;
          continue;
        }
      }
    }

    if (currentCell.length > 0 || currentRow.length > 0) {
      currentRow.push(currentCell.trim());
      rows.push(currentRow);
    }

    // Filter out completely empty rows
    return rows.filter(r => r.some(c => c.length > 0));
  }

  async parse(file: File, fileHash: string, _options?: ParserOptions): Promise<ParsedPayload> {
    const rawText = await file.text();
    const docId = generateScopedId('doc', fileHash, file.name);
    const fileName = file.name;
    const docTitle = fileName.replace(/\.[^/.]+$/, '').replace(/[-_]/g, ' ');

    const rows = this.parseCsvRows(rawText);
    if (rows.length === 0) {
      throw new Error(`CSV file '${fileName}' is empty.`);
    }

    const headers = rows[0].map(h => h.trim());
    const dataRows = rows.slice(1);

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
      'text/csv',
      docTitle,
      `Tabular Dataset: ${docTitle} (${dataRows.length} records, ${headers.length} columns)`,
      rawText
    );
    addNode(docHub);

    // Check if this CSV is an edge/relational table (contains source and target columns)
    const isEdgeTable = headers.some(h => /^(source|from|origin)/i.test(h)) && headers.some(h => /^(target|to|dest)/i.test(h));
    if (isEdgeTable) {
      const srcIdx = headers.findIndex(h => /^(source|from|origin)/i.test(h));
      const targetIdx = headers.findIndex(h => /^(target|to|dest)/i.test(h));
      const relIdx = headers.findIndex(h => /^(relation|relationship|predicate|rel|type)/i.test(h));
      const catIdx = headers.findIndex(h => /^(category|edge_category)/i.test(h));

      for (let rIdx = 0; rIdx < dataRows.length; rIdx++) {
        const row = dataRows[rIdx];
        const s = row[srcIdx]?.trim();
        const t = row[targetIdx]?.trim();
        const rel = (relIdx !== -1 ? row[relIdx]?.trim() : 'relates') || 'relates';
        const cat = (catIdx !== -1 ? row[catIdx]?.trim() : 'philosophical') || 'philosophical';
        if (!s || !t) continue;

        if (!seenNodeIds.has(s)) {
          const sSpan = this.createSourceSpan(docId, fileHash, fileName, s, 0, s.length, [docTitle, s], rIdx + 2, rIdx + 2);
          addNode(this.createEpistemicNode(docId, fileHash, fileName, 'text/csv', s, s, 'concept', `Node: ${s}`, sSpan, 'Stage V: Praxis & Epistemic Synthesis', 'Epistemic Architecture', 'source-explicit'));
        }
        if (!seenNodeIds.has(t)) {
          const tSpan = this.createSourceSpan(docId, fileHash, fileName, t, 0, t.length, [docTitle, t], rIdx + 2, rIdx + 2);
          addNode(this.createEpistemicNode(docId, fileHash, fileName, 'text/csv', t, t, 'concept', `Node: ${t}`, tSpan, 'Stage V: Praxis & Epistemic Synthesis', 'Epistemic Architecture', 'source-explicit'));
        }

        const edgeId = generateScopedId('edge', fileHash, `${s}_${t}_${rIdx}`);
        edges.push({
          id: edgeId,
          source: s,
          target: t,
          relationType: rel,
          edgeCategory: cat === 'proposed' ? 'proposed' : cat === 'structural' ? 'structural' : 'philosophical',
          confidenceStatus: cat === 'proposed' ? 'tentative-interpretation' : 'strongly-supported-inference',
          label: rel,
          weight: 0.8
        });
      }

      return {
        documentId: docId,
        fileHash,
        nodes,
        edges,
        sourceSpans: [],
        summary: `Imported ${edges.length} graph edges from CSV table '${fileName}'.`
      };
    }

    // Identify primary title/label column, category column, and description column
    let titleColIdx = headers.findIndex(h => /^(title|name|label|concept|term|topic)/i.test(h));
    if (titleColIdx === -1) titleColIdx = 0;

    const categoryColIdx = headers.findIndex(h => /^(category|stage|group|type|theme|class)/i.test(h));
    const descColIdx = headers.findIndex(h => /^(description|desc|content|definition|summary|text|notes)/i.test(h));

    // Map of Category -> Category Hub Node ID
    const categoryHubMap = new Map<string, string>();

    for (let rIdx = 0; rIdx < dataRows.length; rIdx++) {
      const row = dataRows[rIdx];
      const rowNum = rIdx + 2; // 1-indexed row number in CSV

      const rowTitle = row[titleColIdx] || `Row ${rIdx + 1}`;
      const rawCategory = categoryColIdx !== -1 && row[categoryColIdx] ? row[categoryColIdx] : 'General';
      const rowDesc = descColIdx !== -1 && row[descColIdx] ? row[descColIdx] : row.map((val, idx) => `${headers[idx] || `Col ${idx + 1}`}: ${val}`).join('; ');

      const rowTextVerbatim = row.join(',');
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
        addNode(catNode);

        // Edge: Document Hub contains Category Hub
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

      // Create Entity Node for row
      const entityId = generateScopedId('concept', fileHash, `row_${rIdx}_${rowTitle}`);
      const rowMetadata: Record<string, string | number | boolean> = {
        csvRowNumber: rowNum,
        documentId: docId
      };
      headers.forEach((h, hIdx) => {
        if (row[hIdx] !== undefined) {
          rowMetadata[h] = row[hIdx];
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
      addNode(entityNode);

      // Edge: Category Hub contains Entity
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
      summary: `Parsed CSV dataset '${docTitle}': ${dataRows.length} entities in ${categoryHubMap.size} category hubs.`
    };
  }
}
