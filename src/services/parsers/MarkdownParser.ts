/**
 * Production-Grade Streaming Markdown & Wikilink Parser (.md, .markdown)
 * Implements bounded O(1) memory line streaming, cooperative multitasking yields,
 * single-pass O(N) line-by-line state machine (zero backtracking regexes),
 * adaptive node budgeting (MAX_NODES_PER_DOCUMENT = 2500), text truncation (2,000 chars),
 * and zero-length regex guards.
 */

import type {
  ParsedPayload,
  GraphNode,
  GraphEdge,
  SourceSpan
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

export class MarkdownParser extends BaseParser implements FileParser {
  canHandle(mimeType: string, extension: string): boolean {
    const ext = extension.toLowerCase();
    return ext === '.md' || ext === '.markdown' || mimeType === 'text/markdown';
  }

  async parse(file: File, fileHash: string, options?: ParserOptions): Promise<ParsedPayload> {
    const docId = generateScopedId('doc', fileHash, file.name);
    const fileName = file.name;
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
        // Enforce 2,000 char cap on node text excerpts
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

    // State machine tracking across stream chunks
    let frontmatterDone = false;
    let inFrontmatter = false;
    let frontmatterLines: string[] = [];
    let frontmatter: Record<string, string> = {};

    let inCodeFence = false;
    let docTitle = fileName.replace(/\.[^/.]+$/, '').replace(/[-_]/g, ' ');
    let docHubCreated = false;

    // Track active heading hierarchy stack: { level, title, nodeId }
    const headingStack: Array<{ level: number; title: string; nodeId: string }> = [
      { level: 0, title: docTitle, nodeId: docId }
    ];
    let currentHeadingPath: string[] = [docTitle];

    // Block accumulation buffer
    let currentBlockType: 'none' | 'paragraph' | 'blockquote' = 'none';
    let currentBlockLines: string[] = [];
    let blockStartChar = 0;
    let blockStartLine = 1;

    let lineCounter = 0;
    let charOffsetCounter = 0;
    let aggregatedParagraphCount = 0;

    const flushBlock = () => {
      if (currentBlockLines.length === 0) return;

      const fullBlockText = currentBlockLines.join('\n');
      const trimmedText = fullBlockText.trim();
      const endChar = blockStartChar + fullBlockText.length;
      const endLine = blockStartLine + currentBlockLines.length - 1;

      if (trimmedText.length > 0) {
        const parentHeadingNode = headingStack[headingStack.length - 1];

        if (currentBlockType === 'blockquote') {
          // Check for explicit author attribution e.g. "— Author" or "- Author"
          let isAttributedThirdPartyQuote = false;
          let author: string | undefined;
          const cleanedLines: string[] = [];

          for (const bline of currentBlockLines) {
            const rawBline = bline.replace(/^>\s?/, '');
            const attrMatch = rawBline.match(/^[—–-]\s*(.+)$/);
            if (attrMatch) {
              isAttributedThirdPartyQuote = true;
              author = attrMatch[1].trim();
            } else {
              cleanedLines.push(rawBline);
            }
          }

          const quoteText = cleanedLines.join('\n').trim();
          const span = this.createSourceSpan(
            docId,
            fileHash,
            fileName,
            fullBlockText.substring(0, MAX_NODE_TEXT_CHARS),
            blockStartChar,
            endChar,
            [...currentHeadingPath],
            blockStartLine,
            endLine
          );

          const classification = this.classifyExcerpt(quoteText, currentHeadingPath);

          if (nodes.length < MAX_NODES_PER_DOCUMENT) {
            const quoteNode = this.createEpistemicNode(
              docId,
              fileHash,
              fileName,
              'text/markdown',
              quoteText.substring(0, 60) + (quoteText.length > 60 ? '...' : ''),
              quoteText.length > 80 ? `${quoteText.substring(0, 77)}...` : quoteText,
              'proposition',
              quoteText.substring(0, MAX_NODE_TEXT_CHARS),
              span,
              classification.stage,
              classification.group,
              classification.confidence,
              'phenomenological-description',
              author,
              isAttributedThirdPartyQuote
            );
            addNode(quoteNode);

            // Attach citation to parent section
            const parentNodeObj = nodes.find((n) => n.id === parentHeadingNode.nodeId);
            if (parentNodeObj && quoteNode.citations) {
              parentNodeObj.citations = [...quoteNode.citations, ...(parentNodeObj.citations || [])];
            }

            // Edge from section/parent to blockquote
            edges.push(
              this.createEdge(
                fileHash,
                parentHeadingNode.nodeId,
                quoteNode.id,
                'articulates',
                'philosophical',
                'source-explicit',
                span.spanId
              )
            );
          }
        } else if (currentBlockType === 'paragraph') {
          // Process paragraph with adaptive node budgeting
          const span = this.createSourceSpan(
            docId,
            fileHash,
            fileName,
            fullBlockText.substring(0, MAX_NODE_TEXT_CHARS),
            blockStartChar,
            endChar,
            [...currentHeadingPath],
            blockStartLine,
            endLine
          );

          if (trimmedText.length >= 25) {
            if (nodes.length < MAX_NODES_PER_DOCUMENT) {
              const classification = this.classifyExcerpt(trimmedText, currentHeadingPath);
              const label = trimmedText.split('.')[0].substring(0, 60).trim();
              const propNode = this.createEpistemicNode(
                docId,
                fileHash,
                fileName,
                'text/markdown',
                label,
                label,
                'proposition',
                trimmedText.substring(0, MAX_NODE_TEXT_CHARS),
                span,
                classification.stage,
                classification.group,
                classification.confidence,
                'assertion'
              );
              addNode(propNode);

              edges.push(
                this.createEdge(
                  fileHash,
                  parentHeadingNode.nodeId,
                  propNode.id,
                  'contains',
                  'structural',
                  'source-explicit',
                  span.spanId
                )
              );
            } else {
              // Node budget reached: aggregate into parent section summary
              aggregatedParagraphCount++;
              const parentNodeObj = nodes.find((n) => n.id === parentHeadingNode.nodeId);
              if (parentNodeObj) {
                parentNodeObj.metadata.aggregatedParagraphs =
                  (Number(parentNodeObj.metadata.aggregatedParagraphs) || 0) + 1;
              }
            }
          }

          // Wikilink extraction with zero-length loop guards
          const wikilinkRegex = /\[\[([^\]|]+)(?:\|([^\]]+))?\]\]/g;
          let wMatch: RegExpExecArray | null;
          while ((wMatch = wikilinkRegex.exec(trimmedText)) !== null) {
            const target = wMatch[1].trim();
            const alias = wMatch[2]?.trim() || target;
            const refId = generateScopedId('concept', fileHash, `wikilink_${target.toLowerCase()}`);

            if (nodes.length < MAX_NODES_PER_DOCUMENT) {
              const refNode: GraphNode = {
                id: refId,
                hash: fileHash,
                label: alias,
                title: target,
                nodeKind: 'unresolved-reference',
                sourceFile: fileName,
                mimeType: 'text/markdown',
                content: `Referenced via Wikilink [[${target}]] in ${fileName}`,
                description: `Unresolved cross-textual reference to [[${target}]]. Awaiting explicit textual corroboration.`,
                systemStage: 'Unclassified / Pending Review',
                thematicGroup: 'Unclassified / Pending Review',
                processingMode: 'STRUCTURALLY_INGESTED',
                confidenceStatus: 'tentative-interpretation',
                sourceSpans: [span],
                citations: [],
                metadata: {
                  targetWikilink: target,
                  alias,
                  documentId: docId
                },
                connectedNodeIds: [parentHeadingNode.nodeId],
                createdAt: Date.now(),
                type: 'concept',
                color: '#f59e0b',
                glowColor: '#d97706',
                radius: 10,
                particleCount: 10,
                isIngested: true
              };
              addNode(refNode);

              edges.push(
                this.createEdge(
                  fileHash,
                  parentHeadingNode.nodeId,
                  refNode.id,
                  'unresolved-citation',
                  'proposed',
                  'tentative-interpretation',
                  span.spanId,
                  'references [[...]]'
                )
              );
            }

            if (wMatch.index === wikilinkRegex.lastIndex) {
              wikilinkRegex.lastIndex++;
            }
          }
        }
      }

      currentBlockLines = [];
      currentBlockType = 'none';
    };

    const processLine = (line: string) => {
      lineCounter++;
      const trimmed = line.trim();
      const lineStartChar = charOffsetCounter;
      const lineEndChar = lineStartChar + line.length;

      // 1. Process Frontmatter (strictly at the beginning of document)
      if (!frontmatterDone) {
        if (lineCounter === 1 && trimmed === '---') {
          inFrontmatter = true;
          charOffsetCounter += line.length + 1;
          return;
        }
        if (inFrontmatter) {
          if (trimmed === '---') {
            inFrontmatter = false;
            frontmatterDone = true;
            // Parse collected frontmatter lines
            for (const fLine of frontmatterLines) {
              const colonIdx = fLine.indexOf(':');
              if (colonIdx > 0) {
                const key = fLine.substring(0, colonIdx).trim();
                const val = fLine.substring(colonIdx + 1).trim().replace(/^['"]|['"]$/g, '');
                if (key) frontmatter[key] = val;
              }
            }
            if (frontmatter.title) {
              docTitle = frontmatter.title;
              headingStack[0].title = docTitle;
              currentHeadingPath[0] = docTitle;
            }
            charOffsetCounter += line.length + 1;
            return;
          }
          frontmatterLines.push(line);
          charOffsetCounter += line.length + 1;
          return;
        }
        // First line wasn't ---, so frontmatter is not present
        frontmatterDone = true;
      }

      // Ensure root document hub is initialized once frontmatter state is settled
      if (!docHubCreated) {
        const docHub = this.createDocumentHubNode(
          docId,
          fileHash,
          fileName,
          'text/markdown',
          docTitle,
          frontmatter.description || `Markdown manuscript: ${docTitle}`,
          line.substring(0, 1000)
        );
        if (Object.keys(frontmatter).length > 0) {
          Object.assign(docHub.metadata, frontmatter);
          if (frontmatter.stage) docHub.systemStage = frontmatter.stage as any;
          if (frontmatter.group) docHub.thematicGroup = frontmatter.group as any;
        }
        addNode(docHub);
        docHubCreated = true;
      }

      // 2. Check Code Fences
      if (trimmed.startsWith('```') || trimmed.startsWith('~~~')) {
        flushBlock();
        inCodeFence = !inCodeFence;
        charOffsetCounter += line.length + 1;
        return;
      }

      if (inCodeFence) {
        charOffsetCounter += line.length + 1;
        return;
      }

      // 3. Single-pass ATX Heading detection (# to ######)
      const atxMatch = line.match(/^(#{1,6})\s+(.+)$/);
      if (atxMatch) {
        flushBlock();
        const level = atxMatch[1].length;
        const headingTitle = atxMatch[2].trim().replace(/\s*#+\s*$/, '');

        // Pop shallower or equal headings from stack
        while (headingStack.length > 1 && headingStack[headingStack.length - 1].level >= level) {
          headingStack.pop();
        }

        const parentNode = headingStack[headingStack.length - 1];
        currentHeadingPath = headingStack.map((h) => h.title).concat(headingTitle);

        const span = this.createSourceSpan(
          docId,
          fileHash,
          fileName,
          line,
          lineStartChar,
          lineEndChar,
          [...currentHeadingPath],
          lineCounter,
          lineCounter
        );

        const classification = this.classifyExcerpt(headingTitle, currentHeadingPath);
        const sectionNode = this.createSectionNode(
          docId,
          fileHash,
          fileName,
          'text/markdown',
          headingTitle,
          [...currentHeadingPath],
          level,
          span,
          classification.stage,
          classification.group
        );

        if (addNode(sectionNode)) {
          edges.push(
            this.createEdge(
              fileHash,
              parentNode.nodeId,
              sectionNode.id,
              'contains',
              'structural',
              'source-explicit',
              span.spanId
            )
          );
          headingStack.push({ level, title: headingTitle, nodeId: sectionNode.id });
        }

        charOffsetCounter += line.length + 1;
        return;
      }

      // 4. Blockquote detection
      if (trimmed.startsWith('>')) {
        if (currentBlockType !== 'blockquote') {
          flushBlock();
          currentBlockType = 'blockquote';
          blockStartChar = lineStartChar;
          blockStartLine = lineCounter;
        }
        currentBlockLines.push(line);
        charOffsetCounter += line.length + 1;
        return;
      }

      // 5. Empty line separates blocks
      if (trimmed === '') {
        flushBlock();
        charOffsetCounter += line.length + 1;
        return;
      }

      // 6. Regular paragraph lines
      if (currentBlockType !== 'paragraph') {
        flushBlock();
        currentBlockType = 'paragraph';
        blockStartChar = lineStartChar;
        blockStartLine = lineCounter;
      }
      currentBlockLines.push(line);
      charOffsetCounter += line.length + 1;

      // Auto-flush long continuous paragraphs to bound memory and provide granular node coordinates
      if (currentBlockLines.length >= 25) {
        flushBlock();
      }
    };

    // Execute streaming or batch iteration
    if (isLargeFile) {
      options?.onProgress?.('Streaming document lines (0%)...', 0);
      let bytesProcessedSoFar = 0;
      await streamFileLines(
        file,
        async (linesBatch, bytesRead, totalBytes) => {
          bytesProcessedSoFar = bytesRead;
          const pct = Math.round((bytesRead / totalBytes) * 100);
          options?.onProgress?.(`Streaming & parsing structure (${pct}%)...`, bytesRead / totalBytes);

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
      const text = await file.text();
      const lines = text.split(/\r?\n/);
      const total = lines.length;

      for (let i = 0; i < total; i++) {
        processLine(lines[i]);
        if (i % 100 === 0 && i > 0) {
          const pct = Math.round((i / total) * 100);
          options?.onProgress?.(`Parsing structure (${pct}%)...`, i / total);
          await yieldToMain();
        }
      }
    }

    // Flush remaining trailing block
    flushBlock();

    // Ensure docHub node exists even for empty file
    if (!docHubCreated) {
      const docHub = this.createDocumentHubNode(
        docId,
        fileHash,
        fileName,
        'text/markdown',
        docTitle,
        `Markdown manuscript: ${docTitle}`,
        ''
      );
      addNode(docHub);
    }

    // Populate connectedNodeIds efficiently
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

    let summaryText = `Parsed Markdown manuscript '${docTitle}': ${nodes.length} nodes, ${edges.length} edges.`;
    if (aggregatedParagraphCount > 0) {
      summaryText += ` (${aggregatedParagraphCount} paragraphs aggregated under parent section supernodes to conserve node budget).`;
    }

    return {
      nodes,
      edges,
      rawTextLength: charOffsetCounter,
      summary: summaryText,
      extractedMetadata: frontmatter
    };
  }
}
