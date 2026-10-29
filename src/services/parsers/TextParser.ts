/**
 * Plaintext Parser (.txt)
 * Normalizes CRLF/LF and UTF-8 BOM, detects outline and chapter boundaries,
 * and segments long philosophical discussions with exact character and line offset tracking.
 */

import type {
  ParsedPayload,
  GraphNode,
  GraphEdge
} from '../../types/graph';
import { generateScopedId, sanitizeDisplayText } from '../../utils/crypto';
import { BaseParser, type FileParser, type ParserOptions } from './BaseParser';

export class TextParser extends BaseParser implements FileParser {
  canHandle(mimeType: string, extension: string): boolean {
    const ext = extension.toLowerCase();
    return ext === '.txt' || mimeType.startsWith('text/plain');
  }

  async parse(file: File, fileHash: string, _options?: ParserOptions): Promise<ParsedPayload> {
    const rawContent = await file.text();
    // Strip UTF-8 BOM if present
    const normalizedText = rawContent.replace(/^\uFEFF/, '').replace(/\r\n/g, '\n');
    const docId = generateScopedId('doc', fileHash, file.name);
    const fileName = file.name;
    const docTitle = fileName.replace(/\.[^/.]+$/, '').replace(/[-_]/g, ' ');

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
      'text/plain',
      docTitle,
      `Plaintext philosophical transcript: ${docTitle}`,
      normalizedText
    );
    addNode(docHub);

    // Outline / chapter header pattern:
    // e.g., "Chapter 1: The Void", "CHAPTER I", "§1. The Phenomenological Pivot", "1. Introduction", "I. Nothingness"
    const sectionHeaderRegex = /^(?:(?:Chapter|CHAPTER|Section|SECTION|Part|PART|Book|BOOK)\s+[0-9IVXLCDM]+[:.]?|§\s*[0-9]+[:.]?|[0-9IVXLCDM]+\.\s+[A-Z])\s*(.*)$/i;

    const lines = normalizedText.split('\n');
    let activeSectionId = docId;
    let activeHeadingPath = [docTitle];
    let activeSectionLevel = 1;

    let charOffset = 0;
    let currentParagraphLines: string[] = [];
    let pStartChar = 0;
    let pStartLine = 1;

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
          text,
          pStartChar,
          pEndChar,
          [...activeHeadingPath],
          pStartLine,
          pEndLine
        );

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
        } else if (lower.includes('tentative') || lower.includes('hypothesized') || lower.includes('perhaps') || lower.includes('hypothetical')) {
          confidence = 'tentative-interpretation';
        } else if (lower.includes('assert') || lower.includes('certainty') || lower.includes('explicitly') || lower.includes('axiom')) {
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
          text,
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
      }

      currentParagraphLines = [];
    };

    for (let i = 0; i < lines.length; i++) {
      const line = lines[i];
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
          i + 1,
          i + 1
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
        addNode(secNode);

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
        charOffset += line.length + 1;
        continue;
      }

      // Empty line breaks paragraphs
      if (trimmed === '') {
        flushParagraph();
        charOffset += line.length + 1;
        continue;
      }

      if (currentParagraphLines.length === 0) {
        pStartChar = lineStartChar;
        pStartLine = i + 1;
      }
      currentParagraphLines.push(line);
      charOffset += line.length + 1;
    }

    flushParagraph();

    // Link connectedNodeIds
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
      rawTextLength: normalizedText.length,
      summary: `Parsed Plaintext transcript '${docTitle}': ${nodes.length} nodes, ${edges.length} edges.`
    };
  }
}
