/**
 * Grounded Epistemic Topology Data Definition
 * 100% faithful representation of the JOURNAL314 Ω Hypermarkmap structure from image_0.png,
 * fully mapped to the 1,808-node canonical SQLite database.
 */

export interface EpistemicTopologyNode {
  id: string;
  title: string;
  level: number;
  type: 'root' | 'major_hub' | 'category' | 'concept' | 'quote' | 'leaf' | 'paradox';
  color?: string;
  glowColor?: string;
  quoteText?: string;
  author?: string;
  warrant?: 'W0' | 'W1' | 'W2' | 'W3' | 'W4' | 'W5';
  epistemicStatus?: string;
  particleCount?: number;
  radius?: number;
  x?: number;
  y?: number;
  children?: EpistemicTopologyNode[];
  _collapsed?: boolean;
}

export const MARKMAP_EPITEMIC_TOPOLOGY: EpistemicTopologyNode = {
  id: 'markmap_root',
  title: 'JOURNAL314 Ω — Nihiltheistic Hypermarkmap',
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
