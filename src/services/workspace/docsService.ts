import { getAccessToken } from './authService';
import type { EpistemicTopologyNode } from '../../components/GroundedEpistemicTopologyData';
import type { GraphNode, GraphEdge } from '../../types/graph';

export interface GoogleDocStructuralElement {
  startIndex?: number;
  endIndex?: number;
  paragraph?: {
    elements?: Array<{
      startIndex?: number;
      endIndex?: number;
      textRun?: {
        content?: string;
        textStyle?: Record<string, unknown>;
      };
    }>;
    paragraphStyle?: {
      namedStyleType?: string;
      headingId?: string;
    };
    bullet?: {
      listId?: string;
      nestingLevel?: number;
    };
  };
  table?: unknown;
  sectionBreak?: unknown;
}

export interface GoogleDocDocument {
  documentId: string;
  title: string;
  revisionId?: string;
  body?: {
    content?: GoogleDocStructuralElement[];
  };
}

/**
 * Fetch a Google Doc by its ID.
 */
export async function getGoogleDoc(documentId: string): Promise<GoogleDocDocument> {
  const token = await getAccessToken();
  if (!token) {
    throw new Error('Not authenticated. Please sign in with Google to access Google Docs.');
  }

  const res = await fetch(`https://docs.googleapis.com/v1/documents/${documentId}`, {
    headers: {
      Authorization: `Bearer ${token}`
    }
  });

  if (!res.ok) {
    const errorText = await res.text();
    throw new Error(`Google Docs API error (${res.status}): ${errorText}`);
  }

  return res.json();
}

/**
 * Convert a Google Docs AST structure into high-fidelity Markdown
 * preserving headings, quotes, bullet points, and frontmatter.
 */
export function parseGoogleDocToMarkdown(doc: GoogleDocDocument): string {
  const title = doc.title || 'Untitled Google Doc';
  const lines: string[] = [
    '---',
    `title: "${title.replace(/"/g, '\\"')}"`,
    `source: "Google Docs"`,
    `googleDocId: "${doc.documentId}"`,
    'tags: [google-docs, nihiltheism, manuscript]',
    '---',
    '',
    `# ${title}`,
    ''
  ];

  const content = doc.body?.content || [];

  for (const element of content) {
    if (!element.paragraph) continue;
    const p = element.paragraph;
    const style = p.paragraphStyle?.namedStyleType || 'NORMAL_TEXT';
    
    // Extract full text of paragraph
    const text = (p.elements || [])
      .map((el) => el.textRun?.content || '')
      .join('')
      .replace(/\r\n/g, '\n')
      .trim();

    if (!text) {
      lines.push('');
      continue;
    }

    if (style === 'TITLE') {
      // Already rendered top-level title
      lines.push(`## ${text}`);
    } else if (style === 'HEADING_1') {
      lines.push(`\n## ${text}\n`);
    } else if (style === 'HEADING_2') {
      lines.push(`\n### ${text}\n`);
    } else if (style === 'HEADING_3') {
      lines.push(`\n#### ${text}\n`);
    } else if (style === 'HEADING_4') {
      lines.push(`\n##### ${text}\n`);
    } else if (p.bullet) {
      lines.push(`- ${text}`);
    } else if (text.startsWith('>') || text.toLowerCase().startsWith('quote:')) {
      lines.push(`> ${text.replace(/^quote:\s*/i, '').trim()}`);
    } else {
      lines.push(text);
    }
  }

  return lines.join('\n');
}

/**
 * Create a new blank Google Doc in Google Drive.
 */
export async function createGoogleDoc(title: string): Promise<GoogleDocDocument> {
  const token = await getAccessToken();
  if (!token) {
    throw new Error('Not authenticated. Please sign in with Google to create Docs.');
  }

  const res = await fetch('https://docs.googleapis.com/v1/documents', {
    method: 'POST',
    headers: {
      Authorization: `Bearer ${token}`,
      'Content-Type': 'application/json'
    },
    body: JSON.stringify({
      title: title || 'Nihiltheism Epistemic Dossier'
    })
  });

  if (!res.ok) {
    const errorText = await res.text();
    throw new Error(`Failed to create Google Doc (${res.status}): ${errorText}`);
  }

  return res.json();
}

/**
 * Perform batchUpdate requests on a Google Doc.
 */
export async function batchUpdateGoogleDoc(
  documentId: string,
  requests: Array<Record<string, unknown>>
): Promise<unknown> {
  const token = await getAccessToken();
  if (!token) {
    throw new Error('Not authenticated. Please sign in with Google to update Docs.');
  }

  const res = await fetch(`https://docs.googleapis.com/v1/documents/${documentId}:batchUpdate`, {
    method: 'POST',
    headers: {
      Authorization: `Bearer ${token}`,
      'Content-Type': 'application/json'
    },
    body: JSON.stringify({ requests })
  });

  if (!res.ok) {
    const errorText = await res.text();
    throw new Error(`Google Docs batchUpdate error (${res.status}): ${errorText}`);
  }

  return res.json();
}

/**
 * Export knowledge graph entities and dialectics into a structured Google Doc.
 */
export async function exportKnowledgeGraphToGoogleDoc(options: {
  title: string;
  nodes: Array<EpistemicTopologyNode | GraphNode>;
  edges?: GraphEdge[];
  includeBaseline?: boolean;
}): Promise<{ documentId: string; title: string; webViewLink: string }> {
  const { title, nodes, edges = [] } = options;

  // 1. Create document
  const createdDoc = await createGoogleDoc(title);
  const documentId = createdDoc.documentId;

  // 2. Format comprehensive philosophical text content
  const sections: string[] = [];
  sections.push(`JOURNAL314 Ω — NIHILTHEISM EPISTEMIC TOPOLOGY DOSSIER\n`);
  sections.push(`Generated: ${new Date().toUTCString()}\n`);
  sections.push(`Export Scope: ${nodes.length} Grounded Nodes | ${edges.length} Active Cross-Edges\n\n`);
  sections.push(`--------------------------------------------------------------------------------\n\n`);

  // Group by stage or thematic group
  const grouped = new Map<string, Array<EpistemicTopologyNode | GraphNode>>();
  for (const n of nodes) {
    const stage = n.systemStage || 'UNCATEGORIZED_STAGE';
    if (!grouped.has(stage)) grouped.set(stage, []);
    grouped.get(stage)!.push(n);
  }

  for (const [stage, stageNodes] of grouped.entries()) {
    sections.push(`\n=== SYSTEM STAGE: ${stage.toUpperCase()} ===\n\n`);
    for (const node of stageNodes) {
      sections.push(`[NODE] ${node.title}\n`);
      if (node.thematicGroup) {
        sections.push(`Thematic Lane: ${node.thematicGroup}\n`);
      }
      if ('nodeKind' in node && (node as GraphNode).nodeKind) {
        sections.push(`Kind: ${(node as GraphNode).nodeKind}\n`);
      }
      if ('confidenceStatus' in node && (node as GraphNode).confidenceStatus) {
        sections.push(`Confidence Status: ${(node as GraphNode).confidenceStatus}\n`);
      }
      sections.push(`Description:\n${node.description || 'No description provided.'}\n`);

      if (node.citations && node.citations.length > 0) {
        sections.push(`Citations & Attributions:\n`);
        node.citations.forEach((cit) => {
          sections.push(`  • ${cit.sourceTitle}${cit.authorOrOrigin ? ` (${cit.authorOrOrigin})` : ''}`);
          if (cit.quoteSnippet) sections.push(`    "${cit.quoteSnippet}"`);
          sections.push('\n');
        });
      }

      if (node.connectedNodeIds && node.connectedNodeIds.length > 0) {
        sections.push(`Connected Relata IDs: ${node.connectedNodeIds.join(', ')}\n`);
      }
      sections.push('\n');
    }
  }

  // Cross-edges section
  if (edges.length > 0) {
    sections.push(`\n=== DIALECTICAL EDGES & CROSS-RELATA ===\n\n`);
    for (const e of edges) {
      sections.push(`• [${e.relationType.toUpperCase()}] ${e.source} ──► ${e.target} (${e.edgeCategory})\n`);
    }
  }

  const fullText = sections.join('');

  // 3. Batch insert text into document
  try {
    await batchUpdateGoogleDoc(documentId, [
      {
        insertText: {
          location: { index: 1 },
          text: fullText
        }
      }
    ]);
  } catch (err) {
    console.warn('[docsService] batchUpdate failed to format text:', err);
  }

  return {
    documentId,
    title,
    webViewLink: `https://docs.google.com/document/d/${documentId}/edit`
  };
}
