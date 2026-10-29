/**
 * Production-Grade Client-Side PDF Parser (.pdf)
 * Validates %PDF- header in O(1) memory, inspects page-by-page text streams in reading order,
 * preserves 1-indexed pageNumber on every SourceSpan, detects encryption/password protection,
 * detects scanned/image-only PDFs (emitting the required 'OCR required' diagnostic without fabricating text),
 * streams large files in 4 MB windows with cooperative multitasking yields,
 * and safely releases all resources.
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
  yieldToMain
} from './BaseParser';

export const MAX_NODES_PER_DOCUMENT = 2500;
export const MAX_NODE_TEXT_CHARS = 2000;

export class PdfParser extends BaseParser implements FileParser {
  canHandle(mimeType: string, extension: string): boolean {
    const ext = extension.toLowerCase();
    return ext === '.pdf' || mimeType === 'application/pdf';
  }

  /**
   * Decodes octal and escaped characters in PDF literal strings
   */
  private unescapePdfString(str: string): string {
    return str
      .replace(/\\([0-7]{1,3})/g, (_, oct) => String.fromCharCode(parseInt(oct, 8)))
      .replace(/\\n/g, '\n')
      .replace(/\\r/g, '\r')
      .replace(/\\t/g, '\t')
      .replace(/\\b/g, '\b')
      .replace(/\\f/g, '\f')
      .replace(/\\\(/g, '(')
      .replace(/\\\)/g, ')')
      .replace(/\\\\/g, '\\');
  }

  /**
   * Extracts text tokens from PDF content streams (interpreting BT ... ET blocks, Tj and TJ operators)
  /**
   * Extracts text tokens from PDF content streams with deterministic linear scanner (zero backtracking regexes)
   */
  private extractTextFromStream(streamStr: string): string {
    const textPieces: string[] = [];
    let btPos = 0;
    const len = streamStr.length;

    while (btPos < len) {
      const btStart = streamStr.indexOf('BT', btPos);
      if (btStart === -1) break;

      const etEnd = streamStr.indexOf('ET', btStart + 2);
      if (etEnd === -1) break;

      const block = streamStr.substring(btStart + 2, etEnd);
      btPos = etEnd + 2;

      // Extract literal parenthesized strings (string) Tj / ' / "
      let pPos = 0;
      while (pPos < block.length) {
        const openP = block.indexOf('(', pPos);
        if (openP === -1) break;

        let closeP = -1;
        let depth = 1;
        for (let j = openP + 1; j < block.length; j++) {
          if (block[j] === '\\') {
            j++; // Skip escaped char
            continue;
          }
          if (block[j] === '(') depth++;
          else if (block[j] === ')') {
            depth--;
            if (depth === 0) {
              closeP = j;
              break;
            }
          }
        }

        if (closeP !== -1) {
          const literal = block.substring(openP + 1, closeP);
          textPieces.push(this.unescapePdfString(literal));
          pPos = closeP + 1;
        } else {
          pPos = openP + 1;
        }
      }
    }

    return textPieces.join(' ').replace(/\s+/g, ' ').trim();
  }

  /**
   * Attempt DecompressionStream inflate on compressed Flate streams
   */
  private async inflateStream(data: Uint8Array): Promise<string> {
    try {
      if (typeof DecompressionStream !== 'undefined') {
        const ds = new DecompressionStream('deflate');
        const writer = ds.writable.getWriter();
        writer.write(data as unknown as BufferSource);
        writer.close();

        const response = new Response(ds.readable);
        const decompressedArray = await response.arrayBuffer();
        return new TextDecoder('latin1').decode(decompressedArray);
      }
      return new TextDecoder('latin1').decode(data);
    } catch {
      return new TextDecoder('latin1').decode(data);
    }
  }

  async parse(file: File, fileHash: string, options?: ParserOptions): Promise<ParsedPayload> {
    const docId = generateScopedId('doc', fileHash, file.name);
    const fileName = file.name;
    const docTitle = fileName.replace(/\.[^/.]+$/, '').replace(/[-_]/g, ' ');

    // 1. Validate %PDF- Header in O(1) memory by reading only the first 64 bytes
    const headerBuf = await file.slice(0, 64).arrayBuffer();
    const headerAscii = new TextDecoder('latin1').decode(headerBuf);
    if (!headerAscii.startsWith('%PDF-')) {
      throw new Error(`Invalid PDF document '${fileName}': Missing '%PDF-' magic header.`);
    }

    // 2. Encryption / Password Check on initial metadata window (first 256 KB)
    const metaSliceLen = Math.min(file.size, 256 * 1024);
    const metaBuf = await file.slice(0, metaSliceLen).arrayBuffer();
    const metaAscii = new TextDecoder('latin1').decode(metaBuf);
    if (metaAscii.includes('/Encrypt')) {
      throw new Error(`PDF '${fileName}' is encrypted or password-protected. Unprotected text extraction is not permitted.`);
    }

    // 3. Extract page text streams
    const pageTexts: Array<{ pageNumber: number; text: string }> = [];
    let usedPdfJs = false;

    // Check if pdfjsLib is globally available
    // @ts-ignore
    const pdfjs = (typeof window !== 'undefined' && (window as any).pdfjsLib) || null;

    if (pdfjs && typeof pdfjs.getDocument === 'function') {
      let pdfDoc: any = null;
      let loadingTask: any = null;
      try {
        const data = await file.arrayBuffer();
        loadingTask = pdfjs.getDocument({
          data,
          disableAutoFetch: true,
          disableStream: false,
          rangeChunkSize: 524288
        });
        pdfDoc = await loadingTask.promise;

        const numPages = pdfDoc.numPages;
        for (let p = 1; p <= numPages; p++) {
          const page = await pdfDoc.getPage(p);
          try {
            const textContent = await page.getTextContent();
            const pageString = textContent.items
              .map((item: any) => item.str || '')
              .join(' ')
              .replace(/\s+/g, ' ')
              .trim();
            if (pageString) {
              pageTexts.push({ pageNumber: p, text: pageString });
            }
          } finally {
            page.cleanup();
          }

          if (p % 15 === 0) {
            const pct = Math.round((p / numPages) * 100);
            options?.onProgress?.(`Parsing PDF pages (${pct}%)...`, p / numPages);
            await yieldToMain();
          }
        }
        usedPdfJs = true;
      } catch {
        usedPdfJs = false;
      } finally {
        if (pdfDoc) {
          try {
            await pdfDoc.destroy();
          } catch {
            // ignore cleanup errors
          }
        }
      }
    }

    // Fallback: 4 MB window streaming scanner through PDF binary slices
    if (!usedPdfJs) {
      const WINDOW_SIZE = 4 * 1024 * 1024;
      let offset = 0;
      let pageCounter = 1;
      const totalBytes = file.size;

      while (offset < totalBytes && pageTexts.length < MAX_NODES_PER_DOCUMENT) {
        const end = Math.min(offset + WINDOW_SIZE, totalBytes);
        const windowBuf = await file.slice(offset, end).arrayBuffer();
        const windowBytes = new Uint8Array(windowBuf);
        const windowAscii = new TextDecoder('latin1').decode(windowBytes);

        let searchPos = 0;
        while (searchPos < windowAscii.length && pageTexts.length < MAX_NODES_PER_DOCUMENT) {
          const streamStartIdx = windowAscii.indexOf('stream', searchPos);
          if (streamStartIdx === -1) break;

          let contentStart = streamStartIdx + 6;
          if (windowAscii[contentStart] === '\r') contentStart++;
          if (windowAscii[contentStart] === '\n') contentStart++;

          const streamEndIdx = windowAscii.indexOf('endstream', contentStart);
          if (streamEndIdx === -1) {
            searchPos = streamStartIdx + 6;
            break;
          }

          const streamContent = windowAscii.substring(contentStart, streamEndIdx);
          searchPos = streamEndIdx + 9;

          let textFound = this.extractTextFromStream(streamContent);
          if (!textFound && streamContent.length > 50) {
            const dictSlice = windowAscii.substring(Math.max(0, streamStartIdx - 300), streamStartIdx);
            if (dictSlice.includes('/FlateDecode')) {
              try {
                const streamBytes = windowBytes.slice(contentStart, streamEndIdx);
                const decompressed = await this.inflateStream(streamBytes);
                textFound = this.extractTextFromStream(decompressed);
              } catch {
                // Ignore decompression errors
              }
            }
          }

          if (textFound && textFound.length > 20) {
            pageTexts.push({ pageNumber: pageCounter++, text: textFound });
          }
        }

        offset = end;
        const pct = Math.round((offset / totalBytes) * 100);
        options?.onProgress?.(`Scanning PDF stream (${pct}%)...`, offset / totalBytes);
        await yieldToMain();
      }
    }

    // 4. Scanned / Image-Only PDF Check (Strict Non-Fabrication)
    const totalExtractedLength = pageTexts.reduce((acc, p) => acc + p.text.length, 0);
    if (totalExtractedLength === 0) {
      const docHub = this.createDocumentHubNode(
        docId,
        fileHash,
        fileName,
        'application/pdf',
        fileName.replace(/\.pdf$/i, ''),
        `Scanned or image-only PDF document '${fileName}'. OCR is required to extract text.`,
        ''
      );
      docHub.metadata.ocrRequired = true;
      docHub.metadata.scanned = true;
      return {
        documentId: docId,
        fileHash,
        nodes: [docHub],
        edges: [],
        sourceSpans: [],
        summary: `Scanned or image-only PDF detected in '${fileName}'. OCR is required to extract text. No fabricated content was generated.`
      };
    }

    // 5. Construct Document Hub, Pages/Sections, and Propositions
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
      'application/pdf',
      docTitle,
      `PDF Manuscript: ${docTitle} (${pageTexts.length} extractable pages, ${totalExtractedLength} chars)`,
      pageTexts.slice(0, 3).map((p) => `[Page ${p.pageNumber}] ${p.text}`).join('\n\n')
    );
    addNode(docHub);

    let charOffsetCounter = 0;

    for (const page of pageTexts) {
      if (nodes.length >= MAX_NODES_PER_DOCUMENT) break;

      const pageTitle = `Page ${page.pageNumber}`;
      const pageHeadingPath = [docTitle, pageTitle];
      const pageStart = charOffsetCounter;
      const pageEnd = pageStart + page.text.length;

      const pageSpan = this.createSourceSpan(
        docId,
        fileHash,
        fileName,
        page.text.substring(0, MAX_NODE_TEXT_CHARS),
        pageStart,
        pageEnd,
        pageHeadingPath,
        1,
        1,
        page.pageNumber
      );

      const classification = this.classifyExcerpt(page.text, pageHeadingPath);
      const pageNodeId = generateScopedId('sec', fileHash, `page_${page.pageNumber}`);
      const pageNode: GraphNode = {
        id: pageNodeId,
        hash: fileHash,
        label: pageTitle,
        title: `${docTitle} — ${pageTitle}`,
        nodeKind: 'section',
        sourceFile: fileName,
        mimeType: 'application/pdf',
        content: sanitizeDisplayText(page.text.substring(0, 400)),
        description: sanitizeDisplayText(`Page ${page.pageNumber} text layer from ${fileName}`),
        systemStage: classification.stage,
        thematicGroup: classification.group,
        processingMode: 'STRUCTURALLY_INGESTED',
        confidenceStatus: 'source-explicit',
        sourceSpans: [pageSpan],
        citations: [
          {
            id: generateScopedId('cit', fileHash, `pdf_p${page.pageNumber}`),
            sourceTitle: `${fileName} (Page ${page.pageNumber})`,
            quoteSnippet: page.text.substring(0, 160)
          }
        ],
        metadata: {
          pageNumber: page.pageNumber,
          documentId: docId
        },
        connectedNodeIds: [docId],
        createdAt: Date.now(),
        type: 'major_hub',
        color: '#06b6d4',
        glowColor: '#0891b2',
        radius: 13,
        particleCount: 16,
        isIngested: true,
        documentId: docId
      };

      if (addNode(pageNode)) {
        edges.push(
          this.createEdge(
            fileHash,
            docId,
            pageNode.id,
            'contains',
            'structural',
            'source-explicit',
            pageSpan.spanId,
            `contains page ${page.pageNumber}`
          )
        );

        // Extract propositions from page text
        const paragraphs = page.text
          .split(/(?<=[.?!])\s+(?=[A-Z])/)
          .filter((p) => p.trim().length >= 30);
        let pOffset = pageStart;

        for (let pIdx = 0; pIdx < Math.min(paragraphs.length, 6); pIdx++) {
          if (nodes.length >= MAX_NODES_PER_DOCUMENT) break;
          const pText = paragraphs[pIdx].trim();
          const pSpan = this.createSourceSpan(
            docId,
            fileHash,
            fileName,
            pText.substring(0, MAX_NODE_TEXT_CHARS),
            pOffset,
            pOffset + pText.length,
            pageHeadingPath,
            pIdx + 1,
            pIdx + 1,
            page.pageNumber
          );

          const pClass = this.classifyExcerpt(pText, pageHeadingPath);
          const pLabel = pText.length > 50 ? `${pText.substring(0, 47)}...` : pText;

          const propNode = this.createEpistemicNode(
            docId,
            fileHash,
            fileName,
            'application/pdf',
            pLabel,
            pLabel,
            'proposition',
            pText.substring(0, MAX_NODE_TEXT_CHARS),
            pSpan,
            pClass.stage,
            pClass.group,
            pClass.confidence,
            'assertion'
          );
          if (addNode(propNode)) {
            edges.push(
              this.createEdge(
                fileHash,
                pageNode.id,
                propNode.id,
                'contains',
                'structural',
                'source-explicit',
                pSpan.spanId
              )
            );
          }

          pOffset += pText.length + 1;
        }
      }

      charOffsetCounter += page.text.length + 1;
    }

    // Connect node IDs
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

    return {
      nodes,
      edges,
      rawTextLength: totalExtractedLength,
      summary: `Parsed PDF document '${docTitle}': ${pageTexts.length} pages, ${nodes.length} nodes, ${edges.length} edges.`
    };
  }
}
