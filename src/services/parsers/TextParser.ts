/**
 * Plaintext Parser (.txt)
 * Normalizes CRLF/LF and UTF-8 BOM, detects outline and chapter boundaries,
 * implements bounded O(1) memory slice streaming, adaptive node budgeting
 * (MAX_NODES_PER_DOCUMENT = 2500), and cooperative multitasking yields.
 */

import type {
  ParsedPayload,
  GraphNode,
  GraphEdge
} from '../../types/graph';
import { generateScopedId, sanitizeDisplayText } from '../../utils/crypto';
import {
  BaseParser,
  type FileParser,
  type ParserOptions,
  yieldToMain,
  streamFileLines
} from './BaseParser';

export const MAX_NODES_PER_DOCUMENT = 2500;
export const MAX_NODE_TEXT_CHARS = 2000;

export class TextParser extends BaseParser implements FileParser {
  canHandle(mimeType: string, extension: string): boolean {
    const ext = extension.toLowerCase();
    return ext === '.txt' || mimeType.startsWith('text/plain');
  }

  async parse(file: File, fileHash: string, options?: ParserOptions): Promise<ParsedPayload> {
    const docId = generateScopedId('doc', fileHash, file.name);
    const fileName = file.name;
    const docTitle = fileName.replace(/\.[^/.]+$/, '').replace(/[-_]/g, ' ');
    const isLargeFile = file.size > 2 * 1024 * 1024; // > 2 MB streams via slices

    const nodes: GraphNode[] = [];
    const edges: GraphEdge[] = [];
    const seenNodeIds = new Set<string>();

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
        return true;
      }
      return true;
    };

    const docHub = this.createDocumentHubNode(
      docId,
      fileHash,
      fileName,
      'text/plain',
      docTitle,
      `Plaintext philosophical transcript: ${docTitle}`,
      ''
    );
    addNode(docHub);

    // Section header pattern:
    // e.g., "Chapter 1: The Void", "CHAPTER I", "§1. The Phenomenological Pivot", "1. Introduction", "I. Nothingness"
    const sectionHeaderRegex = /^(?:(?:Chapter|CHAPTER|Section|SECTION|Part|PART|Book|BOOK)\s+[0-9IVXLCDM]+[:.]?|§\s*[0-9]+[:.]?|[0-9IVXLCDM]+\.\s+[A-Z])\s*(.*)$/i;

    let activeSectionId = docId;
    let activeHeadingPath = [docTitle];
    const activeSectionLevel = 1;

    let charOffset = 0;
    let currentParagraphLines: string[] = [];
    let pStartChar = 0;
    let pStartLine = 1;
    let lineCounter = 0;
    let aggregatedParagraphCount = 0;

    const flushParagraph = () => {
      if (currentParagraphLines.length === 0) return;
      const text = currentParagraphLines.join('\n').trim();
      const pLength = currentParagraphLines.join('\n').length;
      const pEndChar = pStartChar + pLength;
      const pEndLine = pStartLine + currentParagraphLines.length - 1;

      if (text.length >= 25) {
        const span = this.createSourceSpan(
          docId,
          fileHash,
          fileName,
          text.substring(0, MAX_NODE_TEXT_CHARS),
          pStartChar,
          pEndChar,
          [...activeHeadingPath],
          pStartLine,
          pEndLine
        );

        if (nodes.length < MAX_NODES_PER_DOCUMENT) {
          const classification = this.classifyExcerpt(text, activeHeadingPath);
          const label = text.split('.')[0].substring(0, 60).trim();

          // Modality & Confidence detection
          let modality: 'objection' | 'question' | 'assertion' | 'phenomenological-description' = 'assertion';
          let confidence = classification.confidence;
          const lower = text.toLowerCase();
          if (lower.startsWith('objection:') || lower.includes('against this it may be objected')) {
            modality = 'objection';
            confidence = 'strongly-supported-inference';
          } else if (text.endsWith('?')) {
            modality = 'question';
            confidence = 'tentative-interpretation';
          } else if (
            lower.includes('tentative') ||
            lower.includes('hypothesized') ||
            lower.includes('perhaps') ||
            lower.includes('hypothetical')
          ) {
            confidence = 'tentative-interpretation';
          } else if (
            lower.includes('assert') ||
            lower.includes('certainty') ||
            lower.includes('explicitly') ||
            lower.includes('axiom')
          ) {
            confidence = 'source-explicit';
          } else if (lower.includes('phenomenologically') || lower.includes('disclosed in experience')) {
            modality = 'phenomenological-description';
            confidence = 'source-explicit';
          }

          const propNode = this.createEpistemicNode(
            docId,
            fileHash,
            fileName,
            'text/plain',
            label,
            label,
            'proposition',
            text.substring(0, MAX_NODE_TEXT_CHARS),
            span,
            classification.stage,
            classification.group,
            confidence,
            modality
          );
          addNode(propNode);

          edges.push(
            this.createEdge(
              fileHash,
              activeSectionId,
              propNode.id,
              modality === 'objection' ? 'criticizes' : 'contains',
              'structural',
              'source-explicit',
              span.spanId
            )
          );
        } else {
          aggregatedParagraphCount++;
          const secNode = nodes.find((n) => n.id === activeSectionId);
          if (secNode) {
            secNode.metadata.aggregatedParagraphs =
              (Number(secNode.metadata.aggregatedParagraphs) || 0) + 1;
          }
        }
      }

      currentParagraphLines = [];
    };

    const processLine = (rawLine: string) => {
      lineCounter++;
      // Strip UTF-8 BOM on first line if present
      const line = lineCounter === 1 ? rawLine.replace(/^\uFEFF/, '') : rawLine;
      const trimmed = line.trim();
      const lineStartChar = charOffset;
      const lineEndChar = lineStartChar + line.length;

      // Check for outline or section header
      const headerMatch = trimmed.match(sectionHeaderRegex);
      if (headerMatch && trimmed.length < 120) {
        flushParagraph();
        const headerTitle = trimmed;
        activeHeadingPath = [docTitle, headerTitle];

        const span = this.createSourceSpan(
          docId,
          fileHash,
          fileName,
          line,
          lineStartChar,
          lineEndChar,
          [...activeHeadingPath],
          lineCounter,
          lineCounter
        );

        const classification = this.classifyExcerpt(headerTitle, activeHeadingPath);
        const secNode = this.createSectionNode(
          docId,
          fileHash,
          fileName,
          'text/plain',
          headerTitle,
          [...activeHeadingPath],
          activeSectionLevel,
          span,
          classification.stage,
          classification.group
        );

        if (addNode(secNode)) {
          edges.push(
            this.createEdge(
              fileHash,
              docId,
              secNode.id,
              'contains',
              'structural',
              'source-explicit',
              span.spanId
            )
          );
          activeSectionId = secNode.id;
        }

        charOffset += line.length + 1;
        return;
      }

      // Empty line breaks paragraphs
      if (trimmed === '') {
        flushParagraph();
        charOffset += line.length + 1;
        return;
      }

      if (currentParagraphLines.length === 0) {
        pStartChar = lineStartChar;
        pStartLine = lineCounter;
      }
      currentParagraphLines.push(line);
      charOffset += line.length + 1;

      // Auto-flush long continuous paragraphs
      if (currentParagraphLines.length >= 25) {
        flushParagraph();
      }
    };

    if (isLargeFile) {
      options?.onProgress?.('Streaming plaintext (0%)...', 0);
      await streamFileLines(
        file,
        async (linesBatch, bytesRead, totalBytes) => {
          const pct = Math.round((bytesRead / totalBytes) * 100);
          options?.onProgress?.(`Streaming plaintext (${pct}%)...`, bytesRead / totalBytes);

          for (const line of linesBatch) {
            processLine(line);
          }
          await yieldToMain();
        },
        2 * 1024 * 1024
      );
    } else {
      options?.onProgress?.('Reading document text...', 0.05);
      await yieldToMain();
      const rawContent = await file.text();
      const lines = rawContent.replace(/\r\n/g, '\n').split('\n');
      const total = lines.length;

      for (let i = 0; i < total; i++) {
        processLine(lines[i]);
        if (i % 100 === 0 && i > 0) {
          const pct = Math.round((i / total) * 100);
          options?.onProgress?.(`Parsing plaintext (${pct}%)...`, i / total);
          await yieldToMain();
        }
      }
    }

    flushParagraph();

    // Link connectedNodeIds
    const nodeMap = new Map<string, GraphNode>();
    for (const node of nodes) {
      nodeMap.set(node.id, node);
    }
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

    let summaryText = `Parsed Plaintext transcript '${docTitle}': ${nodes.length} nodes, ${edges.length} edges.`;
    if (aggregatedParagraphCount > 0) {
      summaryText += ` (${aggregatedParagraphCount} paragraphs aggregated under parent sections).`;
    }

    return {
      nodes,
      edges,
      rawTextLength: charOffset,
      summary: summaryText
    };
  }
}
