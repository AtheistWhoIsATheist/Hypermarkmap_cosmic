import React, { useState, useEffect, useRef, useMemo, useCallback } from 'react';
import {
  Search,
  ZoomIn,
  ZoomOut,
  Maximize2,
  Minimize2,
  ChevronRight,
  Sparkles,
  X,
  Quote,
  Upload,
  Trash2,
  FileText,
  HardDrive
} from 'lucide-react';
import {
  MARKMAP_EPITEMIC_TOPOLOGY,
  type EpistemicTopologyNode
} from './GroundedEpistemicTopologyData';
import { NodeInspectorDrawer } from './NodeInspectorDrawer';
import { IngestionModal } from './IngestionModal';
import { GoogleWorkspaceModal } from './GoogleWorkspaceModal';
import { subscribeAuthState, getCurrentUser } from '../services/workspace/authService';
import { GraphStorage } from '../storage/GraphStorage';
import type { GraphNode, GraphEdge, IngestionBatchItem } from '../types/graph';
import type { User } from 'firebase/auth';

interface PositionedNode extends EpistemicTopologyNode {
  x: number;
  y: number;
  cx?: number;
  cy?: number;
  parent?: PositionedNode;
  computedChildren?: PositionedNode[];
  isMatch?: boolean;
}

export const TopologyVisualizer: React.FC = () => {
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

  // Viewport Camera State
  const [viewport, setViewport] = useState({
    x: typeof window !== 'undefined' ? window.innerWidth / 2.8 : 420,
    y: typeof window !== 'undefined' ? window.innerHeight / 2.2 : 380,
    scale: 0.85
  });
  const viewportRef = useRef(viewport);
  viewportRef.current = viewport;

  const isDraggingRef = useRef(false);
  const dragDistanceRef = useRef(0);
  const lastMousePosRef = useRef({ x: 0, y: 0 });

  // Interactive UI State
  const [searchQuery, setSearchQuery] = useState('');
  const [selectedNode, setSelectedNode] = useState<EpistemicTopologyNode | null>(null);
  const [drawerOpen, setDrawerOpen] = useState(false);
  const [isFullscreen, setIsFullscreen] = useState(false);
  const [isIngestionOpen, setIsIngestionOpen] = useState(false);
  const [isWorkspaceOpen, setIsWorkspaceOpen] = useState(false);
  const [googleUser, setGoogleUser] = useState<User | null>(() => getCurrentUser());
  const [ingestedGraph, setIngestedGraph] = useState<{ nodes: GraphNode[]; edges: GraphEdge[] }>(() =>
    GraphStorage.getIngestedGraphSync()
  );

  useEffect(() => {
    const unsub = subscribeAuthState((u) => setGoogleUser(u));
    return unsub;
  }, []);

  useEffect(() => {
    GraphStorage.hydrateCache().then(() => {
      setIngestedGraph(GraphStorage.getIngestedGraphSync());
    });
  }, []);

  const handleIngestionComplete = useCallback((_items?: IngestionBatchItem[]) => {
    const updated = GraphStorage.getIngestedGraphSync();
    setIngestedGraph(updated);
  }, []);

  const handleClearIngested = useCallback(async () => {
    if (window.confirm('Clear all ingested documents and reset graph to baseline topology?')) {
      await GraphStorage.clearIngestedGraph();
      setIngestedGraph(GraphStorage.getIngestedGraphSync());
      setSelectedNode(null);
      setDrawerOpen(false);
    }
  }, []);

  useEffect(() => {
    const closeOnEscape = (event: KeyboardEvent) => {
      if (event.key === 'Escape') { setDrawerOpen(false); canvasRef.current?.focus(); }
    };
    if (drawerOpen) document.addEventListener('keydown', closeOnEscape);
    return () => document.removeEventListener('keydown', closeOnEscape);
  }, [drawerOpen]);

  // Active Hierarchical Data
  const [treeData, setTreeData] = useState<EpistemicTopologyNode>(() =>
    JSON.parse(JSON.stringify(MARKMAP_EPITEMIC_TOPOLOGY))
  );

  // Background Particles (Cosmic Void & Stars)
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

  const timeRef = useRef(0);

  // Initialize Deep Starfield & Nebula Clusters
  useEffect(() => {
    const stars: typeof starsRef.current = [];
    const width = 4000;
    const height = 3000;
    const starColors = ['#ffffff', '#e0f2fe', '#38bdf8', '#00f0ff', '#c084fc', '#818cf8', '#f472b6'];

    for (let i = 0; i < 500; i++) {
      stars.push({
        x: (Math.random() - 0.5) * width,
        y: (Math.random() - 0.5) * height,
        size: Math.random() < 0.85 ? Math.random() * 1.5 + 0.5 : Math.random() * 2.6 + 1.4,
        baseAlpha: Math.random() * 0.7 + 0.3,
        phase: Math.random() * Math.PI * 2,
        speed: Math.random() * 0.02 + 0.008,
        color: starColors[Math.floor(Math.random() * starColors.length)]
      });
    }
    starsRef.current = stars;

    nebulaCloudsRef.current = [
      { x: -350, y: -200, radius: 550, color: 'rgba(0, 240, 255, 0.08)', opacity: 0.8 },
      { x: 500, y: 100, radius: 680, color: 'rgba(139, 92, 246, 0.09)', opacity: 0.9 },
      { x: 150, y: -300, radius: 420, color: 'rgba(56, 189, 248, 0.07)', opacity: 0.75 },
      { x: 750, y: -250, radius: 460, color: 'rgba(217, 70, 239, 0.07)', opacity: 0.8 },
      { x: -200, y: 400, radius: 560, color: 'rgba(30, 58, 138, 0.15)', opacity: 0.85 },
      { x: 950, y: 300, radius: 440, color: 'rgba(14, 165, 233, 0.07)', opacity: 0.7 }
    ];
  }, []);

  // Compute Layout Tree with Radial Coordinates & Dynamic Depth
  const layoutTree = useMemo(() => {
    const positioned: PositionedNode[] = [];
    const qLower = searchQuery.toLowerCase().trim();

    const rootPos: PositionedNode = {
      ...treeData,
      x: 0,
      y: 0,
      isMatch: qLower ? treeData.title.toLowerCase().includes(qLower) : false
    };
    positioned.push(rootPos);

    function layoutSubtree(
      node: EpistemicTopologyNode,
      parentPos: PositionedNode,
      depth: number,
      angleStart: number,
      angleSpan: number
    ) {
      if (!node.children || node.children.length === 0 || node._collapsed) return;

      const leafCount = (n: EpistemicTopologyNode): number => !n.children?.length || n._collapsed ? 1 : n.children.reduce((sum, child) => sum + leafCount(child), 0);
      const totalLeaves = node.children.reduce((sum, child) => sum + leafCount(child), 0);
      let cursor = angleStart;
      node.children.forEach((child) => {
        const span = angleSpan * leafCount(child) / totalLeaves;
        const theta = cursor + span / 2;
        cursor += span;
        const radius = 240 + (depth - 1) * 170;
        const cx = Math.cos(theta) * radius;
        const cy = Math.sin(theta) * radius;

        const isMatch = Boolean(
          qLower &&
            (child.title.toLowerCase().includes(qLower) ||
              (child.quoteText && child.quoteText.toLowerCase().includes(qLower)))
        );

        const childPos: PositionedNode = {
          ...child,
          x: cx,
          y: cy,
          parent: parentPos,
          isMatch
        };

        positioned.push(childPos);
        layoutSubtree(child, childPos, depth + 1, theta - span / 2, span);
      });
    }

    layoutSubtree(treeData, rootPos, 1, -Math.PI, Math.PI * 2);

    // Ingested Nodes Layout: Radial positioning of Document Hubs and their extracted sections & relata
    if (ingestedGraph.nodes.length > 0) {
      const docHubs = ingestedGraph.nodes.filter(n => n.nodeKind === 'document-hub');
      const nonHubs = ingestedGraph.nodes.filter(n => n.nodeKind !== 'document-hub');

      const hubCount = Math.max(docHubs.length, 1);
      const hubAngleStep = (Math.PI * 2) / hubCount;

      docHubs.forEach((hub, hIdx) => {
        const hubAngle = -Math.PI / 2 + hIdx * hubAngleStep;
        const hubX = Math.cos(hubAngle) * 880;
        const hubY = Math.sin(hubAngle) * 880;

        const isMatch = Boolean(
          qLower && (
            hub.title?.toLowerCase().includes(qLower) ||
            hub.label.toLowerCase().includes(qLower) ||
            hub.description?.toLowerCase().includes(qLower)
          )
        );

        const hubPos: PositionedNode = {
          id: hub.id,
          title: hub.title || hub.label,
          description: hub.description || hub.content,
          systemStage: hub.systemStage || 'Document Ingestion',
          thematicGroup: hub.thematicGroup || 'Ingested Corpus',
          citations: (hub.citations || []).map((c, i) =>
            typeof c === 'string' ? { id: `cit_${i}`, sourceTitle: hub.sourceFile, quoteSnippet: c } : c
          ),
          metadata: Object.entries(hub.metadata || {}).map(([l, v]) => ({ label: l, value: v, category: 'system' as const })),
          connectedNodeIds: hub.connectedNodeIds || [],
          level: 1,
          type: 'document-hub',
          radius: 16,
          particleCount: 14,
          color: '#38bdf8',
          glowColor: 'rgba(56, 189, 248, 0.45)',
          x: hubX,
          y: hubY,
          isMatch,
          parent: rootPos,
          nodeKind: hub.nodeKind,
          processingMode: hub.processingMode,
          confidenceStatus: hub.confidenceStatus,
          sourceSpans: hub.sourceSpans,
          sourceFile: hub.sourceFile
        };
        positioned.push(hubPos);

        const fileNodes = nonHubs.filter(n => n.sourceFile === hub.sourceFile);
        const sections = fileNodes.filter(n => n.nodeKind === 'section');
        const concepts = fileNodes.filter(n => n.nodeKind !== 'section');

        const secCount = Math.max(sections.length, 1);
        const secAngleSpan = Math.PI * 0.8;
        const secAngleStart = hubAngle - secAngleSpan / 2;

        sections.forEach((sec, sIdx) => {
          const secAngle = secAngleStart + (secCount === 1 ? secAngleSpan / 2 : (sIdx / (secCount - 1)) * secAngleSpan);
          const secX = hubX + Math.cos(secAngle) * 160;
          const secY = hubY + Math.sin(secAngle) * 160;

          const secMatch = Boolean(
            qLower && (
              sec.title?.toLowerCase().includes(qLower) ||
              sec.label.toLowerCase().includes(qLower) ||
              sec.description?.toLowerCase().includes(qLower)
            )
          );

          const secPos: PositionedNode = {
            id: sec.id,
            title: sec.title || sec.label,
            description: sec.description || sec.content,
            systemStage: sec.systemStage,
            thematicGroup: sec.thematicGroup,
            citations: (sec.citations || []).map((c, i) =>
              typeof c === 'string' ? { id: `cit_${i}`, sourceTitle: sec.sourceFile, quoteSnippet: c } : c
            ),
            metadata: Object.entries(sec.metadata || {}).map(([l, v]) => ({ label: l, value: v, category: 'epistemic' as const })),
            connectedNodeIds: sec.connectedNodeIds || [],
            level: 2,
            type: 'section',
            radius: 12,
            color: '#818cf8',
            glowColor: 'rgba(129, 140, 248, 0.4)',
            x: secX,
            y: secY,
            isMatch: secMatch,
            parent: hubPos,
            nodeKind: sec.nodeKind,
            processingMode: sec.processingMode,
            confidenceStatus: sec.confidenceStatus,
            sourceSpans: sec.sourceSpans,
            sourceFile: sec.sourceFile
          };
          positioned.push(secPos);

          const childConcepts = concepts.filter(c =>
            c.id.includes(sec.id) || (c.connectedNodeIds && c.connectedNodeIds.includes(sec.id))
          );
          const cCount = Math.max(childConcepts.length, 1);
          const cAngleSpan = Math.PI * 0.6;
          const cAngleStart = secAngle - cAngleSpan / 2;

          childConcepts.forEach((concept, cIdx) => {
            const cAngle = cAngleStart + (cCount === 1 ? cAngleSpan / 2 : (cIdx / (cCount - 1)) * cAngleSpan);
            const cX = secX + Math.cos(cAngle) * 110;
            const cY = secY + Math.sin(cAngle) * 110;

            const cMatch = Boolean(
              qLower && (
                concept.title?.toLowerCase().includes(qLower) ||
                concept.label.toLowerCase().includes(qLower) ||
                concept.description?.toLowerCase().includes(qLower)
              )
            );

            const isUnresolved = concept.nodeKind === 'unresolved-reference';
            const conceptPos: PositionedNode = {
              id: concept.id,
              title: concept.title || concept.label,
              description: concept.description || concept.content,
              systemStage: concept.systemStage,
              thematicGroup: concept.thematicGroup,
              citations: (concept.citations || []).map((c, i) =>
                typeof c === 'string' ? { id: `cit_${i}`, sourceTitle: concept.sourceFile, quoteSnippet: c } : c
              ),
              metadata: Object.entries(concept.metadata || {}).map(([l, v]) => ({ label: l, value: v, category: 'epistemic' as const })),
              connectedNodeIds: concept.connectedNodeIds || [],
              level: 3,
              type: concept.nodeKind,
              radius: isUnresolved ? 8 : 10,
              color: isUnresolved ? '#f59e0b' : concept.confidenceStatus === 'source-explicit' ? '#10b981' : '#00f0ff',
              glowColor: isUnresolved ? 'rgba(245, 158, 11, 0.4)' : 'rgba(0, 240, 255, 0.4)',
              x: cX,
              y: cY,
              isMatch: cMatch,
              parent: secPos,
              nodeKind: concept.nodeKind,
              processingMode: concept.processingMode,
              confidenceStatus: concept.confidenceStatus,
              sourceSpans: concept.sourceSpans,
              sourceFile: concept.sourceFile
            };
            positioned.push(conceptPos);
          });
        });

        const assignedIds = new Set(positioned.map(p => p.id));
        const orphanConcepts = fileNodes.filter(n => !assignedIds.has(n.id));
        orphanConcepts.forEach((orphan, oIdx) => {
          const oAngle = hubAngle + Math.PI + (oIdx * 0.4);
          const oX = hubX + Math.cos(oAngle) * 120;
          const oY = hubY + Math.sin(oAngle) * 120;
          const isUnresolved = orphan.nodeKind === 'unresolved-reference';

          positioned.push({
            id: orphan.id,
            title: orphan.title || orphan.label,
            description: orphan.description || orphan.content,
            systemStage: orphan.systemStage,
            thematicGroup: orphan.thematicGroup,
            citations: (orphan.citations || []).map((c, i) =>
              typeof c === 'string' ? { id: `cit_${i}`, sourceTitle: orphan.sourceFile, quoteSnippet: c } : c
            ),
            metadata: Object.entries(orphan.metadata || {}).map(([l, v]) => ({ label: l, value: v, category: 'epistemic' as const })),
            connectedNodeIds: orphan.connectedNodeIds || [],
            level: 3,
            type: orphan.nodeKind,
            radius: isUnresolved ? 8 : 10,
            color: isUnresolved ? '#f59e0b' : '#00f0ff',
            glowColor: isUnresolved ? 'rgba(245, 158, 11, 0.4)' : 'rgba(0, 240, 255, 0.4)',
            x: oX,
            y: oY,
            isMatch: qLower ? (orphan.title?.toLowerCase().includes(qLower) || orphan.label.toLowerCase().includes(qLower)) : false,
            parent: hubPos,
            nodeKind: orphan.nodeKind,
            processingMode: orphan.processingMode,
            confidenceStatus: orphan.confidenceStatus,
            sourceSpans: orphan.sourceSpans,
            sourceFile: orphan.sourceFile
          });
        });
      });
    }

    return positioned;
  }, [treeData, searchQuery, ingestedGraph]);

  // Mouse & Gesture Handlers
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
    const zoomFactor = e.deltaY < 0 ? 1.12 : 0.89;
    const rect = canvasRef.current?.getBoundingClientRect();
    if (!rect) return;

    const mouseX = e.clientX - rect.left;
    const mouseY = e.clientY - rect.top;

    setViewport((prev) => {
      const newScale = Math.min(Math.max(prev.scale * zoomFactor, 0.15), 3.8);
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
      const hitRadius = Math.max(node.radius || 12, 18);
      const dist = Math.hypot(node.x - worldX, node.y - worldY);
      if (dist <= hitRadius) {
        found = node;
        break;
      }
    }

    if (found) {
      setSelectedNode(found);
      setDrawerOpen(true);
    } else {
      // Backdrop dismissal: clicking empty canvas dismisses inspector
      setDrawerOpen(false);
      setSelectedNode(null);
    }
  };

  // Lookup map for fast node retrieval by ID across the entire hierarchy
  const allNodesMap = useMemo(() => {
    const map = new Map<string, EpistemicTopologyNode>();
    const traverse = (n: EpistemicTopologyNode) => {
      map.set(n.id, n);
      if (n.children) n.children.forEach(traverse);
    };
    traverse(treeData);

    // Index ingested nodes for relational drawer lookups
    ingestedGraph.nodes.forEach((n) => {
      map.set(n.id, {
        id: n.id,
        title: n.title || n.label,
        description: n.description || n.content,
        systemStage: n.systemStage,
        thematicGroup: n.thematicGroup,
        citations: (n.citations || []).map((c, i) =>
          typeof c === 'string' ? { id: `cit_${i}`, sourceTitle: n.sourceFile, quoteSnippet: c } : c
        ),
        metadata: Object.entries(n.metadata || {}).map(([l, v]) => ({ label: l, value: v, category: 'epistemic' as const })),
        connectedNodeIds: n.connectedNodeIds,
        nodeKind: n.nodeKind,
        processingMode: n.processingMode,
        confidenceStatus: n.confidenceStatus,
        sourceSpans: n.sourceSpans,
        sourceFile: n.sourceFile
      });
    });

    return map;
  }, [treeData, ingestedGraph.nodes]);

  // Center camera smoothly on any selected topology node
  const handleCenterNode = useCallback((node: EpistemicTopologyNode) => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const pos = layoutTree.find(n => n.id === node.id);
    if (!pos) return;
    const drawerOffset = window.innerWidth >= 640 ? 220 : 0;
    const targetX = (canvas.clientWidth - drawerOffset) / 2 - pos.x * viewport.scale;
    const targetY = canvas.clientHeight / 2 - pos.y * viewport.scale;
    setViewport(v => ({ ...v, x: targetX, y: targetY }));
  }, [layoutTree, viewport.scale]);

  // Filter or highlight connected relata
  const handleFilterConnected = useCallback((node: EpistemicTopologyNode) => {
    if (node.title) {
      const cleanKeyword = node.title.replace(/^[\d.]+\s*/, '').split(':')[0].trim();
      setSearchQuery(cleanKeyword);
    }
  }, []);

  // Select node by ID from drawer connected links
  const handleSelectNodeById = useCallback((nodeId: string) => {
    const target = allNodesMap.get(nodeId);
    if (target) {
      setSelectedNode(target);
      setDrawerOpen(true);
      const pos = layoutTree.find(n => n.id === nodeId);
      if (pos) {
        handleCenterNode(pos);
      }
    }
  }, [allNodesMap, layoutTree, handleCenterNode]);

  const handleResetView = () => {
    const canvas = canvasRef.current;
    if (!canvas || !layoutTree.length) return;
    const minX = Math.min(...layoutTree.map(n => n.x)) - 50;
    const maxX = Math.max(...layoutTree.map(n => n.x)) + 170;
    const minY = Math.min(...layoutTree.map(n => n.y)) - 50;
    const maxY = Math.max(...layoutTree.map(n => n.y)) + 50;
    const height = Math.max(160, canvas.clientHeight - headerHeight - 100);
    const scale = Math.max(0.15, Math.min(0.85, (canvas.clientWidth - 48) / (maxX - minX), height / (maxY - minY)));
    setViewport({ x: canvas.clientWidth / 2 - (minX + maxX) / 2 * scale, y: headerHeight + 40 + height / 2 - (minY + maxY) / 2 * scale, scale });
  };
  useEffect(() => { handleResetView(); }, [headerHeight]);

  const handleExpandAll = () => {
    const toggle = (node: EpistemicTopologyNode): EpistemicTopologyNode => ({
      ...node,
      _collapsed: false,
      children: node.children ? node.children.map(toggle) : undefined
    });
    setTreeData(toggle(treeData));
  };

  const handleCollapseAll = () => {
    const toggle = (node: EpistemicTopologyNode, depth: number = 0): EpistemicTopologyNode => ({
      ...node,
      _collapsed: depth >= 1,
      children: node.children ? node.children.map((c) => toggle(c, depth + 1)) : undefined
    });
    setTreeData(toggle(treeData, 0));
  };

  // Main Canvas Render Loop (60 FPS Deep Cosmic Pipeline)
  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const ctx = canvas.getContext('2d');
    if (!ctx) return;

    let running = true;
    let lastFrame = 0;

    const handleResize = () => {
      const parent = canvas.parentElement;
      if (!parent) return;
      const dpr = Math.min(window.devicePixelRatio || 1, 2);
      canvas.width = parent.clientWidth * dpr;
      canvas.height = parent.clientHeight * dpr;
      ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
    };

    handleResize();
    const resizeObserver = new ResizeObserver(handleResize);
    resizeObserver.observe(canvas.parentElement!);
    window.addEventListener('resize', handleResize);

    const render = (now: number) => {
      if (!running) return;
      if (document.hidden || now - lastFrame < 1000 / 30) {
        animFrameIdRef.current = requestAnimationFrame(render);
        return;
      }
      timeRef.current += lastFrame ? Math.min((now - lastFrame) / 1000, 0.05) : 1 / 30;
      lastFrame = now;
      const t = timeRef.current;
      const vp = viewportRef.current;

      const width = canvas.clientWidth;
      const height = canvas.clientHeight;

      ctx.save();
      ctx.clearRect(0, 0, width, height);

      // Deep Void Base Gradient
      const baseGrad = ctx.createRadialGradient(width / 2, height / 2, 50, width / 2, height / 2, Math.max(width, height));
      baseGrad.addColorStop(0, '#040714');
      baseGrad.addColorStop(0.5, '#02030a');
      baseGrad.addColorStop(1, '#000000');
      ctx.fillStyle = baseGrad;
      ctx.fillRect(0, 0, width, height);

      // Render Ambient Nebula Clusters
      nebulaCloudsRef.current.forEach((nebula) => {
        const screenX = vp.x + nebula.x * vp.scale * 0.35;
        const screenY = vp.y + nebula.y * vp.scale * 0.35;
        const screenR = nebula.radius * vp.scale;
        if (screenX + screenR < 0 || screenX - screenR > width || screenY + screenR < 0 || screenY - screenR > height) return;

        const g = ctx.createRadialGradient(screenX, screenY, 0, screenX, screenY, screenR);
        g.addColorStop(0, nebula.color);
        g.addColorStop(1, 'transparent');
        ctx.fillStyle = g;
        ctx.beginPath();
        ctx.arc(screenX, screenY, screenR, 0, Math.PI * 2);
        ctx.fill();
      });

      // Render Twinkling Multi-Spectral Starfield
      starsRef.current.forEach((star) => {
        const sx = vp.x + star.x * vp.scale * 0.55;
        const sy = vp.y + star.y * vp.scale * 0.55;
        if (sx < 0 || sx > width || sy < 0 || sy > height) return;

        const pulse = Math.sin(t * star.speed * 60 + star.phase);
        const alpha = Math.max(0.1, star.baseAlpha + pulse * 0.3);

        ctx.fillStyle = star.color;
        ctx.globalAlpha = alpha;
        ctx.beginPath();
        ctx.arc(sx, sy, star.size * Math.max(0.6, vp.scale * 0.9), 0, Math.PI * 2);
        ctx.fill();
      });
      ctx.globalAlpha = 1.0;

      // Transform context to World Space
      ctx.save();
      ctx.translate(vp.x, vp.y);
      ctx.scale(vp.scale, vp.scale);

      // Render 3D Torus Geometric Wireframe
      ctx.save();
      const torusR = 380;
      const tubeR = 110;
      const rings = 20;
      const segments = 24;
      const rotY = t * 0.12;
      const rotX = 0.55 + Math.sin(t * 0.08) * 0.1;

      ctx.strokeStyle = 'rgba(0, 240, 255, 0.12)';
      ctx.lineWidth = 1 / vp.scale;

      for (let i = 0; i < rings; i++) {
        const u = (i / rings) * Math.PI * 2;
        ctx.beginPath();
        for (let j = 0; j <= segments; j++) {
          const v = (j / segments) * Math.PI * 2;
          const x3 = (torusR + tubeR * Math.cos(v)) * Math.cos(u);
          const y3 = tubeR * Math.sin(v);
          const z3 = (torusR + tubeR * Math.cos(v)) * Math.sin(u);

          const xRot = x3 * Math.cos(rotY) + z3 * Math.sin(rotY);
          const zRot = -x3 * Math.sin(rotY) + z3 * Math.cos(rotY);
          const yFinal = y3 * Math.cos(rotX) - zRot * Math.sin(rotX);

          if (j === 0) ctx.moveTo(xRot, yFinal);
          else ctx.lineTo(xRot, yFinal);
        }
        ctx.stroke();
      }
      ctx.restore();

      // Render Organic Cubic Bézier Light-Stream Bridges
      layoutTree.forEach((node) => {
        if (!node.parent) return;
        const p = node.parent;

        const isHighlighted = node.isMatch || (selectedNode && (node.id === selectedNode.id || p.id === selectedNode.id));
        const dx = node.x - p.x;
        const dy = node.y - p.y;
        const cp1x = p.x + dx * 0.5;
        const cp1y = p.y;
        const cp2x = p.x + dx * 0.5;
        const cp2y = node.y;

        // Outer Glow Stream
        ctx.beginPath();
        ctx.moveTo(p.x, p.y);
        ctx.bezierCurveTo(cp1x, cp1y, cp2x, cp2y, node.x, node.y);
        ctx.strokeStyle = isHighlighted ? 'rgba(0, 240, 255, 0.85)' : 'rgba(56, 189, 248, 0.22)';
        ctx.lineWidth = (isHighlighted ? 3.5 : 1.8) / vp.scale;
        ctx.stroke();

        // Core White Light Fiber
        ctx.beginPath();
        ctx.moveTo(p.x, p.y);
        ctx.bezierCurveTo(cp1x, cp1y, cp2x, cp2y, node.x, node.y);
        ctx.strokeStyle = isHighlighted ? '#ffffff' : 'rgba(255, 255, 255, 0.45)';
        ctx.lineWidth = (isHighlighted ? 1.5 : 0.8) / vp.scale;
        ctx.stroke();
      });

      // Render Ingested Cross-Edges & Semantic Relata
      if (ingestedGraph.edges.length > 0) {
        ctx.save();
        const posMap = new Map<string, PositionedNode>();
        layoutTree.forEach(n => posMap.set(n.id, n));

        ingestedGraph.edges.forEach((edge) => {
          const s = posMap.get(edge.source);
          const tNode = posMap.get(edge.target);
          if (!s || !tNode) return;

          const isEdgeHighlighted =
            (selectedNode && (s.id === selectedNode.id || tNode.id === selectedNode.id)) ||
            s.isMatch || tNode.isMatch;

          // Quadratic Bézier curve with gentle arc
          const midX = (s.x + tNode.x) / 2;
          const midY = (s.y + tNode.y) / 2;
          const dist = Math.hypot(tNode.x - s.x, tNode.y - s.y);
          const nx = -(tNode.y - s.y) / (dist || 1) * 28;
          const ny = (tNode.x - s.x) / (dist || 1) * 28;
          const ctrlX = midX + nx;
          const ctrlY = midY + ny;

          ctx.beginPath();
          ctx.moveTo(s.x, s.y);
          ctx.quadraticCurveTo(ctrlX, ctrlY, tNode.x, tNode.y);

          if (edge.edgeCategory === 'proposed' || edge.relationType === 'unresolved-citation' || edge.relationType === 'proposed-contradiction') {
            ctx.setLineDash([5 / vp.scale, 5 / vp.scale]);
            ctx.strokeStyle = edge.relationType === 'proposed-contradiction' ? 'rgba(244, 63, 94, 0.85)' : 'rgba(245, 158, 11, 0.85)';
            ctx.lineWidth = (isEdgeHighlighted ? 2.8 : 1.4) / vp.scale;
          } else if (edge.edgeCategory === 'philosophical') {
            ctx.setLineDash([]);
            ctx.strokeStyle = isEdgeHighlighted ? 'rgba(16, 185, 129, 0.95)' : 'rgba(16, 185, 129, 0.5)';
            ctx.lineWidth = (isEdgeHighlighted ? 2.8 : 1.4) / vp.scale;
          } else {
            ctx.setLineDash([]);
            ctx.strokeStyle = isEdgeHighlighted ? 'rgba(0, 240, 255, 0.85)' : 'rgba(56, 189, 248, 0.35)';
            ctx.lineWidth = (isEdgeHighlighted ? 2.5 : 1.2) / vp.scale;
          }
          ctx.stroke();
          ctx.setLineDash([]);

          // Edge relation badge if zoomed in or highlighted
          if (vp.scale > 0.65 || isEdgeHighlighted) {
            ctx.font = '9px monospace';
            ctx.fillStyle = isEdgeHighlighted ? '#ffffff' : 'rgba(203, 213, 225, 0.7)';
            ctx.textAlign = 'center';
            ctx.textBaseline = 'middle';
            ctx.fillText(edge.relationType || edge.label || '', ctrlX, ctrlY - 4);
          }
        });
        ctx.restore();
      }

      // Render Luminous Nodes & Optical Star Flares
      layoutTree.forEach((node) => {
        const radius = node.radius || 12;
        const isSelected = selectedNode && selectedNode.id === node.id;
        const isMatch = node.isMatch;

        // Stardust Aura Particles around Hubs
        if (node.particleCount) {
          ctx.fillStyle = node.color || '#00f0ff';
          for (let p = 0; p < node.particleCount; p++) {
            const pAngle = t * 0.8 + (p * Math.PI * 2) / node.particleCount;
            const pDist = radius + 6 + Math.sin(t * 3 + p) * 3;
            const px = node.x + Math.cos(pAngle) * pDist;
            const py = node.y + Math.sin(pAngle) * pDist;
            ctx.globalAlpha = 0.5 + Math.sin(t * 2 + p) * 0.3;
            ctx.beginPath();
            ctx.arc(px, py, 1.2, 0, Math.PI * 2);
            ctx.fill();
          }
          ctx.globalAlpha = 1.0;
        }

        // Luminous Glow Radial Gradient
        const glowR = radius * (isSelected ? 3.8 : 2.5);
        const glow = ctx.createRadialGradient(node.x, node.y, radius * 0.2, node.x, node.y, glowR);
        glow.addColorStop(0, node.color || '#00f0ff');
        glow.addColorStop(0.4, node.glowColor || 'rgba(56, 189, 248, 0.4)');
        glow.addColorStop(1, 'transparent');
        ctx.fillStyle = glow;
        ctx.beginPath();
        ctx.arc(node.x, node.y, glowR, 0, Math.PI * 2);
        ctx.fill();

        // Node Solid Core
        ctx.beginPath();
        ctx.arc(node.x, node.y, radius, 0, Math.PI * 2);
        ctx.fillStyle = isSelected ? '#ffffff' : (node.color || '#00f0ff');
        ctx.fill();
        ctx.strokeStyle = isMatch ? '#f43f5e' : (node.glowColor || '#38bdf8');
        ctx.lineWidth = (isSelected ? 3 : 1.5) / vp.scale;
        ctx.stroke();

        // Node Typography
        ctx.font = `${Math.max(10, (node.level !== undefined && node.level <= 1 ? 13 : 11))}px -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, sans-serif`;
        ctx.fillStyle = isSelected ? '#ffffff' : isMatch ? '#fda4af' : '#e0f2fe';
        ctx.textAlign = 'left';
        ctx.textBaseline = 'middle';
        ctx.shadowColor = 'rgba(0, 0, 0, 0.9)';
        ctx.shadowBlur = 6;
        ctx.fillText(node.title, node.x + radius + 8, node.y);
        ctx.shadowBlur = 0;
      });

      ctx.restore();
      ctx.restore();

      animFrameIdRef.current = requestAnimationFrame(render);
    };

    animFrameIdRef.current = requestAnimationFrame(render);

    return () => {
      running = false;
      resizeObserver.disconnect();
      window.removeEventListener('resize', handleResize);
      if (animFrameIdRef.current !== null) cancelAnimationFrame(animFrameIdRef.current);
    };
  }, [layoutTree, selectedNode, ingestedGraph]);

  return (
    <div
      ref={containerRef}
      className={`relative w-full h-full min-h-screen overflow-hidden select-none font-sans bg-black ${
        isFullscreen ? 'fixed inset-0 z-50' : 'w-screen h-screen'
      }`}
    >
      {/* 1. Full-Viewport Cosmic Canvas */}
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
      <header ref={headerRef}
        className="absolute top-4 left-4 right-4 sm:right-auto sm:max-w-3xl z-30 p-4 rounded-xl border backdrop-blur-xl transition-all duration-300 pointer-events-auto"
        style={{
          backgroundColor: 'rgba(4, 8, 22, 0.75)',
          borderColor: 'rgba(56, 189, 248, 0.75)',
          boxShadow: '0 0 25px rgba(0, 240, 255, 0.3), inset 0 0 16px rgba(139, 92, 246, 0.22)'
        }}
      >
        <div className="flex flex-col space-y-2.5">
          <div className="flex flex-wrap items-center justify-between gap-2">
            <div>
              <h1 className="text-lg sm:text-xl font-bold tracking-wide text-white drop-shadow-[0_0_12px_rgba(0,240,255,0.7)] flex items-center gap-2">
                <Sparkles className="w-5 h-5 text-cyan-400 animate-pulse" />
                <span>JOURNAL314 Ω — Nihiltheistic Hypermap Visual</span>
              </h1>
              <p className="text-xs font-mono text-cyan-300/90 tracking-wider mt-0.5">
                {layoutTree.length} visible nodes &nbsp;•&nbsp; Grounded Epistemic Topology
                {ingestedGraph.nodes.length > 0 && (
                  <span className="text-emerald-400 ml-2">
                    (+{ingestedGraph.nodes.length} ingested from {new Set(ingestedGraph.nodes.map(n => n.sourceFile)).size} docs)
                  </span>
                )}
              </p>
            </div>

            {/* Ingestion & Workspace Trigger Controls */}
            <div className="flex items-center gap-2">
              <button
                onClick={() => setIsWorkspaceOpen(true)}
                className="px-3 py-1.5 rounded-lg text-xs font-semibold text-blue-200 border transition-all duration-200 hover:text-white flex items-center gap-1.5 active:scale-95 cursor-pointer"
                style={{
                  backgroundColor: 'rgba(30, 58, 138, 0.75)',
                  borderColor: 'rgba(96, 165, 250, 0.8)',
                  boxShadow: '0 0 12px rgba(59, 130, 246, 0.35)'
                }}
                title="Google Drive & Google Docs: Browse, Ingest Docs, and Export Dossiers"
              >
                <HardDrive className="w-3.5 h-3.5 text-blue-400" />
                <span>Drive & Docs</span>
                {googleUser && (
                  <span className="w-2 h-2 rounded-full bg-emerald-400 shadow-[0_0_6px_#34d399]" />
                )}
              </button>

              <button
                onClick={() => setIsIngestionOpen(true)}
                className="px-3 py-1.5 rounded-lg text-xs font-semibold text-emerald-200 border transition-all duration-200 hover:text-white flex items-center gap-1.5 active:scale-95 cursor-pointer"
                style={{
                  backgroundColor: 'rgba(6, 78, 59, 0.75)',
                  borderColor: 'rgba(52, 211, 153, 0.8)',
                  boxShadow: '0 0 12px rgba(16, 185, 129, 0.35)'
                }}
                title="Upload philosophical writings (Markdown, Text, PDF, JSON, CSV)"
              >
                <Upload className="w-3.5 h-3.5 text-emerald-400" />
                <span>Ingest Documents</span>
              </button>

              {ingestedGraph.nodes.length > 0 && (
                <button
                  onClick={handleClearIngested}
                  className="p-1.5 rounded-lg text-xs font-medium text-rose-300 border border-rose-500/40 bg-rose-950/40 hover:bg-rose-900/60 transition active:scale-95 cursor-pointer"
                  title="Clear Ingested Graph"
                >
                  <Trash2 className="w-3.5 h-3.5 text-rose-400" />
                </button>
              )}
            </div>
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
              <ChevronRight className="w-3.5 h-3.5 text-cyan-400 rotate-90" />
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
                placeholder="Search the epistemic map..."
                className="w-full rounded-lg pl-8 pr-7 py-1.5 text-xs text-white placeholder-cyan-400/50 border transition-all duration-200 focus:outline-none focus:ring-1 focus:ring-cyan-400"
                style={{
                  backgroundColor: 'rgba(3, 7, 18, 0.75)',
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

      {/* 3. Floating Quick Viewport Dock */}
      <div className="absolute bottom-5 right-5 z-30 flex items-center gap-2">
        <button
          onClick={() => setViewport((v) => ({ ...v, scale: Math.min(v.scale * 1.2, 3.8) }))}
          className="p-2.5 rounded-lg bg-zinc-950/80 text-cyan-300 border border-cyan-500/50 hover:border-cyan-400 backdrop-blur-md transition active:scale-95"
          title="Zoom In"
        >
          <ZoomIn className="w-4 h-4" />
        </button>

        <button
          onClick={() => setViewport((v) => ({ ...v, scale: Math.max(v.scale * 0.8, 0.15) }))}
          className="p-2.5 rounded-lg bg-zinc-950/80 text-cyan-300 border border-cyan-500/50 hover:border-cyan-400 backdrop-blur-md transition active:scale-95"
          title="Zoom Out"
        >
          <ZoomOut className="w-4 h-4" />
        </button>

        <button
          onClick={handleResetView}
          className="p-2.5 rounded-lg bg-zinc-950/80 text-cyan-300 border border-cyan-500/50 hover:border-cyan-400 backdrop-blur-md transition active:scale-95"
          title="Center Canvas"
        >
          <Maximize2 className="w-4 h-4" />
        </button>

        <button
          onClick={async () => { if (document.fullscreenElement) await document.exitFullscreen(); else await containerRef.current?.requestFullscreen().catch(() => setIsFullscreen(true)); }}
          className="p-2.5 rounded-lg bg-zinc-950/80 text-purple-300 border border-purple-500/50 hover:border-purple-400 backdrop-blur-md transition active:scale-95"
          title={isFullscreen ? 'Exit Fullscreen' : 'Fullscreen'}
        >
          {isFullscreen ? <Minimize2 className="w-4 h-4" /> : <Maximize2 className="w-4 h-4" />}
        </button>
      </div>

      {/* 4. Canvas Navigation Hint */}
      <footer className="absolute bottom-4 left-4 right-4 z-20 flex flex-wrap items-center gap-2 text-[9px] sm:text-[11px] font-mono text-cyan-300/70 pointer-events-none">
        <span className="hidden sm:inline px-2.5 py-1 rounded bg-black/70 backdrop-blur-md border border-cyan-500/30">
          • Pan: Drag canvas
        </span>
        <span className="hidden sm:inline px-2.5 py-1 rounded bg-black/70 backdrop-blur-md border border-cyan-500/30">
          • Zoom: Scroll wheel
        </span>
        <span className="px-2.5 py-1 rounded bg-black/70 backdrop-blur-md border border-cyan-500/30">
          • Inspect: Click any node
        </span>
      </footer>

      {/* 5. Accessible High-Performance Side-Panel Drawer */}
      <NodeInspectorDrawer
        node={selectedNode}
        isOpen={drawerOpen}
        onClose={() => {
          setDrawerOpen(false);
          setSelectedNode(null);
          canvasRef.current?.focus();
        }}
        onCenterNode={handleCenterNode}
        onFilterConnected={handleFilterConnected}
        onSelectNode={handleSelectNodeById}
        allNodesMap={allNodesMap}
      />

      {/* 6. Document Ingestion Subsystem Modal */}
      <IngestionModal
        isOpen={isIngestionOpen}
        onClose={() => setIsIngestionOpen(false)}
        onIngestionComplete={handleIngestionComplete}
        onOpenGoogleWorkspace={() => setIsWorkspaceOpen(true)}
      />

      {/* 7. Google Workspace Integration Modal (Drive & Docs) */}
      <GoogleWorkspaceModal
        isOpen={isWorkspaceOpen}
        onClose={() => setIsWorkspaceOpen(false)}
        onIngestionComplete={handleIngestionComplete}
        selectedNode={selectedNode}
        baselineTree={treeData}
        ingestedGraph={ingestedGraph}
      />
    </div>
  );
};
