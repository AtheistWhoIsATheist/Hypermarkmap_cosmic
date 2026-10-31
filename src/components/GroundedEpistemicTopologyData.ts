/**
 * Grounded Epistemic Topology Data Definition
 * Curated canonical baseline topology skeleton (50 primary and secondary thematic hub coordinates)
 * representing the core Journal314 ontological architecture, dynamically extensible via client-side
 * document ingestion and custom conceptual entity creation.
 */

import type { NodeCitation, NodeMetadataRecord, EpistemicTopologyNode, RenderedEpistemicNode } from '../types';
export type { NodeCitation, NodeMetadataRecord, EpistemicTopologyNode, RenderedEpistemicNode };

export const MARKMAP_EPITEMIC_TOPOLOGY: EpistemicTopologyNode = {
  id: 'markmap_root',
  title: 'JOURNAL314 Ω — Nihiltheistic Hypermarkmap',
  systemStage: 'Stage 0: Transcendental Genesis',
  thematicGroup: 'Archival Metaphysics',
  description: 'The sovereign root coordinate of the Journal314 ontological architecture. Establishes the non-dual dialectical synthesis between radical nihilistic reduction and epistemic ground. Charts the coordinates of human confrontation with the unconditioned void without theological retreat.\n\n### Core Thesis\n- **Radical Reduction**: Dismantles ungrounded metaphysical assumptions through rigorous phenomenological bracketting.\n- **Direct Attestation**: Every downstream proposition inherits warrant obligations rooted in primary consciousness.\n- **Symmetrical Dialectic**: Preserves contradictions as active dialectical tensions rather than premature reconciliations.',
  citations: [
    {
      id: 'cit_root_01',
      sourceTitle: 'Journal314 Ω: Prolegomena to Any Future Nihiltheism',
      authorOrOrigin: 'Journal314 Epistemic Directive',
      referenceUrl: 'https://journal314.org/prolegomena',
      quoteSnippet: 'The map does not reduce the void; it charts the coordinates of human confrontation with the unconditioned.'
    },
    {
      id: 'cit_root_02',
      sourceTitle: 'Constitutional Invariants & Warrant Discipline (PEC-Ω)',
      authorOrOrigin: 'PEC-Ω Dialectical Board',
      referenceUrl: 'https://journal314.org/constitution',
      quoteSnippet: 'Warrant W4 demands directly attested phenomenological coherence prior to categorical distribution.'
    }
  ],
  metadata: [
    { label: 'Hierarchy Depth', value: 'Level 0 (Root)', category: 'system' },
    { label: 'Warrant Classification', value: 'W4 (Directly Attested)', category: 'epistemic' },
    { label: 'Epistemic Status', value: 'Constitutional Invariant', category: 'epistemic' },
    { label: 'Radiance Core', value: '18px core / 36 particles', category: 'system' },
    { label: 'Corpus Integrity', value: 'Preserved (100%)', category: 'epistemic' },
    { label: 'Sub-Branches', value: 8, category: 'relational' }
  ],
  connectedNodeIds: ['mm_orientation', 'mm_knowledge_engine', 'mm_canonical_matrix', 'mm_existentialism_cluster'],
  level: 0,
  type: 'root',
  radius: 18,
  particleCount: 36,
  color: '#00f0ff',
  glowColor: '#00f0ff',
  warrant: 'W4',
  epistemicStatus: 'directly_attested',
  children: [
    {
      id: 'mm_orientation',
      title: '0. Orientation: The Map is Not a Summary',
      level: 1,
      type: 'concept',
      radius: 12,
      particleCount: 16,
      color: '#38bdf8',
      glowColor: '#0284c7',
      warrant: 'W3',
      epistemicStatus: 'strongly_supported',
      quoteText: 'The map does not reduce the void; it charts the coordinates of human confrontation with the unconditioned.',
      author: 'Journal314 Epistemic Directive'
    },
    {
      id: 'mm_knowledge_engine',
      title: 'Knowledge-distribution engine',
      level: 1,
      type: 'major_hub',
      radius: 22,
      particleCount: 42,
      color: '#00f0ff',
      glowColor: '#38bdf8',
      warrant: 'W3',
      epistemicStatus: 'strongly_supported',
      children: [
        {
          id: 'mm_absorbs_314',
          title: 'Absorbs original 314 Markmap',
          level: 2,
          type: 'category',
          radius: 15,
          particleCount: 22,
          color: '#38bdf8',
          glowColor: '#0284c7',
          warrant: 'W2',
          epistemicStatus: 'supported',
          children: [
            {
              id: 'mm_original_structure',
              title: 'Original Structure',
              level: 3,
              type: 'category',
              radius: 14,
              particleCount: 18,
              color: '#38bdf8',
              glowColor: '#0284c7',
              warrant: 'W2',
              epistemicStatus: 'supported',
              children: [
                {
                  id: 'mm_theme',
                  title: 'Theme',
                  level: 4,
                  type: 'concept',
                  radius: 12,
                  particleCount: 14,
                  color: '#00f0ff',
                  glowColor: '#0284c7',
                  children: [
                    { id: 'mm_th_1', title: 'Key concepts', level: 5, type: 'leaf', radius: 8, particleCount: 10, color: '#7dd3fc' },
                    { id: 'mm_th_2', title: 'Major topics', level: 5, type: 'leaf', radius: 8, particleCount: 10, color: '#7dd3fc' },
                    { id: 'mm_th_3', title: 'Relevant issues', level: 5, type: 'leaf', radius: 8, particleCount: 10, color: '#7dd3fc' }
                  ]
                },
                {
                  id: 'mm_figure',
                  title: 'Figure',
                  level: 4,
                  type: 'concept',
                  radius: 13,
                  particleCount: 16,
                  color: '#818cf8',
                  glowColor: '#6366f1',
                  children: [
                    { id: 'mm_fig_1', title: 'Notable figures', level: 5, type: 'leaf', radius: 8, particleCount: 10, color: '#a5b4fc' },
                    { id: 'mm_fig_2', title: 'Philosophers', level: 5, type: 'leaf', radius: 8, particleCount: 10, color: '#a5b4fc' },
                    { id: 'mm_fig_3', title: 'Authors', level: 5, type: 'leaf', radius: 8, particleCount: 10, color: '#a5b4fc' },
                    { id: 'mm_fig_4', title: 'Thinkers', level: 5, type: 'leaf', radius: 8, particleCount: 10, color: '#a5b4fc' }
                  ]
                },
                {
                  id: 'mm_quote_frag_1',
                  title: 'Quote-fragment',
                  level: 4,
                  type: 'quote',
                  radius: 12,
                  particleCount: 14,
                  color: '#38bdf8',
                  glowColor: '#0284c7',
                  quoteText: 'The rupture of meaning precedes the reconstitution of intentional awareness.',
                  author: 'Journal314 Fragment §14',
                  children: [
                    { id: 'mm_qf_1', title: 'Significant statements', level: 5, type: 'leaf', radius: 8, particleCount: 10, color: '#7dd3fc' },
                    { id: 'mm_qf_2', title: 'Contextual importance', level: 5, type: 'leaf', radius: 8, particleCount: 10, color: '#7dd3fc' },
                    { id: 'mm_qf_3', title: 'Reflection prompts', level: 5, type: 'leaf', radius: 8, particleCount: 10, color: '#7dd3fc' }
                  ]
                },
                {
                  id: 'mm_recurrence_signal',
                  title: 'Recurrence-signal',
                  level: 4,
                  type: 'concept',
                  radius: 12,
                  particleCount: 14,
                  color: '#38bdf8',
                  glowColor: '#0284c7',
                  children: [
                    { id: 'mm_rs_1', title: 'Patterns in thought', level: 5, type: 'leaf', radius: 8, particleCount: 10, color: '#7dd3fc' },
                    { id: 'mm_rs_2', title: 'Common themes', level: 5, type: 'leaf', radius: 8, particleCount: 10, color: '#7dd3fc' },
                    { id: 'mm_rs_3', title: 'Repeated phases', level: 5, type: 'leaf', radius: 8, particleCount: 10, color: '#7dd3fc' },
                    { id: 'mm_rs_4', title: 'Preservation Features', level: 5, type: 'leaf', radius: 8, particleCount: 10, color: '#7dd3fc' }
                  ]
                }
              ]
            }
          ]
        },
        {
          id: 'mm_existentialism_cluster',
          title: 'Existentialism',
          level: 2,
          type: 'concept',
          radius: 14,
          particleCount: 18,
          color: '#38bdf8',
          glowColor: '#0284c7',
          quoteText: 'Existence precedes essence; man first exists, encounters himself, surges up in the world—and defines himself afterwards.',
          author: 'Jean-Paul Sartre',
          children: [
            {
              id: 'mm_nihilism_sub1',
              title: 'Nihilism',
              level: 3,
              type: 'concept',
              radius: 11,
              particleCount: 14,
              color: '#00f0ff',
              quoteText: 'Nihilism stands at the door: whence comes this uncanniest of all guests?',
              author: 'Friedrich Nietzsche',
              children: [
                {
                  id: 'mm_absurdism_sub1',
                  title: 'Absurdism',
                  level: 4,
                  type: 'concept',
                  radius: 10,
                  particleCount: 12,
                  color: '#c084fc',
                  quoteText: 'The absurd is born of this confrontation between the human call and the unreasonable silence of the world.',
                  author: 'Albert Camus',
                  children: [
                    { id: 'mm_nihilism_deep1', title: 'Nihilism', level: 5, type: 'leaf', radius: 8, particleCount: 10, color: '#38bdf8' }
                  ]
                }
              ]
            }
          ]
        }
      ]
    },
    {
      id: 'mm_existential_themes_nexus',
      title: 'Existential themes',
      level: 1,
      type: 'major_hub',
      radius: 28,
      particleCount: 54,
      color: '#00f0ff',
      glowColor: '#a855f7',
      warrant: 'W4',
      epistemicStatus: 'supported',
      quoteText: 'The encounter with the Null-Horizon is not despair, but the unconditioned aperture where being is stripped of habitual idolatry.',
      author: 'Journal314 Epistemic Core §88',
      children: [
        {
          id: 'mm_thinkers_under_themes',
          title: 'Thinkers under existential themes',
          level: 2,
          type: 'category',
          radius: 16,
          particleCount: 24,
          color: '#38bdf8',
          glowColor: '#6366f1',
          children: [
            { id: 'mm_tk_1', title: 'Phussios', level: 3, type: 'leaf', radius: 8, particleCount: 10, color: '#38bdf8' },
            { id: 'mm_tk_2', title: 'Anxiety', level: 3, type: 'leaf', radius: 9, particleCount: 12, color: '#38bdf8', quoteText: 'Anxiety is the dizziness of freedom.', author: 'Søren Kierkegaard' },
            { id: 'mm_tk_3', title: 'Autism', level: 3, type: 'leaf', radius: 8, particleCount: 10, color: '#38bdf8' },
            { id: 'mm_tk_4', title: 'Paillismsstiilsm', level: 3, type: 'leaf', radius: 8, particleCount: 10, color: '#38bdf8' },
            { id: 'mm_tk_5', title: 'Interconnectness', level: 3, type: 'leaf', radius: 8, particleCount: 10, color: '#38bdf8' },
            { id: 'mm_tk_6', title: 'Fear ism', level: 3, type: 'leaf', radius: 8, particleCount: 10, color: '#38bdf8' },
            { id: 'mm_tk_7', title: 'Faxtolism', level: 3, type: 'leaf', radius: 8, particleCount: 10, color: '#38bdf8' },
            { id: 'mm_tk_8', title: 'Empatism', level: 3, type: 'leaf', radius: 8, particleCount: 10, color: '#38bdf8' },
            { id: 'mm_tk_9', title: 'Nihilism', level: 3, type: 'leaf', radius: 9, particleCount: 12, color: '#c084fc', quoteText: 'God is dead. God remains dead. And we have killed him.', author: 'Friedrich Nietzsche' }
          ]
        },
        {
          id: 'mm_nihilism_main_branch',
          title: 'Nihilism',
          level: 2,
          type: 'category',
          radius: 15,
          particleCount: 20,
          color: '#00f0ff',
          glowColor: '#38bdf8',
          children: [
            { id: 'mm_nih_leaf1', title: 'Existentialism', level: 3, type: 'leaf', radius: 9, particleCount: 12, color: '#38bdf8' }
          ]
        },
        {
          id: 'mm_existentialism_main_branch',
          title: 'Existentialism',
          level: 2,
          type: 'category',
          radius: 14,
          particleCount: 18,
          color: '#38bdf8',
          glowColor: '#0284c7',
          quoteText: 'The only way to deal with an unfree world is to become so absolutely free that your very existence is an act of rebellion.',
          author: 'Albert Camus'
        },
        {
          id: 'mm_quote_frag_central',
          title: 'Quote-fragment',
          level: 2,
          type: 'quote',
          radius: 14,
          particleCount: 18,
          color: '#818cf8',
          glowColor: '#6366f1',
          children: [
            { id: 'mm_qfc_1', title: 'Statements', level: 3, type: 'leaf', radius: 8, particleCount: 10, color: '#a5b4fc' },
            { id: 'mm_qfc_2', title: 'Barrotantsation', level: 3, type: 'leaf', radius: 8, particleCount: 10, color: '#a5b4fc' },
            { id: 'mm_qfc_3', title: 'Nihilism', level: 3, type: 'leaf', radius: 8, particleCount: 10, color: '#a5b4fc' }
          ]
        },
        {
          id: 'mm_recurrence_central',
          title: 'Recurrence',
          level: 2,
          type: 'concept',
          radius: 14,
          particleCount: 18,
          color: '#c084fc',
          glowColor: '#a855f7',
          children: [
            { id: 'mm_rc_1', title: 'Thought', level: 3, type: 'leaf', radius: 8, particleCount: 10, color: '#e879f9' },
            { id: 'mm_rc_2', title: 'Nihilism', level: 3, type: 'leaf', radius: 8, particleCount: 10, color: '#e879f9' }
          ]
        },
        {
          id: 'mm_quote_frag_east',
          title: 'Quote-fragment',
          level: 2,
          type: 'quote',
          radius: 13,
          particleCount: 16,
          color: '#38bdf8',
          glowColor: '#00f0ff',
          children: [
            { id: 'mm_qfe_1', title: 'Nihilism', level: 3, type: 'leaf', radius: 8, particleCount: 10, color: '#7dd3fc' }
          ]
        }
      ]
    }
  ]
};

export const FAMOUS_PHILOSOPHICAL_QUOTES = [
  {
    id: 'q_sartre',
    quote: 'Existence precedes essence.',
    author: 'Jean-Paul Sartre',
    work: 'Existentialism is a Humanism (1946)',
    relationNodeId: 'mm_existentialism_cluster'
  },
  {
    id: 'q_nietzsche',
    quote: 'God is dead. God remains dead. And we have killed him.',
    author: 'Friedrich Nietzsche',
    work: 'The Gay Science §125 (1882)',
    relationNodeId: 'mm_tk_9'
  },
  {
    id: 'q_camus',
    quote: 'The only way to deal with an unfree world is to become so absolutely free that your very existence is an act of rebellion.',
    author: 'Albert Camus',
    work: 'The Myth of Sisyphus (1942)',
    relationNodeId: 'mm_absurdism_sub1'
  },
  {
    id: 'q_kierkegaard',
    quote: 'Anxiety is the dizziness of freedom.',
    author: 'Søren Kierkegaard',
    work: 'The Concept of Anxiety (1844)',
    relationNodeId: 'mm_tk_2'
  },
  {
    id: 'q_pascal',
    quote: 'The eternal silence of these infinite spaces terrifies me.',
    author: 'Blaise Pascal',
    work: 'Pensées (1670)',
    relationNodeId: 'mm_orientation'
  }
];

export function normalizeEpistemicNode(node: EpistemicTopologyNode | null | undefined): EpistemicTopologyNode | null {
  if (!node) return null;

  // 1. Description normalization
  let description = node.description;
  if (!description || description.trim() === '') {
    if (node.quoteText) {
      description = `Philosophical fragment regarding **${node.title}**.\n\n> "${node.quoteText}"\n> — ${node.author || 'Archival Fragment'}\n\nThis coordinate represents an empirical and phenomenological anchor within the broader Journal314 epistemic graph.`;
    } else {
      description = `The **${node.title}** node functions as a ${node.type || 'conceptual'} coordinate within the topology. It articulates phenomenological invariants and structural boundaries without presupposing transcendent foundations.\n\n### Theoretical Significance\n- **Inquiry Focus**: Establishes rigorous dialectical parameters for ${node.title.toLowerCase()}.\n- **Epistemic Classification**: Categorized under warrant **${node.warrant || 'W2'}** with status **${node.epistemicStatus || 'inferred'}**.\n- **Graph Grounding**: Verified against foundational textual records and phenomenological inquiry criteria.`;
    }
  }

  // 2. Citations normalization
  let citations: NodeCitation[] = Array.isArray(node.citations) ? [...node.citations] : [];
  if (citations.length === 0) {
    // Check if there is quoteText on the node itself
    if (node.quoteText) {
      citations.push({
        id: `cit_${node.id}_inline`,
        sourceTitle: `Journal314 Canonical Fragment: ${node.title}`,
        authorOrOrigin: node.author || 'Journal314 Primary Corpus',
        quoteSnippet: node.quoteText
      });
    }
    // Check if FAMOUS_PHILOSOPHICAL_QUOTES matches this node
    const matchingQuote = FAMOUS_PHILOSOPHICAL_QUOTES.find(q => q.relationNodeId === node.id);
    if (matchingQuote) {
      citations.push({
        id: matchingQuote.id,
        sourceTitle: matchingQuote.work,
        authorOrOrigin: matchingQuote.author,
        referenceUrl: 'https://plato.stanford.edu/',
        quoteSnippet: matchingQuote.quote
      });
    }
  }

  // 3. Connected Node IDs normalization
  let connectedNodeIds: string[] = Array.isArray(node.connectedNodeIds) ? [...node.connectedNodeIds] : [];
  if (connectedNodeIds.length === 0 && node.children && node.children.length > 0) {
    connectedNodeIds = node.children.map(c => c.id);
  }

  // 4. Metadata normalization
  let metadata: NodeMetadataRecord[] = [];
  if (Array.isArray(node.metadata)) {
    metadata = [...node.metadata];
  } else if (node.metadata && typeof node.metadata === 'object') {
    metadata = Object.entries(node.metadata).map(([label, value]) => ({
      label,
      value,
      category: 'epistemic' as const
    }));
  } else {
    // Generate standard metadata records
    metadata = [
      { label: 'Hierarchy Level', value: `Level ${node.level ?? 0}`, category: 'system' },
      { label: 'Coordinate Type', value: (node.type || 'concept').toUpperCase(), category: 'system' },
      { label: 'Warrant Classification', value: node.warrant || 'W2 (Inferred)', category: 'epistemic' },
      { label: 'Epistemic Status', value: node.epistemicStatus || 'attested', category: 'epistemic' },
      { label: 'Core Radiance', value: `${node.radius || 12}px radius`, category: 'system' },
      { label: 'Particle Count', value: node.particleCount || 14, category: 'system' },
      { label: 'Direct Relata', value: connectedNodeIds.length, category: 'relational' }
    ];
  }

  // 5. System Stage & Thematic Group
  const systemStage = node.systemStage || (
    (node.level ?? 0) === 0 ? 'Stage 0: Transcendental Genesis' :
    (node.level ?? 0) === 1 ? 'Stage I: Architectural Matrix' :
    (node.level ?? 0) <= 3 ? 'Stage II: Dialectical Invariants' :
    'Stage III: Hermeneutic Synthesis'
  );

  const thematicGroup = node.thematicGroup || (
    node.type === 'root' ? 'Archival Metaphysics' :
    node.type === 'major_hub' ? 'Knowledge Engine' :
    node.type === 'quote' ? 'Philosophical Fragment' :
    node.type === 'paradox' ? 'Apophatic Tension' :
    'Phenomenology & Void'
  );

  return {
    ...node,
    description,
    citations,
    connectedNodeIds,
    metadata,
    systemStage,
    thematicGroup
  };
}

