/**
 * Base Parser Strategy Interface & Common AST / Text Processing Utilities
 */

import type {
  ParsedPayload,
  GraphNode,
  GraphEdge,
  SourceSpan,
  SupportedMimeType,
  CanonicalSystemStage,
  CanonicalThematicGroup,
  EpistemicConfidenceStatus,
  PropositionModality
} from '../../types/graph';
import { generateScopedId, sanitizeDisplayText } from '../../utils/crypto';

export interface ParserOptions {
  enableAiEnrichment?: boolean;
}

export interface FileParser {
  canHandle(mimeType: string, extension: string): boolean;
  parse(file: File, fileHash: string, options?: ParserOptions): Promise<ParsedPayload>;
}

/**
 * Common text and span processing helper functions
 */
export class BaseParser {
  /**
   * Builds an exact SourceSpan with boundary indices
   */
  protected createSourceSpan(
    docId: string,
    fileHash: string,
    fileName: string,
    verbatimText: string,
    charStart: number,
    charEnd: number,
    headingPath: string[],
    lineStart?: number,
    lineEnd?: number,
    pageNumber?: number,
    paragraphIndex?: number
  ): SourceSpan {
    const spanId = generateScopedId('span', fileHash, `${charStart}_${charEnd}_${headingPath.join('/')}`);
    return {
      spanId,
      documentId: docId,
      versionId: `ver_${fileHash.substring(0, 8)}`,
      fileName,
      pageNumber,
      headingPath,
      paragraphIndex,
      lineStart,
      lineEnd,
      charStart,
      charEnd,
      locationStatus: lineStart !== undefined && charStart !== undefined ? 'exact' : 'partial',
      verbatimText
    };
  }

  /**
   * Creates a canonical Document Hub node
   */
  protected createDocumentHubNode(
    docId: string,
    fileHash: string,
    fileName: string,
    mimeType: SupportedMimeType,
    title: string,
    description: string,
    rawText: string,
    systemStage: CanonicalSystemStage = 'Stage V: Praxis & Epistemic Synthesis',
    thematicGroup: CanonicalThematicGroup = 'Epistemic Architecture'
  ): GraphNode {
    return {
      id: docId,
      hash: fileHash,
      label: title,
      title,
      nodeKind: 'document-hub',
      sourceFile: fileName,
      mimeType,
      content: sanitizeDisplayText(rawText.substring(0, 1000)),
      description: sanitizeDisplayText(description),
      systemStage,
      thematicGroup,
      processingMode: 'STRUCTURALLY_INGESTED',
      confidenceStatus: 'source-explicit',
      sourceSpans: [],
      citations: [
        {
          id: generateScopedId('cit', fileHash, 'doc_root'),
          sourceTitle: title,
          authorOrOrigin: fileName
        }
      ],
      metadata: {
        documentId: docId,
        fileName,
        fileSizeChars: rawText.length,
        isRootHub: true
      },
      connectedNodeIds: [],
      createdAt: Date.now(),
      type: 'root',
      color: '#10b981', // Distinctive emerald hue for user-ingested document hubs
      glowColor: '#059669',
      radius: 20,
      particleCount: 32,
      isIngested: true
    };
  }

  /**
   * Creates a Section Node
   */
  protected createSectionNode(
    docId: string,
    fileHash: string,
    fileName: string,
    mimeType: SupportedMimeType,
    title: string,
    headingPath: string[],
    level: number,
    span: SourceSpan,
    systemStage: CanonicalSystemStage = 'Unclassified / Pending Review',
    thematicGroup: CanonicalThematicGroup = 'Unclassified / Pending Review'
  ): GraphNode {
    const id = generateScopedId('sec', fileHash, headingPath.join('/'));
    return {
      id,
      hash: fileHash,
      label: title,
      title,
      nodeKind: 'section',
      sourceFile: fileName,
      mimeType,
      content: sanitizeDisplayText(span.verbatimText.substring(0, 500)),
      description: sanitizeDisplayText(`Section: ${headingPath.join(' > ')}`),
      systemStage,
      thematicGroup,
      processingMode: 'STRUCTURALLY_INGESTED',
      confidenceStatus: 'source-explicit',
      sourceSpans: [span],
      citations: [
        {
          id: generateScopedId('cit', fileHash, `sec_${span.spanId}`),
          sourceTitle: `${fileName}: ${headingPath.join(' > ')}`,
          quoteSnippet: span.verbatimText.substring(0, 160)
        }
      ],
      metadata: {
        sectionLevel: level,
        headingPath: headingPath.join(' > '),
        documentId: docId
      },
      connectedNodeIds: [docId],
      createdAt: Date.now(),
      level: Math.min(4, Math.max(1, level)),
      type: 'major_hub',
      color: '#06b6d4',
      glowColor: '#0891b2',
      radius: 14,
      particleCount: 18,
      isIngested: true,
      documentId: docId
    };
  }

  /**
   * Creates a Concept or Proposition Node
   */
  protected createEpistemicNode(
    docId: string,
    fileHash: string,
    fileName: string,
    mimeType: SupportedMimeType,
    label: string,
    title: string,
    nodeKind: 'concept' | 'proposition' | 'passage' | 'unresolved-reference',
    description: string,
    span: SourceSpan,
    systemStage: CanonicalSystemStage,
    thematicGroup: CanonicalThematicGroup,
    confidenceStatus: EpistemicConfidenceStatus = 'source-explicit',
    modality?: PropositionModality,
    author?: string,
    isAttributedThirdPartyQuote?: boolean
  ): GraphNode {
    const id = generateScopedId(nodeKind === 'proposition' ? 'prop' : 'concept', fileHash, `${label}_${span.charStart}`);
    return {
      id,
      hash: fileHash,
      label,
      title,
      nodeKind,
      sourceFile: fileName,
      mimeType,
      content: sanitizeDisplayText(span.verbatimText),
      description: sanitizeDisplayText(description),
      systemStage,
      thematicGroup,
      processingMode: 'STRUCTURALLY_INGESTED',
      confidenceStatus,
      sourceSpans: [span],
      citations: [
        {
          id: generateScopedId('cit', fileHash, `cit_${span.spanId}`),
          sourceTitle: `${fileName} § ${span.headingPath.join(' > ')}`,
          authorOrOrigin: author,
          quoteSnippet: span.verbatimText,
          sourceSpanId: span.spanId,
          isAttributedThirdPartyQuote
        }
      ],
      metadata: {
        documentId: docId,
        nodeKind,
        headingPath: span.headingPath.join(' > '),
        confidenceStatus,
        modality: modality || 'assertion'
      },
      connectedNodeIds: [],
      createdAt: Date.now(),
      type: nodeKind === 'proposition' ? 'quote' : 'concept',
      color: nodeKind === 'unresolved-reference' ? '#f59e0b' : '#38bdf8',
      glowColor: nodeKind === 'unresolved-reference' ? '#d97706' : '#0284c7',
      radius: nodeKind === 'proposition' ? 11 : 12,
      particleCount: 14,
      isIngested: true,
      documentId: docId,
      modality
    };
  }

  /**
   * Creates a Graph Edge
   */
  protected createEdge(
    fileHash: string,
    source: string,
    target: string,
    relationType: string,
    edgeCategory: 'structural' | 'philosophical' | 'proposed' = 'structural',
    confidenceStatus: EpistemicConfidenceStatus = 'source-explicit',
    sourceSpanId?: string,
    label?: string
  ): GraphEdge {
    const id = generateScopedId('edge', fileHash, `${source}_${target}_${relationType}`);
    return {
      id,
      source,
      target,
      relationType,
      edgeCategory,
      confidenceStatus,
      sourceSpanId,
      label: label || relationType,
      weight: edgeCategory === 'structural' ? 1.0 : 0.8
    };
  }

  /**
   * Deterministically classifies an excerpt's stage and thematic group
   */
  protected classifyExcerpt(
    text: string,
    headingPath: string[] = []
  ): { stage: CanonicalSystemStage; group: CanonicalThematicGroup; confidence: EpistemicConfidenceStatus } {
    const combined = `${headingPath.join(' ')} ${text}`.toLowerCase();

    // 1. Apophatic Liminality & Dynamics
    if (
      combined.includes('apophatic') ||
      combined.includes('pseudo-dionysius') ||
      combined.includes('meister eckhart') ||
      combined.includes('divine darkness') ||
      combined.includes('unknowable') ||
      combined.includes('via negativa') ||
      combined.includes('divine nothingness')
    ) {
      return {
        stage: 'Stage III: Apophatic Liminality',
        group: 'Apophatic Dynamics',
        confidence: 'source-explicit'
      };
    }

    // 2. Ontological Groundlessness & Nihilistic Pivot
    if (
      combined.includes('groundlessness') ||
      combined.includes('nihilistic pivot') ||
      combined.includes('abyssal') ||
      combined.includes('sheer absence of intrinsic teleology') ||
      combined.includes('absence of objective value') ||
      combined.includes('unconditioned substrate') ||
      combined.includes('nothingness here denotes')
    ) {
      return {
        stage: 'Stage I: Ontological Groundlessness',
        group: 'Nihilistic Pivot',
        confidence: 'source-explicit'
      };
    }

    // 3. Deconstructive Dissolution & Phenomenological Void
    if (
      combined.includes('phenomenological void') ||
      combined.includes('dissolution') ||
      combined.includes('deconstruction') ||
      combined.includes('bracketting') ||
      combined.includes('epoche') ||
      combined.includes('collapse of finite significance')
    ) {
      return {
        stage: 'Stage II: Deconstructive Dissolution',
        group: 'Phenomenological Void',
        confidence: 'source-explicit'
      };
    }

    // 4. Transcendent Presence
    if (
      combined.includes('transcendent presence') ||
      combined.includes('sacred immanence') ||
      combined.includes('numinous fullness')
    ) {
      return {
        stage: 'Stage IV: Transcendent Presence',
        group: 'Historical Lineage',
        confidence: 'strongly-supported-inference'
      };
    }

    // 5. Historical Lineage
    if (
      combined.includes('nietzsche') ||
      combined.includes('sartre') ||
      combined.includes('camus') ||
      combined.includes('kierkegaard') ||
      combined.includes('heidegger') ||
      combined.includes('nishitani')
    ) {
      return {
        stage: 'Stage V: Praxis & Epistemic Synthesis',
        group: 'Historical Lineage',
        confidence: 'strongly-supported-inference'
      };
    }

    // Default to Unclassified / Pending Review when evidence is insufficient or ambiguous
    return {
      stage: 'Unclassified / Pending Review',
      group: 'Unclassified / Pending Review',
      confidence: 'unclassified'
    };
  }
}
