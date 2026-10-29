/**
 * Production-Grade Markdown & Wikilink Parser (.md, .markdown)
 * Extracts YAML frontmatter, ATX heading hierarchies (ignoring code fences),
 * paragraphs, verbatim blockquotes (with strict third-party attribution checks),
 * and [[Wikilinks]] into structured GraphNode and GraphEdge entities.
 */

import type {
  ParsedPayload,
  GraphNode,
  GraphEdge,
  SourceSpan
} from '../../types/graph';
import { generateScopedId, sanitizeDisplayText } from '../../utils/crypto';
import { BaseParser, type FileParser, type ParserOptions } from './BaseParser';

export class MarkdownParser extends BaseParser implements FileParser {
  canHandle(mimeType: string, extension: string): boolean {
    const ext = extension.toLowerCase();
    return ext === '.md' || ext === '.markdown' || mimeType === 'text/markdown';
  }

  async parse(file: File, fileHash: string, _options?: ParserOptions): Promise<ParsedPayload> {
    const rawText = await file.text();
    const docId = generateScopedId('doc', fileHash, file.name);
    const fileName = file.name;

    const nodes: GraphNode[] = [];
    const edges: GraphEdge[] = [];
    const seenNodeIds = new Set<string>();

    const addNode = (n: GraphNode) => {
      if (!seenNodeIds.has(n.id)) {
        seenNodeIds.add(n.id);
        nodes.push(n);
      }
    };

    // 1. Extract YAML Frontmatter if present
    let contentText = rawText;
    let frontmatter: Record<string, string> = {};
    const frontmatterMatch = rawText.match(/^---\r?\n([\s\S]*?)\r?\n---\r?\n/);
    if (frontmatterMatch) {
      const yamlStr = frontmatterMatch[1];
      contentText = rawText.substring(frontmatterMatch[0].length);
      yamlStr.split(/\r?\n/).forEach(line => {
        const colonIdx = line.indexOf(':');
        if (colonIdx > 0) {
          const key = line.substring(0, colonIdx).trim();
          const val = line.substring(colonIdx + 1).trim().replace(/^['"]|['"]$/g, '');
          if (key) frontmatter[key] = val;
        }
      });
    }

    const docTitle = frontmatter.title || fileName.replace(/\.[^/.]+$/, '').replace(/[-_]/g, ' ');
    const docHub = this.createDocumentHubNode(
      docId,
      fileHash,
      fileName,
      'text/markdown',
      docTitle,
      frontmatter.description || `Markdown manuscript: ${docTitle}`,
      rawText
    );
    if (Object.keys(frontmatter).length > 0) {
      Object.assign(docHub.metadata, frontmatter);
      if (frontmatter.stage) docHub.systemStage = frontmatter.stage as any;
      if (frontmatter.group) docHub.thematicGroup = frontmatter.group as any;
    }
    addNode(docHub);

    // 2. Parse lines with code fence tracking
    const lines = contentText.split(/\r?\n/);
    let inCodeFence = false;

    // Track active heading hierarchy
    // stack of { level, title, nodeId }
    const headingStack: Array<{ level: number; title: string; nodeId: string }> = [
      { level: 0, title: docTitle, nodeId: docId }
    ];

    let currentHeadingPath: string[] = [docTitle];
    let currentCharOffset = frontmatterMatch ? frontmatterMatch[0].length : 0;

    // Buffer for accumulating multi-line paragraphs or blockquotes
    let currentBlockType: 'none' | 'paragraph' | 'blockquote' = 'none';
    let currentBlockLines: string[] = [];
    let blockStartChar = 0;
    let blockStartLine = 0;

    const flushBlock = () => {
      if (currentBlockLines.length === 0) return;

      const fullBlockText = currentBlockLines.join('\n');
      const trimmedText = fullBlockText.trim();
      const endChar = blockStartChar + fullBlockText.length;
      const endLine = blockStartLine + currentBlockLines.length - 1;

      if (trimmedText.length > 0) {
        if (currentBlockType === 'blockquote') {
          // Process blockquote
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
            fullBlockText,
            blockStartChar,
            endChar,
            [...currentHeadingPath],
            blockStartLine,
            endLine
          );

          const classification = this.classifyExcerpt(quoteText, currentHeadingPath);
          const parentHeadingNode = headingStack[headingStack.length - 1];

          const quoteNode = this.createEpistemicNode(
            docId,
            fileHash,
            fileName,
            'text/markdown',
            quoteText.substring(0, 60) + (quoteText.length > 60 ? '...' : ''),
            quoteText.length > 80 ? `${quoteText.substring(0, 77)}...` : quoteText,
            'proposition',
            quoteText,
            span,
            classification.stage,
            classification.group,
            classification.confidence,
            'phenomenological-description',
            author,
            isAttributedThirdPartyQuote
          );
          addNode(quoteNode);

          // Also attach citation to parent section
          const parentNodeObj = nodes.find(n => n.id === parentHeadingNode.nodeId);
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
        } else if (currentBlockType === 'paragraph') {
          // Process paragraph
          const span = this.createSourceSpan(
            docId,
            fileHash,
            fileName,
            fullBlockText,
            blockStartChar,
            endChar,
            [...currentHeadingPath],
            blockStartLine,
            endLine
          );

          // Check if paragraph contains significant proposition or philosophical statement
          const classification = this.classifyExcerpt(trimmedText, currentHeadingPath);
          const parentHeadingNode = headingStack[headingStack.length - 1];

          // If text is meaningful, create proposition or passage
          if (trimmedText.length >= 25) {
            const label = trimmedText.split('.')[0].substring(0, 60).trim();
            const propNode = this.createEpistemicNode(
              docId,
              fileHash,
              fileName,
              'text/markdown',
              label,
              label,
              'proposition',
              trimmedText,
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
          }

          // Check for [[Wikilinks]] within paragraph
          const wikilinkMatches = trimmedText.matchAll(/\[\[([^\]|]+)(?:\|([^\]]+))?\]\]/g);
          for (const wMatch of wikilinkMatches) {
            const target = wMatch[1].trim();
            const alias = wMatch[2]?.trim() || target;
            const refId = generateScopedId('concept', fileHash, `wikilink_${target.toLowerCase()}`);

            // Unresolved [[Wikilink]] becomes nodeKind: 'unresolved-reference' rather than fabricated concept
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
        }
      }

      currentBlockLines = [];
      currentBlockType = 'none';
    };

    for (let lineIdx = 0; lineIdx < lines.length; lineIdx++) {
      const line = lines[lineIdx];
      const trimmed = line.trim();
      const lineStartChar = currentCharOffset;
      const lineEndChar = lineStartChar + line.length;

      // Check code fences
      if (trimmed.startsWith('```') || trimmed.startsWith('~~~')) {
        flushBlock();
        inCodeFence = !inCodeFence;
        currentCharOffset += line.length + 1; // +1 for newline
        continue;
      }

      if (inCodeFence) {
        currentCharOffset += line.length + 1;
        continue;
      }

      // Check ATX Heading (only when not in code fence)
      const atxMatch = line.match(/^(#{1,6})\s+(.+)$/);
      if (atxMatch) {
        flushBlock();
        const level = atxMatch[1].length;
        const headingTitle = atxMatch[2].trim().replace(/\s*#+\s*$/, ''); // Strip optional trailing hashes

        // Adjust heading stack
        while (headingStack.length > 1 && headingStack[headingStack.length - 1].level >= level) {
          headingStack.pop();
        }

        const parentNode = headingStack[headingStack.length - 1];
        currentHeadingPath = headingStack.map(h => h.title).concat(headingTitle);

        const span = this.createSourceSpan(
          docId,
          fileHash,
          fileName,
          line,
          lineStartChar,
          lineEndChar,
          [...currentHeadingPath],
          lineIdx + 1,
          lineIdx + 1
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
        addNode(sectionNode);

        // Structural edge: parent contains section
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
        currentCharOffset += line.length + 1;
        continue;
      }

      // Check Blockquote
      if (trimmed.startsWith('>')) {
        if (currentBlockType !== 'blockquote') {
          flushBlock();
          currentBlockType = 'blockquote';
          blockStartChar = lineStartChar;
          blockStartLine = lineIdx + 1;
        }
        currentBlockLines.push(line);
        currentCharOffset += line.length + 1;
        continue;
      }

      // Empty line separates blocks
      if (trimmed === '') {
        flushBlock();
        currentCharOffset += line.length + 1;
        continue;
      }

      // Regular Paragraph line
      if (currentBlockType !== 'paragraph') {
        flushBlock();
        currentBlockType = 'paragraph';
        blockStartChar = lineStartChar;
        blockStartLine = lineIdx + 1;
      }
      currentBlockLines.push(line);
      currentCharOffset += line.length + 1;
    }

    // Flush any remaining trailing block
    flushBlock();

    // Populate connectedNodeIds for all extracted nodes
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
      summary: `Parsed Markdown manuscript '${docTitle}': ${nodes.length} nodes, ${edges.length} edges.`,
      extractedMetadata: frontmatter
    };
  }
}
