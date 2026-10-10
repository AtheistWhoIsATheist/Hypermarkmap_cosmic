import React, { useState, useEffect, useRef, useMemo, useCallback } from 'react';
import {
  Search,
  ZoomIn,
  ZoomOut,
  Maximize2,
  Minimize2,
  ChevronDown,
  ChevronRight,
  Sparkles,
  X,
  Quote
} from 'lucide-react';
import {
  MARKMAP_EPITEMIC_TOPOLOGY,
  FAMOUS_PHILOSOPHICAL_QUOTES,
  type EpistemicTopologyNode
} from './GroundedEpistemicTopologyData';
import type { HypermapTreeNode, HypermapStats } from '../types';

interface GroundedEpistemicTopologyProps {
  canonicalTreeData?: HypermapTreeNode | null;
  stats?: HypermapStats | null;
  onSelectCanonicalNode?: (node: HypermapTreeNode) => void;
  onTriggerResearchLoop?: (focusArea: string) => void;
  onDensifyCanonicalNode?: (nodeId: string) => Promise<void>;
  aiConfigured?: boolean;
}

export const GroundedEpistemicTopology: React.FC<GroundedEpistemicTopologyProps> = ({
  canonicalTreeData,
  stats,
  onSelectCanonicalNode,
  onTriggerResearchLoop,
  onDensifyCanonicalNode,
  aiConfigured = false
}) => {
  const containerRef = useRef<HTMLDivElement | null>(null);
  const headerRef = useRef<HTMLElement | null>(null);
  const [headerHeight, setHeaderHeight] = useState(140);
  const canvasRef = useRef<HTMLCanvasElement | null>(null);
  const animFrameIdRef = useRef<number | null>(null);

  useEffect(() => {
    const header = headerRef.current;
    if (!header) return;
    const observer = new ResizeObserver(() => setHeaderHeight(header.clientHeight));
    observer.observe(header);
    return () => observer.disconnect();
  }, []);

  useEffect(() => {
    const update = () => setIsFullscreen(document.fullscreenElement === containerRef.current);
    document.addEventListener('fullscreenchange', update);
    return () => document.removeEventListener('fullscreenchange', update);
  }, []);

  // Viewport / Camera state
  const [viewport, setViewport] = useState({
    x: 180,
    y: 360,
    scale: 0.82
  });
  const viewportRef = useRef(viewport);
  viewportRef.current = viewport;

  const isDraggingRef = useRef(false);
  const dragDistanceRef = useRef(0);
  const lastMousePosRef = useRef({ x: 0, y: 0 });

  // Interactive controls state
  const [searchQuery, setSearchQuery] = useState('');
  const [selectedNode, setSelectedNode] = useState<EpistemicTopologyNode | null>(null);
  const [drawerOpen, setDrawerOpen] = useState(false);
  const [isFullscreen, setIsFullscreen] = useState(false);
  const [showQuotes, setShowQuotes] = useState(true);
  const [viewSourceMode, setViewSourceMode] = useState<'markmap' | 'canonical_cosmos'>('markmap');
  const [torusOpacity, setTorusOpacity] = useState(0.85);
  const [allCollapsed, setAllCollapsed] = useState(false);
  const [canonicalExpanded, setCanonicalExpanded] = useState(false);
  const [generating, setGenerating] = useState(false);
  const [generationError, setGenerationError] = useState<string | null>(null);

  useEffect(() => {
    const closeOnEscape = (event: KeyboardEvent) => {
      if (event.key === 'Escape') { setDrawerOpen(false); canvasRef.current?.focus(); }
    };
    if (drawerOpen) document.addEventListener('keydown', closeOnEscape);
    return () => document.removeEventListener('keydown', closeOnEscape);
  }, [drawerOpen]);

  // Active Tree Data with expand/collapse state
  const [treeData, setTreeData] = useState<EpistemicTopologyNode>(() =>
    JSON.parse(JSON.stringify(MARKMAP_EPITEMIC_TOPOLOGY))
  );

  // Starfield & Nebula pre-computed particles
  const starsRef = useRef<Array<{
    x: number;
    y: number;
    size: number;
    baseAlpha: number;
    phase: number;
    speed: number;
    color: string;
  }>>([]);

  const nebulaCloudsRef = useRef<Array<{
    x: number;
    y: number;
    radius: number;
    color: string;
    opacity: number;
  }>>([]);

  // Time ticker for ambient animations & torus rotation
  const timeRef = useRef(0);

  // Initialize Starfield and Nebula background
  useEffect(() => {
    const stars: typeof starsRef.current = [];
    const width = 3600;
    const height = 2400;

    const starColors = [
      '#ffffff',
      '#e0f2fe',
      '#38bdf8',
      '#00f0ff',
      '#c084fc',
      '#818cf8',
      '#f472b6'
    ];

    for (let i = 0; i < 450; i++) {
      stars.push({
        x: (Math.random() - 0.5) * width,
        y: (Math.random() - 0.5) * height,
        size: Math.random() < 0.85 ? Math.random() * 1.5 + 0.5 : Math.random() * 2.5 + 1.5,
        baseAlpha: Math.random() * 0.7 + 0.3,
        phase: Math.random() * Math.PI * 2,
        speed: Math.random() * 0.02 + 0.008,
        color: starColors[Math.floor(Math.random() * starColors.length)]
      });
    }
    starsRef.current = stars;

    nebulaCloudsRef.current = [
      { x: -300, y: -150, radius: 450, color: 'rgba(0, 240, 255, 0.07)', opacity: 0.8 },
      { x: 450, y: 50, radius: 600, color: 'rgba(139, 92, 246, 0.09)', opacity: 0.9 },
      { x: 100, y: -250, radius: 380, color: 'rgba(56, 189, 248, 0.06)', opacity: 0.75 },
      { x: 650, y: -200, radius: 420, color: 'rgba(217, 70, 239, 0.07)', opacity: 0.8 },
      { x: -150, y: 350, radius: 520, color: 'rgba(30, 58, 138, 0.14)', opacity: 0.85 },
      { x: 900, y: 250, radius: 380, color: 'rgba(14, 165, 233, 0.06)', opacity: 0.7 }
    ];
  }, []);

  interface PositionedNode extends EpistemicTopologyNode {
    x: number;
    y: number;
    cx?: number;
    cy?: number;
    parent?: PositionedNode;
    computedChildren?: PositionedNode[];
    isMatch?: boolean;
  }

  const layoutTree = useMemo(() => {
    let rootToRender: EpistemicTopologyNode = treeData;

    if (viewSourceMode === 'canonical_cosmos' && canonicalTreeData) {
      function convertCanonical(node: HypermapTreeNode, lvl: number = 0): EpistemicTopologyNode {
        return {
          id: node.id,
          title: node.title,
          level: lvl,
          type: lvl === 0 ? 'root' : lvl === 1 ? 'major_hub' : lvl === 2 ? 'category' : 'concept',
          radius: lvl === 0 ? 20 : lvl === 1 ? 18 : lvl === 2 ? 13 : 8,
          particleCount: lvl <= 1 ? 32 : lvl === 2 ? 18 : 10,
          color: node.node_type === 'paradox' ? '#f43f5e' : node.node_type === 'objection' ? '#f97316' : '#00f0ff',
          glowColor: node.node_type === 'paradox' ? '#fda4af' : '#38bdf8',
          warrant: node.warrant_category as any,
          epistemicStatus: node.epistemic_status,
          quoteText: node.payload_text,
          _collapsed: searchQuery.trim() ? false : node._collapsed ?? (!canonicalExpanded && lvl >= 2),
          children: node.children ? node.children.map((c) => convertCanonical(c, lvl + 1)) : undefined
        };
      }
      rootToRender = convertCanonical(canonicalTreeData);
    }

    const positioned: PositionedNode[] = [];
    const qLower = searchQuery.toLowerCase().trim();

    // Specific custom coordinates matching image_0.png layout
    const rootPos: PositionedNode = {
      ...rootToRender,
      x: -420,
      y: -310,
      isMatch: qLower ? rootToRender.title.toLowerCase().includes(qLower) : false
    };
    if (viewSourceMode === 'markmap') positioned.push(rootPos);

    if (viewSourceMode === 'markmap') {
      // 1. Orientation branch
      const nOrientation: PositionedNode = {
        id: 'mm_orientation',
        title: '0. Orientation: The Map is Not a Summary',
        level: 1,
        type: 'concept',
        radius: 12,
        particleCount: 16,
        color: '#38bdf8',
        glowColor: '#0284c7',
        x: -240,
        y: -250,
        parent: rootPos,
        quoteText: 'The map does not reduce the void; it charts the coordinates of human confrontation with the unconditioned.',
        author: 'Journal314 Epistemic Directive',
        isMatch: qLower ? '0. orientation: the map is not a summary'.includes(qLower) : false
      };
      positioned.push(nOrientation);

      // 2. Knowledge-distribution engine (Luminous cluster upper-left)
      const nKnowledge: PositionedNode = {
        id: 'mm_knowledge_engine',
        title: 'Knowledge-distribution engine',
        level: 1,
        type: 'major_hub',
        radius: 22,
        particleCount: 38,
        color: '#00f0ff',
        glowColor: '#38bdf8',
        x: -360,
        y: -190,
        parent: rootPos,
        isMatch: qLower ? 'knowledge-distribution engine'.includes(qLower) : false
      };
      positioned.push(nKnowledge);

      const nAbsorbs: PositionedNode = {
        id: 'mm_absorbs_314',
        title: 'Absorbs original 314 Markmap',
        level: 2,
        type: 'category',
        radius: 15,
        particleCount: 22,
        color: '#38bdf8',
        glowColor: '#0284c7',
        x: -270,
        y: -140,
        parent: nKnowledge,
        isMatch: qLower ? 'absorbs original 314 markmap'.includes(qLower) : false
      };
      positioned.push(nAbsorbs);

      const nOrigStruct: PositionedNode = {
        id: 'mm_original_structure',
        title: 'Original Structure',
        level: 3,
        type: 'category',
        radius: 14,
        particleCount: 18,
        color: '#38bdf8',
        glowColor: '#0284c7',
        x: -220,
        y: -80,
        parent: nAbsorbs,
        isMatch: qLower ? 'original structure'.includes(qLower) : false
      };
      positioned.push(nOrigStruct);

      // Branch: Theme
      const nTheme: PositionedNode = {
        id: 'mm_theme',
        title: 'Theme',
        level: 4,
        type: 'concept',
        radius: 13,
        particleCount: 16,
        color: '#00f0ff',
        glowColor: '#38bdf8',
        x: -160,
        y: -30,
        parent: nOrigStruct,
        isMatch: qLower ? 'theme'.includes(qLower) : false
      };
      positioned.push(nTheme);

      const themeLeaves = [
        { id: 'mm_th_1', title: 'Key concepts', y: 15 },
        { id: 'mm_th_2', title: 'Major topics', y: 50 },
        { id: 'mm_th_3', title: 'Relevant issues', y: 85 }
      ];
      themeLeaves.forEach((tl) => {
        positioned.push({
          id: tl.id,
          title: tl.title,
          level: 5,
          type: 'leaf',
          radius: 8,
          particleCount: 10,
          color: '#7dd3fc',
          x: -140,
          y: tl.y,
          parent: nTheme,
          isMatch: qLower ? tl.title.toLowerCase().includes(qLower) : false
        });
      });

      // Branch: Figure
      const nFigure: PositionedNode = {
        id: 'mm_figure',
        title: 'Figure',
        level: 4,
        type: 'concept',
        radius: 14,
        particleCount: 18,
        color: '#818cf8',
        glowColor: '#6366f1',
        x: -180,
        y: 135,
        parent: nOrigStruct,
        isMatch: qLower ? 'figure'.includes(qLower) : false
      };
      positioned.push(nFigure);

      const figureLeaves = [
        { id: 'mm_fig_1', title: 'Notable figures', y: 195 },
        { id: 'mm_fig_2', title: 'Philosophers', y: 230 },
        { id: 'mm_fig_3', title: 'Authors', y: 265 },
        { id: 'mm_fig_4', title: 'Thinkers', y: 300 }
      ];
      figureLeaves.forEach((fl) => {
        positioned.push({
          id: fl.id,
          title: fl.title,
          level: 5,
          type: 'leaf',
          radius: 8,
          particleCount: 10,
          color: '#a5b4fc',
          x: -160,
          y: fl.y,
          parent: nFigure,
          isMatch: qLower ? fl.title.toLowerCase().includes(qLower) : false
        });
      });

      // Branch: Quote-fragment (lower left trunk)
      const nQuoteFrag1: PositionedNode = {
        id: 'mm_quote_frag_1',
        title: 'Quote-fragment',
        level: 4,
        type: 'quote',
        radius: 13,
        particleCount: 16,
        color: '#38bdf8',
        glowColor: '#0284c7',
        x: -210,
        y: 350,
        parent: nOrigStruct,
        quoteText: 'The rupture of meaning precedes the reconstitution of intentional awareness.',
        author: 'Journal314 Fragment §14',
        isMatch: qLower ? 'quote-fragment'.includes(qLower) : false
      };
      positioned.push(nQuoteFrag1);

      const quoteLeaves = [
        { id: 'mm_qf_1', title: 'Significant statements', y: 395 },
        { id: 'mm_qf_2', title: 'Contextual importance', y: 430 },
        { id: 'mm_qf_3', title: 'Reflection prompts', y: 465 }
      ];
      quoteLeaves.forEach((ql) => {
        positioned.push({
          id: ql.id,
          title: ql.title,
          level: 5,
          type: 'leaf',
          radius: 8,
          particleCount: 10,
          color: '#7dd3fc',
          x: -170,
          y: ql.y,
          parent: nQuoteFrag1,
          isMatch: qLower ? ql.title.toLowerCase().includes(qLower) : false
        });
      });

      // Branch: Recurrence-signal
      const nRecurrenceSignal: PositionedNode = {
        id: 'mm_recurrence_signal',
        title: 'Recurrence-signal',
        level: 4,
        type: 'concept',
        radius: 13,
        particleCount: 16,
        color: '#38bdf8',
        glowColor: '#0284c7',
        x: -210,
        y: 520,
        parent: nOrigStruct,
        isMatch: qLower ? 'recurrence-signal'.includes(qLower) : false
      };
      positioned.push(nRecurrenceSignal);

      const recurrenceLeaves = [
        { id: 'mm_rs_1', title: 'Patterns in thought', y: 565 },
        { id: 'mm_rs_2', title: 'Common themes', y: 600 },
        { id: 'mm_rs_3', title: 'Repeated phases', y: 635 },
        { id: 'mm_rs_4', title: 'Preservation Features', y: 675 }
      ];
      recurrenceLeaves.forEach((rl) => {
        positioned.push({
          id: rl.id,
          title: rl.title,
          level: 5,
          type: 'leaf',
          radius: 8,
          particleCount: 10,
          color: '#7dd3fc',
          x: -160,
          y: rl.y,
          parent: nRecurrenceSignal,
          isMatch: qLower ? rl.title.toLowerCase().includes(qLower) : false
        });
      });

      // Left-side peripheral clusters (Existentialism -> Nihilism -> Absurdism)
      const nExistWest: PositionedNode = {
        id: 'mm_existentialism_cluster',
        title: 'Existentialism',
        level: 2,
        type: 'concept',
        radius: 15,
        particleCount: 20,
        color: '#38bdf8',
        glowColor: '#0284c7',
        x: -460,
        y: 35,
        parent: nKnowledge,
        quoteText: 'Existence precedes essence.',
        author: 'Jean-Paul Sartre',
        isMatch: qLower ? 'existentialism'.includes(qLower) : false
      };
      positioned.push(nExistWest);

      const nNihilWest: PositionedNode = {
        id: 'mm_nihilism_sub1',
        title: 'Nihilism',
        level: 3,
        type: 'concept',
        radius: 13,
        particleCount: 16,
        color: '#00f0ff',
        x: -540,
        y: 110,
        parent: nExistWest,
        quoteText: 'Nihilism stands at the door: whence comes this uncanniest of all guests?',
        author: 'Friedrich Nietzsche',
        isMatch: qLower ? 'nihilism'.includes(qLower) : false
      };
      positioned.push(nNihilWest);

      const nAbsurdWest: PositionedNode = {
        id: 'mm_absurdism_sub1',
        title: 'Absurdism',
        level: 4,
        type: 'concept',
        radius: 12,
        particleCount: 14,
        color: '#c084fc',
        x: -510,
        y: 215,
        parent: nNihilWest,
        quoteText: 'The absurd is born of this confrontation between the human call and the unreasonable silence of the world.',
        author: 'Albert Camus',
        isMatch: qLower ? 'absurdism'.includes(qLower) : false
      };
      positioned.push(nAbsurdWest);

      const nNihilDeepWest: PositionedNode = {
        id: 'mm_nihilism_deep1',
        title: 'Nihilism',
        level: 5,
        type: 'leaf',
        radius: 14,
        particleCount: 22,
        color: '#00f0ff',
        x: -420,
        y: 390,
        parent: nAbsurdWest,
        quoteText: 'The radical void is not empty; it is saturated by non-reified presence.',
        author: 'Journal314 Canon',
        isMatch: qLower ? 'nihilism'.includes(qLower) : false
      };
      positioned.push(nNihilDeepWest);

      // 3. Central Luminous Nexus: EXISTENTIAL THEMES (Massive Galaxy Hub)
      const nExistThemes: PositionedNode = {
        id: 'mm_existential_themes_nexus',
        title: 'Existential themes',
        level: 1,
        type: 'major_hub',
        radius: 28,
        particleCount: 56,
        color: '#00f0ff',
        glowColor: '#a855f7',
        x: 210,
        y: 115,
        parent: rootPos,
        quoteText: 'The encounter with the Null-Horizon is not despair, but the unconditioned aperture where being is stripped of habitual idolatry.',
        author: 'Journal314 Epistemic Core §88',
        isMatch: qLower ? 'existential themes'.includes(qLower) : false
      };
      positioned.push(nExistThemes);

      // Sub-branch: Thinkers under existential themes
      const nThinkersGroup: PositionedNode = {
        id: 'mm_thinkers_under_themes',
        title: 'Thinkers under existential themes',
        level: 2,
        type: 'category',
        radius: 17,
        particleCount: 26,
        color: '#38bdf8',
        glowColor: '#6366f1',
        x: 390,
        y: -95,
        parent: nExistThemes,
        isMatch: qLower ? 'thinkers under existential themes'.includes(qLower) : false
      };
      positioned.push(nThinkersGroup);

      const thinkersLeaves = [
        { id: 'mm_tk_0', title: 'Phussios', x: 330, y: -190, r: 8, col: '#7dd3fc' },
        { id: 'mm_tk_1', title: 'Anxiety', x: 540, y: -230, r: 10, col: '#38bdf8', quote: 'Anxiety is the dizziness of freedom.', auth: 'Søren Kierkegaard' },
        { id: 'mm_tk_2', title: 'Autism', x: 530, y: -160, r: 8, col: '#7dd3fc' },
        { id: 'mm_tk_3', title: 'Paillismsstiilsm', x: 670, y: -100, r: 8, col: '#7dd3fc' },
        { id: 'mm_tk_4', title: 'Interconnectness', x: 690, y: -40, r: 8, col: '#7dd3fc' },
        { id: 'mm_tk_5', title: 'Fear ism', x: 570, y: 10, r: 8, col: '#7dd3fc' },
        { id: 'mm_tk_6', title: 'Faxtolism', x: 670, y: 70, r: 8, col: '#7dd3fc' },
        { id: 'mm_tk_7', title: 'Empatism', x: 720, y: 120, r: 8, col: '#7dd3fc' },
        { id: 'mm_tk_8', title: 'Nihilism', x: 730, y: 170, r: 10, col: '#c084fc', quote: 'God is dead. God remains dead. And we have killed him.', auth: 'Friedrich Nietzsche' }
      ];

      thinkersLeaves.forEach((tk) => {
        positioned.push({
          id: tk.id,
          title: tk.title,
          level: 3,
          type: 'leaf',
          radius: tk.r,
          particleCount: 12,
          color: tk.col,
          x: tk.x,
          y: tk.y,
          parent: nThinkersGroup,
          quoteText: tk.quote,
          author: tk.auth,
          isMatch: qLower ? tk.title.toLowerCase().includes(qLower) : false
        });
      });

      // East branch: Nihilism
      const nNihilEast: PositionedNode = {
        id: 'mm_nihilism_main_branch',
        title: 'Nihilism',
        level: 2,
        type: 'category',
        radius: 15,
        particleCount: 20,
        color: '#00f0ff',
        glowColor: '#38bdf8',
        x: 430,
        y: 60,
        parent: nExistThemes,
        isMatch: qLower ? 'nihilism'.includes(qLower) : false
      };
      positioned.push(nNihilEast);

      // East branch: Existentialism
      const nExistEast: PositionedNode = {
        id: 'mm_existentialism_main_branch',
        title: 'Existentialism',
        level: 2,
        type: 'category',
        radius: 14,
        particleCount: 18,
        color: '#38bdf8',
        glowColor: '#0284c7',
        x: 410,
        y: 125,
        parent: nExistThemes,
        quoteText: 'The only way to deal with an unfree world is to become so absolutely free that your very existence is an act of rebellion.',
        author: 'Albert Camus',
        isMatch: qLower ? 'existentialism'.includes(qLower) : false
      };
      positioned.push(nExistEast);

      // East branch: Ouronots
      const nOuronots: PositionedNode = {
        id: 'mm_ouronots',
        title: 'Ouronots',
        level: 2,
        type: 'category',
        radius: 13,
        particleCount: 16,
        color: '#38bdf8',
        glowColor: '#0284c7',
        x: 440,
        y: 175,
        parent: nExistThemes,
        isMatch: qLower ? 'ouronots'.includes(qLower) : false
      };
      positioned.push(nOuronots);

      // Deep East Clusters
      const nQuoteEast: PositionedNode = {
        id: 'mm_quote_frag_east',
        title: 'Quote-fragment',
        level: 2,
        type: 'quote',
        radius: 13,
        particleCount: 16,
        color: '#38bdf8',
        glowColor: '#00f0ff',
        x: 520,
        y: 220,
        parent: nExistThemes,
        isMatch: qLower ? 'quote-fragment'.includes(qLower) : false
      };
      positioned.push(nQuoteEast);

      const nQuoteEastSub: PositionedNode = {
        id: 'mm_qfe_1',
        title: 'Quote-fragment',
        level: 3,
        type: 'quote',
        radius: 11,
        particleCount: 14,
        color: '#818cf8',
        x: 670,
        y: 290,
        parent: nQuoteEast,
        isMatch: qLower ? 'quote-fragment'.includes(qLower) : false
      };
      positioned.push(nQuoteEastSub);

      const nNihilEastDeep: PositionedNode = {
        id: 'mm_nihil_east_deep',
        title: 'Nihilism',
        level: 4,
        type: 'leaf',
        radius: 8,
        particleCount: 10,
        color: '#7dd3fc',
        x: 690,
        y: 360,
        parent: nQuoteEastSub,
        isMatch: qLower ? 'nihilism'.includes(qLower) : false
      };
      positioned.push(nNihilEastDeep);

      // Central Lower Cluster: Recurrenopa & Statements
      const nRecurrenceSouth: PositionedNode = {
        id: 'mm_recurrence_central',
        title: 'Recurrenopa',
        level: 2,
        type: 'concept',
        radius: 18,
        particleCount: 28,
        color: '#c084fc',
        glowColor: '#a855f7',
        x: 270,
        y: 400,
        parent: nExistThemes,
        isMatch: qLower ? 'recurrenopa'.includes(qLower) || 'recurrence'.includes(qLower) : false
      };
      positioned.push(nRecurrenceSouth);

      const nQuoteCentralSouth: PositionedNode = {
        id: 'mm_quote_frag_central',
        title: 'Quote-fragment',
        level: 2,
        type: 'quote',
        radius: 14,
        particleCount: 18,
        color: '#818cf8',
        glowColor: '#6366f1',
        x: 350,
        y: 330,
        parent: nExistThemes,
        isMatch: qLower ? 'quote-fragment'.includes(qLower) : false
      };
      positioned.push(nQuoteCentralSouth);

      const recurrenceSouthLeaves = [
        { id: 'mm_rc_sig', title: 'Recurrence-signal', x: 140, y: 520, col: '#818cf8' },
        { id: 'mm_rc_th', title: 'Thought', x: 215, y: 580, col: '#e879f9' },
        { id: 'mm_rc_nih', title: 'Nihilism', x: 290, y: 585, col: '#e879f9' },
        { id: 'mm_rc_barr', title: 'Barnotantsation', x: 380, y: 540, col: '#a5b4fc' },
        { id: 'mm_rc_st', title: 'Statements', x: 490, y: 510, col: '#a5b4fc' },
        { id: 'mm_rc_nih2', title: 'Nihilism', x: 420, y: 570, col: '#a5b4fc' },
        { id: 'mm_rc_jrea', title: 'Jreaultser', x: 505, y: 565, col: '#818cf8' }
      ];

      recurrenceSouthLeaves.forEach((rsl) => {
        positioned.push({
          id: rsl.id,
          title: rsl.title,
          level: 3,
          type: 'leaf',
          radius: 8,
          particleCount: 10,
          color: rsl.col,
          x: rsl.x,
          y: rsl.y,
          parent: nRecurrenceSouth,
          isMatch: qLower ? rsl.title.toLowerCase().includes(qLower) : false
        });
      });
    } else {
      function layoutCanonicalSubtree(node: EpistemicTopologyNode, x: number, y: number, angleSpan: number, angleCenter: number, depth: number) {
        const pNode: PositionedNode = {
          ...node,
          x,
          y,
          isMatch: qLower ? node.title.toLowerCase().includes(qLower) : false
        };
        positioned.push(pNode);

        if (!node.children || node.children.length === 0 || node._collapsed) return;

        const count = node.children.length;
        const step = count === 1 ? 0 : angleSpan / (count - 1);
        const dist = depth === 0 ? 320 : depth === 1 ? 240 : depth === 2 ? 180 : 130;

        node.children.forEach((child, i) => {
          const a = count === 1 ? angleCenter : (angleCenter - angleSpan / 2) + i * step;
          const cx = x + Math.cos(a) * dist;
          const cy = y + Math.sin(a) * dist;
          const pChild = { ...child, parent: pNode };
          layoutCanonicalSubtree(pChild, cx, cy, angleSpan * 0.7, a, depth + 1);
        });
      }

      layoutCanonicalSubtree(rootToRender, 0, 0, Math.PI * 1.6, 0, 0);
    }

    const byId = new Map(positioned.map(node => [node.id, node]));
    positioned.forEach(node => { node.children = []; node.isMatch = Boolean(qLower && `${node.title} ${node.quoteText || ''}`.toLowerCase().includes(qLower)); });
    positioned.forEach(node => { if (node.parent) byId.get(node.parent.id)?.children?.push(node); });
    return allCollapsed && !qLower ? positioned.filter(node => node.level <= 1) : positioned;
  }, [treeData, viewSourceMode, canonicalTreeData, searchQuery, allCollapsed, canonicalExpanded]);

  const handlePointerDown = (e: React.PointerEvent<HTMLCanvasElement>) => {
    if (e.button !== 0) return;
    e.currentTarget.setPointerCapture(e.pointerId);
    dragDistanceRef.current = 0;
    isDraggingRef.current = true;
    lastMousePosRef.current = { x: e.clientX, y: e.clientY };
  };

  const handlePointerMove = (e: React.PointerEvent<HTMLCanvasElement>) => {
    if (!isDraggingRef.current) return;
    const dx = e.clientX - lastMousePosRef.current.x;
    const dy = e.clientY - lastMousePosRef.current.y;
    dragDistanceRef.current += Math.hypot(dx, dy);
    lastMousePosRef.current = { x: e.clientX, y: e.clientY };

    setViewport((prev) => ({
      ...prev,
      x: prev.x + dx,
      y: prev.y + dy
    }));
  };

  const handlePointerUp = (e: React.PointerEvent<HTMLCanvasElement>) => {
    isDraggingRef.current = false;
    if (e.currentTarget.hasPointerCapture(e.pointerId)) e.currentTarget.releasePointerCapture(e.pointerId);
  };

  const handleWheel = useCallback((e: WheelEvent) => {
    e.preventDefault();
    const zoomFactor = e.deltaY < 0 ? 1.1 : 0.9;
    const rect = canvasRef.current?.getBoundingClientRect();
    if (!rect) return;

    const mouseX = e.clientX - rect.left;
    const mouseY = e.clientY - rect.top;

    setViewport((prev) => {
      const newScale = Math.min(Math.max(prev.scale * zoomFactor, 0.2), 3.2);
      const newX = mouseX - (mouseX - prev.x) * (newScale / prev.scale);
      const newY = mouseY - (mouseY - prev.y) * (newScale / prev.scale);
      return { x: newX, y: newY, scale: newScale };
    });
  }, []);

  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    canvas.addEventListener('wheel', handleWheel, { passive: false });
    return () => canvas.removeEventListener('wheel', handleWheel);
  }, [handleWheel]);

  const handleCanvasClick = (e: React.MouseEvent<HTMLCanvasElement>) => {
    if (dragDistanceRef.current > 4) return;
    const rect = canvasRef.current?.getBoundingClientRect();
    if (!rect) return;

    const canvasX = e.clientX - rect.left;
    const canvasY = e.clientY - rect.top;

    const worldX = (canvasX - viewport.x) / viewport.scale;
    const worldY = (canvasY - viewport.y) / viewport.scale;

    let found: PositionedNode | null = null;
    for (const node of layoutTree) {
      const hitRadius = Math.max(node.radius || 12, 16);
      const dist = Math.hypot(node.x - worldX, node.y - worldY);
      if (dist <= hitRadius) {
        found = node;
        break;
      }
    }

    if (found) {
      setSelectedNode(found);
      setDrawerOpen(true);
      if (onSelectCanonicalNode && canonicalTreeData) {
        const findCanonical = (n: HypermapTreeNode): HypermapTreeNode | null => {
          if (n.id === found?.id || n.title === found?.title) return n;
          if (n.children) {
            for (const c of n.children) {
              const res = findCanonical(c);
              if (res) return res;
            }
          }
          return null;
        };
        const cNode = findCanonical(canonicalTreeData);
        if (cNode) onSelectCanonicalNode(cNode);
      }
    }
  };

  const handleExpandAll = () => {
    setAllCollapsed(false);
    setCanonicalExpanded(true);
    const expand = (n: EpistemicTopologyNode) => {
      n._collapsed = false;
      if (n.children) n.children.forEach(expand);
    };
    const cloned = JSON.parse(JSON.stringify(treeData));
    expand(cloned);
    setTreeData(cloned);
  };

  const handleCollapseAll = () => {
    setAllCollapsed(true);
    setCanonicalExpanded(false);
    const collapse = (n: EpistemicTopologyNode) => {
      if (n.level > 0) n._collapsed = true;
      if (n.children) n.children.forEach(collapse);
    };
    const cloned = JSON.parse(JSON.stringify(treeData));
    collapse(cloned);
    setTreeData(cloned);
  };

  const handleResetView = () => {
    const canvas = canvasRef.current;
    if (!canvas || !layoutTree.length) return;
    const minX = Math.min(...layoutTree.map(n => n.x)) - 40;
    const maxX = Math.max(...layoutTree.map(n => n.x)) + 180;
    const minY = Math.min(...layoutTree.map(n => n.y)) - 40;
    const maxY = Math.max(...layoutTree.map(n => n.y)) + 40;
    const toolbarSpace = canvas.clientWidth < 1280 ? 160 : 48;
    const availableHeight = Math.max(160, canvas.clientHeight - headerHeight - toolbarSpace - 96);
    const scale = Math.max(0.15, Math.min(0.85, (canvas.clientWidth - 64) / (maxX - minX), availableHeight / (maxY - minY)));
    setViewport({ x: canvas.clientWidth / 2 - (minX + maxX) / 2 * scale, y: headerHeight + toolbarSpace + 32 + availableHeight / 2 - (minY + maxY) / 2 * scale, scale });
  };

  useEffect(() => { handleResetView(); }, [viewSourceMode, headerHeight]);

  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const ctx = canvas.getContext('2d');
    if (!ctx) return;

    let running = true;
    let lastFrame = 0;

    const render = (now: number) => {
      if (!running) return;
      if (document.hidden || now - lastFrame < 1000 / 30) {
        animFrameIdRef.current = requestAnimationFrame(render);
        return;
      }
      timeRef.current += lastFrame ? Math.min((now - lastFrame) / 1000, 0.05) : 1 / 30;
      lastFrame = now;
      const t = timeRef.current;

      const width = canvas.clientWidth;
      const height = canvas.clientHeight;
      const dpr = Math.min(window.devicePixelRatio || 1, 2);
      const pixelWidth = Math.round(width * dpr), pixelHeight = Math.round(height * dpr);
      if (canvas.width !== pixelWidth || canvas.height !== pixelHeight) {
        canvas.width = pixelWidth;
        canvas.height = pixelHeight;
      }
      ctx.setTransform(dpr, 0, 0, dpr, 0, 0);

      // 1. Deep Cosmic Void Background
      const bgGrad = ctx.createRadialGradient(
        width / 2,
        height / 2,
        100,
        width / 2,
        height / 2,
        Math.max(width, height) * 0.85
      );
      bgGrad.addColorStop(0, '#040714');
      bgGrad.addColorStop(0.5, '#02040b');
      bgGrad.addColorStop(1, '#010206');
      ctx.fillStyle = bgGrad;
      ctx.fillRect(0, 0, width, height);

      const { x: vx, y: vy, scale: s } = viewportRef.current;

      // 2. Swirling Nebula Clouds
      ctx.save();
      ctx.translate(vx, vy);
      ctx.scale(s, s);

      nebulaCloudsRef.current.forEach((neb, idx) => {
        const pulse = 1 + 0.08 * Math.sin(t * 0.4 + idx * 1.5);
        const grad = ctx.createRadialGradient(
          neb.x,
          neb.y,
          0,
          neb.x,
          neb.y,
          neb.radius * pulse
        );
        grad.addColorStop(0, neb.color);
        grad.addColorStop(0.6, neb.color.replace(/[\d\.]+\)$/, '0.03)'));
        grad.addColorStop(1, 'transparent');
        ctx.fillStyle = grad;
        ctx.beginPath();
        ctx.arc(neb.x, neb.y, neb.radius * pulse, 0, Math.PI * 2);
        ctx.fill();
      });

      // 3. Faint 3D Torus / Vortex Wireframe Geometry
      if (torusOpacity > 0.05) {
        ctx.save();
        ctx.lineWidth = 1;
        const R = 320;
        const r = 120;
        const rotY = t * 0.12;
        const rotX = 0.55 + 0.08 * Math.sin(t * 0.15);

        const uSteps = 16;
        const vSteps = 24;

        ctx.strokeStyle = `rgba(56, 189, 248, ${0.09 * torusOpacity})`;

        for (let i = 0; i < uSteps; i++) {
          const u = (i / uSteps) * Math.PI * 2;
          ctx.beginPath();
          for (let j = 0; j <= vSteps; j++) {
            const v = (j / vSteps) * Math.PI * 2;
            const tx = (R + r * Math.cos(v)) * Math.cos(u);
            const ty = (R + r * Math.cos(v)) * Math.sin(u);
            const tz = r * Math.sin(v);

            const x1 = tx * Math.cos(rotY) + tz * Math.sin(rotY);
            const z1 = -tx * Math.sin(rotY) + tz * Math.cos(rotY);
            const y2 = ty * Math.cos(rotX) - z1 * Math.sin(rotX);
            const z2 = ty * Math.sin(rotX) + z1 * Math.cos(rotX);

            const fov = 900;
            const factor = fov / (fov + z2 + 400);
            const screenX = 180 + x1 * factor;
            const screenY = 120 + y2 * factor;

            if (j === 0) ctx.moveTo(screenX, screenY);
            else ctx.lineTo(screenX, screenY);
          }
          ctx.stroke();
        }

        ctx.strokeStyle = `rgba(168, 85, 247, ${0.07 * torusOpacity})`;
        for (let j = 0; j < vSteps; j += 2) {
          const v = (j / vSteps) * Math.PI * 2;
          ctx.beginPath();
          for (let i = 0; i <= uSteps; i++) {
            const u = (i / uSteps) * Math.PI * 2;
            const tx = (R + r * Math.cos(v)) * Math.cos(u);
            const ty = (R + r * Math.cos(v)) * Math.sin(u);
            const tz = r * Math.sin(v);

            const x1 = tx * Math.cos(rotY) + tz * Math.sin(rotY);
            const z1 = -tx * Math.sin(rotY) + tz * Math.cos(rotY);
            const y2 = ty * Math.cos(rotX) - z1 * Math.sin(rotX);
            const z2 = ty * Math.sin(rotX) + z1 * Math.cos(rotX);

            const fov = 900;
            const factor = fov / (fov + z2 + 400);
            const screenX = 180 + x1 * factor;
            const screenY = 120 + y2 * factor;

            if (i === 0) ctx.moveTo(screenX, screenY);
            else ctx.lineTo(screenX, screenY);
          }
          ctx.stroke();
        }
        ctx.restore();
      }

      // 4. Multi-Layered Twinkling Starfield
      starsRef.current.forEach((st) => {
        const twinkle = Math.sin(t * st.speed * 20 + st.phase);
        const alpha = Math.max(0.1, Math.min(1, st.baseAlpha + 0.25 * twinkle));
        ctx.fillStyle = st.color;
        ctx.globalAlpha = alpha;
        ctx.beginPath();
        ctx.arc(st.x, st.y, st.size, 0, Math.PI * 2);
        ctx.fill();
      });
      ctx.globalAlpha = 1;

      // 5. Sweeping Cosmic River Bridges (as in image.png)
      if (viewSourceMode === 'markmap') {
        const themeNode = layoutTree.find((n) => n.id === 'mm_theme');
        const figureNode = layoutTree.find((n) => n.id === 'mm_figure');
        const existThemesNode = layoutTree.find((n) => n.id === 'mm_existential_themes_nexus');
        const thinkersNode = layoutTree.find((n) => n.id === 'mm_thinkers_under_themes');
        const origStructNode = layoutTree.find((n) => n.id === 'mm_original_structure');
        const westNihilNode = layoutTree.find((n) => n.id === 'mm_nihilism_sub1');

        const drawSweepingRiver = (
          x1: number,
          y1: number,
          x2: number,
          y2: number,
          colorA: string,
          colorB: string,
          curvature = 0.28,
          photonCount = 4
        ) => {
          const dx = x2 - x1;
          const dy = y2 - y1;
          const cx1 = x1 + dx * 0.45;
          const cy1 = y1 + dy * 0.1 - Math.abs(dx) * curvature;
          const cx2 = x1 + dx * 0.65;
          const cy2 = y2 - dy * 0.1 - Math.abs(dx) * curvature * 0.6;

          ctx.save();

          // Outer diffuse energy river haze
          ctx.beginPath();
          ctx.moveTo(x1, y1);
          ctx.bezierCurveTo(cx1, cy1, cx2, cy2, x2, y2);
          ctx.strokeStyle = colorA;
          ctx.lineWidth = 16;
          ctx.globalAlpha = 0.08 + 0.03 * Math.sin(t * 2);
          ctx.stroke();

          // Intermediate luminous channel
          ctx.beginPath();
          ctx.moveTo(x1, y1);
          ctx.bezierCurveTo(cx1, cy1, cx2, cy2, x2, y2);
          const streamGrad = ctx.createLinearGradient(x1, y1, x2, y2);
          streamGrad.addColorStop(0, colorA);
          streamGrad.addColorStop(0.5, colorB);
          streamGrad.addColorStop(1, colorA);
          ctx.strokeStyle = streamGrad;
          ctx.shadowColor = colorA;
          ctx.shadowBlur = 20;
          ctx.lineWidth = 3.5;
          ctx.globalAlpha = 0.85;
          ctx.stroke();

          // High-intensity white core filament
          ctx.strokeStyle = '#ffffff';
          ctx.lineWidth = 1.4;
          ctx.globalAlpha = 0.95;
          ctx.stroke();

          // High-speed photons streaming across the bridge
          for (let p = 0; p < photonCount; p++) {
            const offset = (t * 0.45 + p / photonCount) % 1;
            const u = offset;
            const px =
              Math.pow(1 - u, 3) * x1 +
              3 * Math.pow(1 - u, 2) * u * cx1 +
              3 * (1 - u) * Math.pow(u, 2) * cx2 +
              Math.pow(u, 3) * x2;
            const py =
              Math.pow(1 - u, 3) * y1 +
              3 * Math.pow(1 - u, 2) * u * cy1 +
              3 * (1 - u) * Math.pow(u, 2) * cx2 +
              Math.pow(u, 3) * y2;

            ctx.shadowColor = '#00f0ff';
            ctx.shadowBlur = 14;
            ctx.fillStyle = '#ffffff';
            ctx.beginPath();
            ctx.arc(px, py, 2.5, 0, Math.PI * 2);
            ctx.fill();

            // Comet tail
            ctx.fillStyle = colorA;
            ctx.globalAlpha = 0.65;
            ctx.beginPath();
            ctx.arc(px - dx * 0.015, py - dy * 0.015, 1.6, 0, Math.PI * 2);
            ctx.fill();
          }

          ctx.restore();
        };

        if (themeNode && existThemesNode) {
          drawSweepingRiver(themeNode.x, themeNode.y, existThemesNode.x, existThemesNode.y, '#00f0ff', '#a855f7', 0.28, 4);
        }
        if (figureNode && existThemesNode) {
          drawSweepingRiver(figureNode.x, figureNode.y, existThemesNode.x, existThemesNode.y, '#818cf8', '#00f0ff', -0.16, 3);
        }
        if (origStructNode && thinkersNode) {
          drawSweepingRiver(origStructNode.x, origStructNode.y, thinkersNode.x, thinkersNode.y, '#38bdf8', '#818cf8', 0.35, 3);
        }
        if (westNihilNode && existThemesNode) {
          drawSweepingRiver(westNihilNode.x, westNihilNode.y, existThemesNode.x, existThemesNode.y, '#38bdf8', '#c084fc', -0.22, 3);
        }
      }

      // 6. Luminous Connecting Lines
      layoutTree.forEach((node) => {
        if (!node.parent) return;

        const p = node.parent;
        const isSelectedBranch = selectedNode && (selectedNode.id === node.id || selectedNode.id === p.id);
        const isMajorTrunk = node.level <= 2;

        const dx = node.x - p.x;
        const dy = node.y - p.y;
        const cx1 = p.x + dx * 0.45;
        const cy1 = p.y + dy * 0.1;
        const cx2 = p.x + dx * 0.55;
        const cy2 = node.y - dy * 0.1;

        ctx.save();
        ctx.beginPath();
        ctx.moveTo(p.x, p.y);
        ctx.bezierCurveTo(cx1, cy1, cx2, cy2, node.x, node.y);

        const glowColor = node.color || '#38bdf8';
        ctx.shadowColor = glowColor;
        ctx.shadowBlur = isSelectedBranch ? 18 : isMajorTrunk ? 12 : 6;

        const lineGrad = ctx.createLinearGradient(p.x, p.y, node.x, node.y);
        if (node.level === 1) {
          lineGrad.addColorStop(0, '#00f0ff');
          lineGrad.addColorStop(0.5, '#3b82f6');
          lineGrad.addColorStop(1, '#a855f7');
        } else if (node.type === 'major_hub' || p.type === 'major_hub') {
          lineGrad.addColorStop(0, '#00f0ff');
          lineGrad.addColorStop(1, '#c084fc');
        } else {
          lineGrad.addColorStop(0, p.color || '#38bdf8');
          lineGrad.addColorStop(1, node.color || '#00f0ff');
        }

        ctx.strokeStyle = lineGrad;
        ctx.lineWidth = isSelectedBranch ? 4 : isMajorTrunk ? 3 : 1.4;
        ctx.globalAlpha = isSelectedBranch ? 1.0 : isMajorTrunk ? 0.85 : 0.65;
        ctx.stroke();
        ctx.restore();

        // Dynamic Light Stream Pulses
        const pulseOffset = (t * 0.8 + node.x * 0.005) % 1;
        const u = pulseOffset;
        const px =
          Math.pow(1 - u, 3) * p.x +
          3 * Math.pow(1 - u, 2) * u * cx1 +
          3 * (1 - u) * Math.pow(u, 2) * cx2 +
          Math.pow(u, 3) * node.x;
        const py =
          Math.pow(1 - u, 3) * p.y +
          3 * Math.pow(1 - u, 2) * u * cy1 +
          3 * (1 - u) * Math.pow(u, 2) * cx2 +
          Math.pow(u, 3) * node.y;

        ctx.save();
        ctx.shadowColor = '#00f0ff';
        ctx.shadowBlur = 10;
        ctx.fillStyle = '#ffffff';
        ctx.beginPath();
        ctx.arc(px, py, isMajorTrunk ? 2.5 : 1.8, 0, Math.PI * 2);
        ctx.fill();
        ctx.restore();
      });

      // 7. Render Luminous Data Clusters
      layoutTree.forEach((node) => {
        const isRoot = node.type === 'root';
        const isMajorHub = node.type === 'major_hub';
        const isSelected = selectedNode?.id === node.id;
        const isMatch = node.isMatch;
        const r = node.radius || 10;

        // Draw Root Capsule Node on Canvas with high fidelity
        if (isRoot && viewSourceMode === 'markmap') {
          ctx.save();
          ctx.translate(node.x, node.y);

          const capsuleWidth = 330;
          const capsuleHeight = 32;
          const pillX = -capsuleWidth / 2;
          const pillY = -capsuleHeight / 2;

          ctx.shadowColor = '#00f0ff';
          ctx.shadowBlur = 20;
          ctx.fillStyle = 'rgba(2, 6, 23, 0.85)';
          ctx.strokeStyle = 'rgba(0, 240, 255, 0.9)';
          ctx.lineWidth = 1.5;

          ctx.beginPath();
          ctx.roundRect(pillX, pillY, capsuleWidth, capsuleHeight, 16);
          ctx.fill();
          ctx.stroke();

          // Left minus icon [-]
          ctx.strokeStyle = '#38bdf8';
          ctx.fillStyle = 'rgba(14, 165, 233, 0.2)';
          ctx.lineWidth = 1.2;
          ctx.beginPath();
          ctx.arc(pillX + 20, 0, 7.5, 0, Math.PI * 2);
          ctx.fill();
          ctx.stroke();

          ctx.strokeStyle = '#ffffff';
          ctx.lineWidth = 1.8;
          ctx.beginPath();
          ctx.moveTo(pillX + 16, 0);
          ctx.lineTo(pillX + 24, 0);
          ctx.stroke();

          // Capsule text
          ctx.fillStyle = '#ffffff';
          ctx.font = 'bold 12px system-ui, -apple-system, sans-serif';
          ctx.textAlign = 'left';
          ctx.textBaseline = 'middle';
          ctx.shadowBlur = 10;
          ctx.shadowColor = '#00f0ff';
          ctx.fillText('JOURNAL314 Ω — Nihiltheistic Hypermarkmap', pillX + 36, 1);

          ctx.restore();
          return;
        }

        ctx.save();
        ctx.translate(node.x, node.y);

        // Stardust Galaxy Particle Cloud
        const pCount = node.particleCount || (isMajorHub ? 45 : 20);
        const auraRadius = r * (isMajorHub ? 3.2 : 2.2);

        for (let i = 0; i < pCount; i++) {
          const pAngle = (i / pCount) * Math.PI * 2 + t * 0.35 * (i % 2 === 0 ? 1 : -0.7);
          const pDist = r * 1.1 + ((i * 23) % Math.floor(auraRadius - r));
          const ppx = Math.cos(pAngle) * pDist;
          const ppy = Math.sin(pAngle) * pDist;
          const pAlpha = 0.3 + 0.5 * Math.sin(t * 1.8 + i);

          ctx.fillStyle = i % 4 === 0 ? '#ffffff' : i % 3 === 0 ? '#c084fc' : node.color || '#00f0ff';
          ctx.globalAlpha = isSelected ? pAlpha * 1.3 : pAlpha;
          ctx.beginPath();
          ctx.arc(ppx, ppy, i % 5 === 0 ? 1.8 : i % 2 === 0 ? 1.2 : 0.8, 0, Math.PI * 2);
          ctx.fill();
        }
        ctx.globalAlpha = 1;

        // Optical Star Flare (4-point diffraction cross) on major hubs & category anchors
        if (isMajorHub || node.level <= 2) {
          const spikeLen = r * (isMajorHub ? 3.8 : 2.4);
          const flarePulse = 0.85 + 0.15 * Math.sin(t * 3.5 + node.x * 0.05);

          ctx.save();
          ctx.lineWidth = 1.2;

          const flareGradH = ctx.createLinearGradient(-spikeLen, 0, spikeLen, 0);
          flareGradH.addColorStop(0, 'transparent');
          flareGradH.addColorStop(0.5, '#ffffff');
          flareGradH.addColorStop(1, 'transparent');
          ctx.strokeStyle = flareGradH;
          ctx.beginPath();
          ctx.moveTo(-spikeLen * flarePulse, 0);
          ctx.lineTo(spikeLen * flarePulse, 0);
          ctx.stroke();

          const flareGradV = ctx.createLinearGradient(0, -spikeLen, 0, spikeLen);
          flareGradV.addColorStop(0, 'transparent');
          flareGradV.addColorStop(0.5, '#ffffff');
          flareGradV.addColorStop(1, 'transparent');
          ctx.strokeStyle = flareGradV;
          ctx.beginPath();
          ctx.moveTo(0, -spikeLen * flarePulse);
          ctx.lineTo(0, spikeLen * flarePulse);
          ctx.stroke();

          ctx.restore();
        }

        const haloGrad = ctx.createRadialGradient(0, 0, r * 0.2, 0, 0, r * 2.2);
        haloGrad.addColorStop(0, node.color || '#00f0ff');
        haloGrad.addColorStop(0.4, node.glowColor || 'rgba(56, 189, 248, 0.4)');
        haloGrad.addColorStop(1, 'transparent');
        ctx.fillStyle = haloGrad;
        ctx.beginPath();
        ctx.arc(0, 0, r * 2.2, 0, Math.PI * 2);
        ctx.fill();

        ctx.shadowColor = node.color || '#00f0ff';
        ctx.shadowBlur = isSelected ? 24 : isMajorHub ? 18 : 10;
        ctx.fillStyle = isSelected ? '#ffffff' : node.color || '#00f0ff';
        ctx.beginPath();
        ctx.arc(0, 0, isSelected ? r * 1.25 : r, 0, Math.PI * 2);
        ctx.fill();

        ctx.fillStyle = '#ffffff';
        ctx.beginPath();
        ctx.arc(0, 0, r * 0.45, 0, Math.PI * 2);
        ctx.fill();

        if (isMatch || isSelected) {
          const ringPulse = 1 + 0.25 * Math.sin(t * 4);
          ctx.strokeStyle = isMatch ? '#fbbf24' : '#38bdf8';
          ctx.lineWidth = 2;
          ctx.beginPath();
          ctx.arc(0, 0, r * 2.4 * ringPulse, 0, Math.PI * 2);
          ctx.stroke();
        }

        ctx.restore();
        ctx.save();

        const textX = node.x + (node.children && node.level <= 1 ? -r - 12 : r + 10);
        const textY = node.y + 4;
        const textAnchor = node.children && node.level <= 1 ? 'right' : 'left';

        ctx.textAlign = textAnchor;
        ctx.textBaseline = 'middle';

        if (isRoot) {
          ctx.font = 'bold 15px system-ui, -apple-system, sans-serif';
        } else if (isMajorHub) {
          ctx.font = '600 13px system-ui, -apple-system, sans-serif';
        } else if (node.level <= 2) {
          ctx.font = '500 11.5px system-ui, -apple-system, sans-serif';
        } else {
          ctx.font = '400 10.5px system-ui, -apple-system, sans-serif';
        }

        ctx.shadowColor = node.color || '#00f0ff';
        ctx.shadowBlur = isSelected ? 12 : isMajorHub ? 8 : 4;
        ctx.fillStyle = isMatch
          ? '#fef08a'
          : isSelected
          ? '#ffffff'
          : isMajorHub
          ? '#e0f2fe'
          : '#f1f5f9';

        ctx.fillText(node.title, textX, textY);
        ctx.restore();
      });

      // 7. Distinct Floating Quotes & Critiques Blocks
      if (showQuotes) {
        ctx.save();
        FAMOUS_PHILOSOPHICAL_QUOTES.forEach((pq) => {
          const targetNode = layoutTree.find((n) => n.id === pq.relationNodeId);
          if (!targetNode) return;

          const qx = targetNode.x + 24;
          const qy = targetNode.y + 24;

          ctx.strokeStyle = 'rgba(168, 85, 247, 0.4)';
          ctx.lineWidth = 1;
          ctx.beginPath();
          ctx.moveTo(targetNode.x, targetNode.y);
          ctx.lineTo(qx, qy);
          ctx.stroke();

          ctx.fillStyle = 'rgba(15, 23, 42, 0.75)';
          ctx.strokeStyle = 'rgba(139, 92, 246, 0.5)';
          ctx.lineWidth = 1;

          const quoteWidth = 180;
          const quoteHeight = 36;
          ctx.beginPath();
          ctx.roundRect(qx, qy, quoteWidth, quoteHeight, 6);
          ctx.fill();
          ctx.stroke();

          ctx.fillStyle = '#f8fafc';
          ctx.font = 'italic 9px Georgia, serif';
          ctx.textAlign = 'left';
          ctx.textBaseline = 'top';
          ctx.fillText(`“${pq.quote.slice(0, 32)}…”`, qx + 8, qy + 6);

          ctx.fillStyle = '#38bdf8';
          ctx.font = 'bold 8px system-ui, sans-serif';
          ctx.fillText(`— ${pq.author}`, qx + 8, qy + 20);
        });
        ctx.restore();
      }

      ctx.restore();
      animFrameIdRef.current = requestAnimationFrame(render);
    };

    animFrameIdRef.current = requestAnimationFrame(render);

    return () => {
      running = false;
      if (animFrameIdRef.current !== null) {
        cancelAnimationFrame(animFrameIdRef.current);
      }
    };
  }, [layoutTree, showQuotes, torusOpacity, selectedNode]);

  return (
    <div
      ref={containerRef}
      style={{ '--header-bottom': `${headerHeight + 32}px` } as React.CSSProperties}
      className={`relative w-full h-full min-h-screen overflow-hidden select-none font-sans bg-black ${
        isFullscreen ? 'fixed inset-0 z-50' : 'w-screen h-screen'
      }`}
    >
      {/* 1. Canvas Viewport */}
      <canvas
        ref={canvasRef}
        onPointerDown={handlePointerDown}
        onPointerMove={handlePointerMove}
        onPointerUp={handlePointerUp}
        onPointerCancel={handlePointerUp}
        onClick={handleCanvasClick}
        data-node-count={layoutTree.length}
        tabIndex={0}
        aria-label="Interactive topology graph. Enter inspects the root, arrow keys pan, plus and minus zoom, Home resets, Escape closes the inspector."
        onKeyDown={(event) => {
          if (event.key === 'Enter') { setSelectedNode(layoutTree[0]); setDrawerOpen(true); }
          else if (event.key === 'Escape') setDrawerOpen(false);
          else if (event.key === 'Home') { event.preventDefault(); handleResetView(); }
          else if (['ArrowLeft', 'ArrowRight', 'ArrowUp', 'ArrowDown'].includes(event.key)) {
            event.preventDefault();
            setViewport(v => ({ ...v, x: v.x + (event.key === 'ArrowLeft' ? 30 : event.key === 'ArrowRight' ? -30 : 0), y: v.y + (event.key === 'ArrowUp' ? 30 : event.key === 'ArrowDown' ? -30 : 0) }));
          } else if (['+', '=', '-'].includes(event.key)) {
            event.preventDefault();
            setViewport(v => ({ ...v, scale: Math.min(3.2, Math.max(0.2, v.scale * (event.key === '-' ? 0.9 : 1.1))) }));
          }
        }}
        style={{ touchAction: 'none' }}
        className="w-full h-full cursor-grab active:cursor-grabbing block focus-visible:outline focus-visible:outline-cyan-400"
      />

      {/* 2. Floating Holographic Header Panel */}
      <header
        ref={headerRef}
        className="absolute top-4 left-4 right-4 sm:right-auto sm:max-w-2xl z-30 p-4 rounded-xl border backdrop-blur-xl transition-all duration-300 pointer-events-auto"
        style={{
          backgroundColor: 'rgba(4, 8, 22, 0.72)',
          borderColor: 'rgba(56, 189, 248, 0.75)',
          boxShadow:
            '0 0 25px rgba(0, 240, 255, 0.28), inset 0 0 16px rgba(139, 92, 246, 0.22)'
        }}
      >
        <div className="flex flex-col space-y-2.5">
          <div>
            <h1 className="text-lg sm:text-xl font-bold tracking-wide text-white drop-shadow-[0_0_12px_rgba(0,240,255,0.7)] flex items-center gap-2">
              <Sparkles className="w-5 h-5 text-cyan-400 animate-pulse" />
              <span>JOURNAL314 Ω — Nihiltheistic Hypermap Visual</span>
            </h1>
            <p className="text-xs font-mono text-cyan-300/90 tracking-wider mt-0.5">
              {stats ? `2 root trees · ${stats.totalNodes.toLocaleString()} saved nodes` : 'Visual reference map · saved graph loading'}
            </p>
          </div>

          <div className="flex flex-wrap items-center gap-2.5 pt-1">
            <button
              onClick={handleExpandAll}
              className="px-3 py-1.5 rounded-lg text-xs font-medium text-cyan-200 border transition-all duration-200 hover:text-white flex items-center gap-1.5 active:scale-95"
              style={{
                backgroundColor: 'rgba(8, 24, 48, 0.65)',
                borderColor: 'rgba(56, 189, 248, 0.8)',
                boxShadow: '0 0 10px rgba(56, 189, 248, 0.3)'
              }}
            >
              <ChevronDown className="w-3.5 h-3.5 text-cyan-400" />
              <span>Expand all</span>
            </button>

            <button
              onClick={handleCollapseAll}
              className="px-3 py-1.5 rounded-lg text-xs font-medium text-purple-200 border transition-all duration-200 hover:text-white flex items-center gap-1.5 active:scale-95"
              style={{
                backgroundColor: 'rgba(28, 12, 48, 0.65)',
                borderColor: 'rgba(168, 85, 247, 0.8)',
                boxShadow: '0 0 10px rgba(168, 85, 247, 0.3)'
              }}
            >
              <ChevronRight className="w-3.5 h-3.5 text-purple-400" />
              <span>Collapse all</span>
            </button>

            <div className="relative flex-1 min-w-[170px]">
              <Search className="w-3.5 h-3.5 text-cyan-400 absolute left-3 top-2.5" />
              <input
                type="text"
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                placeholder="Search the mindmap..."
                className="w-full rounded-lg pl-8 pr-7 py-1.5 text-xs text-white placeholder-cyan-400/50 border transition-all duration-200 focus:outline-none focus:ring-1 focus:ring-cyan-400"
                style={{
                  backgroundColor: 'rgba(3, 7, 18, 0.7)',
                  borderColor: 'rgba(56, 189, 248, 0.7)',
                  boxShadow: 'inset 0 0 8px rgba(56, 189, 248, 0.2)'
                }}
              />
              {searchQuery && (
                <button
                  onClick={() => setSearchQuery('')}
                  className="absolute right-2.5 top-2.5 text-cyan-400 hover:text-white"
                >
                  <X className="w-3.5 h-3.5" />
                </button>
              )}
            </div>
          </div>
        </div>
      </header>

      {/* 3. Floating Root Capsule Node */}
      <button type="button"
        onClick={() => {
          setSelectedNode(MARKMAP_EPITEMIC_TOPOLOGY);
          setDrawerOpen(true);
        }}
        className="absolute top-[var(--header-bottom)] left-6 max-w-[calc(100%-3rem)] z-20 px-3.5 py-1.5 rounded-full border backdrop-blur-md cursor-pointer transition-all duration-200 hover:scale-105 flex items-center gap-2 group"
        style={{
          backgroundColor: 'rgba(2, 6, 23, 0.8)',
          borderColor: 'rgba(0, 240, 255, 0.85)',
          boxShadow: '0 0 16px rgba(0, 240, 255, 0.4), inset 0 0 8px rgba(0, 240, 255, 0.2)'
        }}
      >
        <span className="w-2 h-2 rounded-full bg-cyan-400 animate-ping"></span>
        <span className="truncate text-xs font-mono font-bold text-cyan-200 tracking-wide group-hover:text-white">
          [-] JOURNAL314 Ω — Nihiltheistic Hypermarkmap
        </span>
      </button>

      {/* 4. Floating Viewport & Visual Auxiliary Controls */}
      <div className="absolute top-[calc(var(--header-bottom)+3rem)] xl:top-4 right-4 z-30 flex max-w-[calc(100%-2rem)] flex-wrap justify-end items-center gap-2 pointer-events-auto">
        <div
          className="flex items-center rounded-lg border p-1 backdrop-blur-md text-xs"
          style={{
            backgroundColor: 'rgba(4, 8, 22, 0.75)',
            borderColor: 'rgba(56, 189, 248, 0.5)'
          }}
        >
          <button
            onClick={() => setViewSourceMode('markmap')}
            className={`px-2.5 py-1 rounded text-xs font-medium transition ${
              viewSourceMode === 'markmap'
                ? 'bg-cyan-500 text-zinc-950 font-bold shadow-[0_0_8px_rgba(0,240,255,0.6)]'
                : 'text-cyan-300 hover:text-white'
            }`}
          >
            Markmap Topology
          </button>
          <button
            onClick={() => { setCanonicalExpanded(false); setAllCollapsed(false); setViewSourceMode('canonical_cosmos'); }}
            disabled={!canonicalTreeData}
            className={`px-2.5 py-1 rounded text-xs font-medium transition ${
              viewSourceMode === 'canonical_cosmos'
                ? 'bg-purple-500 text-zinc-950 font-bold shadow-[0_0_8px_rgba(168,85,247,0.6)]'
                : 'text-purple-300 hover:text-white'
            }`}
          >
            Canonical 1,808 Matrix
          </button>
        </div>

        <button
          onClick={() => setShowQuotes((prev) => !prev)}
          className={`p-2 rounded-lg border backdrop-blur-md transition ${
            showQuotes
              ? 'bg-cyan-950/80 text-cyan-300 border-cyan-500/80 shadow-[0_0_8px_rgba(0,240,255,0.4)]'
              : 'bg-zinc-900/80 text-zinc-400 border-zinc-700'
          }`}
          title="Toggle Floating Philosophical Quotes"
        >
          <Quote className="w-4 h-4" />
        </button>

        <button
          onClick={() =>
            setViewport((prev) => ({
              ...prev,
              scale: Math.min(prev.scale * 1.25, 3.2)
            }))
          }
          className="p-2 rounded-lg bg-zinc-950/80 text-cyan-300 border border-cyan-500/50 hover:border-cyan-400 backdrop-blur-md"
          title="Zoom In"
        >
          <ZoomIn className="w-4 h-4" />
        </button>

        <button
          onClick={() =>
            setViewport((prev) => ({
              ...prev,
              scale: Math.max(prev.scale * 0.8, 0.25)
            }))
          }
          className="p-2 rounded-lg bg-zinc-950/80 text-cyan-300 border border-cyan-500/50 hover:border-cyan-400 backdrop-blur-md"
          title="Zoom Out"
        >
          <ZoomOut className="w-4 h-4" />
        </button>

        <button
          onClick={handleResetView}
          className="p-2 rounded-lg bg-zinc-950/80 text-cyan-300 border border-cyan-500/50 hover:border-cyan-400 backdrop-blur-md"
          title="Center & Reset View"
        >
          <Maximize2 className="w-4 h-4" />
        </button>

        <button
          onClick={async () => {
            if (document.fullscreenElement) await document.exitFullscreen();
            else await containerRef.current?.requestFullscreen().catch(() => setIsFullscreen(true));
          }}
          className="p-2 rounded-lg bg-zinc-950/80 text-purple-300 border border-purple-500/50 hover:border-purple-400 backdrop-blur-md"
          title={isFullscreen ? 'Exit Fullscreen' : 'Immersive Cosmic Viewport'}
        >
          {isFullscreen ? <Minimize2 className="w-4 h-4" /> : <Maximize2 className="w-4 h-4" />}
        </button>
      </div>

      {/* 5. Ambient Navigation Hint */}
      <footer className="absolute bottom-4 left-4 right-4 z-20 flex flex-wrap items-center gap-2 text-[9px] sm:text-[11px] font-mono text-cyan-300/70 pointer-events-none">
        <span className="hidden sm:inline px-2 py-1 rounded bg-black/60 backdrop-blur-md border border-cyan-500/30">
          • Pan: Drag canvas
        </span>
        <span className="hidden sm:inline px-2 py-1 rounded bg-black/60 backdrop-blur-md border border-cyan-500/30">
          • Zoom: Mouse wheel
        </span>
        <span className="px-2 py-1 rounded bg-black/60 backdrop-blur-md border border-cyan-500/30">
          • Inspect: Click luminous node
        </span>
      </footer>

      {/* 6. Luminous Glassmorphic Node Inspector Drawer */}
      {drawerOpen && selectedNode && (
        <aside
          className="absolute top-0 right-0 bottom-0 w-full sm:w-[420px] z-40 p-5 flex flex-col backdrop-blur-2xl border-l transition-transform duration-300 shadow-2xl overflow-y-auto"
          style={{
            backgroundColor: 'rgba(2, 6, 20, 0.88)',
            borderColor: 'rgba(0, 240, 255, 0.6)',
            boxShadow: '-10px 0 35px rgba(0, 240, 255, 0.2)'
          }}
        >
          <div className="flex items-start justify-between pb-4 border-b border-cyan-500/30">
            <div>
              <div className="flex items-center gap-2 text-[10px] font-mono text-cyan-400 uppercase tracking-widest">
                <span>{selectedNode.type.toUpperCase()}</span>
                {selectedNode.warrant && (
                  <span className="px-1.5 py-0.5 rounded bg-cyan-950 border border-cyan-500/60 text-cyan-300">
                    {selectedNode.warrant}
                  </span>
                )}
                {selectedNode.epistemicStatus && (
                  <span className="text-zinc-400">• {selectedNode.epistemicStatus}</span>
                )}
              </div>
              <h2 className="text-base font-bold text-white mt-1 leading-snug drop-shadow-[0_0_8px_rgba(0,240,255,0.5)]">
                {selectedNode.title}
              </h2>
            </div>
            <button
              onClick={() => setDrawerOpen(false)}
              aria-label="Close inspector"
              className="p-1 rounded-lg text-cyan-400 hover:text-white hover:bg-cyan-950/50 transition"
            >
              <X className="w-5 h-5" />
            </button>
          </div>

          <div className="mt-4 space-y-4 text-xs">
            {selectedNode.quoteText && (
              <div
                className="p-4 rounded-xl border space-y-1.5"
                style={{
                  backgroundColor: 'rgba(8, 16, 36, 0.75)',
                  borderColor: 'rgba(56, 189, 248, 0.5)'
                }}
              >
                <div className="text-[10px] font-mono text-cyan-400 uppercase tracking-wider flex items-center gap-1.5">
                  <Quote className="w-3 h-3" />
                  <span>Philosophical Fragment / Quote</span>
                </div>
                <p className="italic font-serif text-sm text-cyan-100 leading-relaxed">
                  “{selectedNode.quoteText}”
                </p>
                {selectedNode.author && (
                  <p className="text-[11px] font-mono text-cyan-400 text-right">
                    — {selectedNode.author}
                  </p>
                )}
              </div>
            )}

            <div className="p-3.5 rounded-xl bg-black/60 border border-zinc-800 space-y-2 font-mono text-xs">
              <div className="text-[10px] text-zinc-400 uppercase tracking-wider">
                Topological Properties
              </div>
              <div className="grid grid-cols-2 gap-2 text-[11px]">
                <div>
                  <span className="text-zinc-500 block">Hierarchy Depth:</span>
                  <span className="text-cyan-300 font-bold">Level {selectedNode.level}</span>
                </div>
                <div>
                  <span className="text-zinc-500 block">Radiance Core:</span>
                  <span className="text-purple-300 font-bold">{selectedNode.radius || 10}px</span>
                </div>
                <div>
                  <span className="text-zinc-500 block">Particle Aura:</span>
                  <span className="text-cyan-300 font-bold">
                    {selectedNode.particleCount || 12} points
                  </span>
                </div>
                <div>
                  <span className="text-zinc-500 block">Corpus Integrity:</span>
                  <span className="text-emerald-400 font-bold">{viewSourceMode === 'canonical_cosmos' ? 'Saved graph' : 'Visual reference'}</span>
                </div>
              </div>
            </div>

            {selectedNode.children && selectedNode.children.length > 0 && (
              <div className="space-y-1.5">
                <div className="text-[10px] font-mono text-zinc-400 uppercase tracking-wider">
                  Connected Cognitive Threads ({selectedNode.children.length})
                </div>
                <div className="space-y-1 max-h-48 overflow-y-auto pr-1">
                  {selectedNode.children.map((child) => (
                    <button
                      key={child.id}
                      onClick={() => setSelectedNode(child)}
                      className="w-full text-left p-2 rounded-lg bg-zinc-950/70 border border-zinc-800/80 hover:border-cyan-500/60 hover:bg-cyan-950/30 text-zinc-300 hover:text-white transition flex items-center justify-between"
                    >
                      <span className="truncate">{child.title}</span>
                      <ChevronRight className="w-3.5 h-3.5 text-cyan-400 flex-shrink-0" />
                    </button>
                  ))}
                </div>
              </div>
            )}

            {viewSourceMode === 'canonical_cosmos' && onDensifyCanonicalNode && selectedNode.id !== 'root_cosmos' && (
              <div className="pt-2 space-y-2">
                <button disabled={generating} className="w-full rounded-xl border border-cyan-500 bg-cyan-950 px-4 py-3 font-bold text-cyan-100 disabled:opacity-50" onClick={async () => {
                  setGenerating(true); setGenerationError(null);
                  try { await onDensifyCanonicalNode(selectedNode.id); }
                  catch (error) { setGenerationError(error instanceof Error ? error.message : 'Generation failed. Please retry.'); }
                  finally { setGenerating(false); }
                }}>{generating ? 'Generating proposals…' : aiConfigured ? 'Generate OpenRouter proposals' : 'Generate offline proposals'}</button>
                <p className="text-zinc-400">Generated branches remain proposals awaiting review.</p>
                {generationError && <p role="alert" className="text-rose-300">{generationError}</p>}
              </div>
            )}
            {onTriggerResearchLoop && (
              <div className="pt-2">
                <button
                  onClick={() => onTriggerResearchLoop(selectedNode.title)}
                  className="w-full py-2.5 px-4 rounded-xl text-xs font-bold text-black flex items-center justify-center gap-2 shadow-lg shadow-cyan-500/20 transition-all duration-200 active:scale-95"
                  style={{
                    background: 'linear-gradient(135deg, #00f0ff 0%, #38bdf8 100%)'
                  }}
                >
                  <Sparkles className="w-4 h-4" />
                  <span>Initiate PEC-Ω Research Cycle on this Node</span>
                </button>
              </div>
            )}
          </div>
        </aside>
      )}
    </div>
  );
};
