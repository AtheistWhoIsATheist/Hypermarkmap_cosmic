/**
 * Journal314 Ω — Nihiltheistic Hypermap Visual (src/components/TopologyVisualizer.tsx)
 * 
 * Production Large-Scale Epistemic Topology Canvas & Workstation Dashboard.
 * Implements:
 * 1. Collapsible Glassmorphic Left Sidebar with CSS Grid & CSS Variable Transition tokens
 * 2. Viewport Responsiveness: Permanent Grid Column on Desktop, Overlay Drawer on < 1024px screens
 * 3. 4-Tier Semantic Zoom & Level-of-Detail (LoD) state machine (Tiers 0, 1, 2, 3)
 * 4. Vogel's Golden-Angle Phyllotaxis Spiral Packing (constant areal density, zero node stacking)
 * 5. Greedy 2D Screen-Space AABB Label Collision Grid (bounded 55-label frame budget)
 * 6. Compound Supernode Progressive Disclosure & Density Mode Controls (Smart LoD, Architecture, Full Horizon)
 * 7. Parallel Edge Bundling & 1-Hop Ego-Network Spotlight
 * 8. Epistemic Display Label Sanitizer & Defensive Null-Safe Event Handlers
 * 9. ResizeObserver coupled with canvas viewport buffer invalidation (zero layout thrashing)
 */

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
  Upload,
  Trash2,
  HardDrive,
  Sliders,
  Layers,
  Compass,
  FileText,
  Activity
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
import {
  type DensityMode,
  type LoDTier,
  LOD_THRESHOLDS,
  LOD_TIER_LABELS,
  getLoDTier,
  formatCanvasDisplayLabel,
  ScreenSpaceLabelCuller,
  projectViewGraph,
  type PositionedVisualNode,
  type BundledVisualEdge,
  type ScreenRect
} from '../utils/graphSpatialEngine';

/**
 * Universal cross-platform fallback for CanvasRenderingContext2D.roundRect
 * Prevents runtime crashes on environments lacking native roundRect implementation.
 */
function drawRoundRect(
  ctx: CanvasRenderingContext2D,
  x: number,
  y: number,
  w: number,
  h: number,
  r: number
): void {
  if (typeof ctx.roundRect === 'function') {
    ctx.roundRect(x, y, w, h, r);
  } else {
    const radius = Math.min(Math.max(0, r), Math.abs(w) / 2, Math.abs(h) / 2);
    ctx.moveTo(x + radius, y);
    ctx.arcTo(x + w, y, x + w, y + h, radius);
    ctx.arcTo(x + w, y + h, x, y + h, radius);
    ctx.arcTo(x, y + h, x, y, radius);
    ctx.arcTo(x, y, x + w, y, radius);
    ctx.closePath();
  }
}

export interface TopologyVisualizerProps {
  initialSidebarOpen?: boolean;
}

export const TopologyVisualizer: React.FC<TopologyVisualizerProps> = ({
  initialSidebarOpen = true
}) => {
  const containerRef = useRef<HTMLDivElement | null>(null);
  const canvasContainerRef = useRef<HTMLDivElement | null>(null);
  const canvasRef = useRef<HTMLCanvasElement | null>(null);
  const animFrameIdRef = useRef<number | null>(null);

  // Sidebar Open & Viewport Responsiveness State
  const [sidebarOpen, setSidebarOpen] = useState(initialSidebarOpen);
  const [isMobile, setIsMobile] = useState<boolean>(() => {
    if (typeof window !== 'undefined') {
      return window.innerWidth < 1024;
    }
    return false;
  });

  // Observe screen width for responsive desktop grid vs mobile overlay drawer switch
  useEffect(() => {
    const handleViewportChange = () => {
      const mobile = window.innerWidth < 1024;
      setIsMobile(mobile);
    };
    window.addEventListener('resize', handleViewportChange);
    return () => window.removeEventListener('resize', handleViewportChange);
  }, []);

  // Fullscreen state listener
  const [isFullscreen, setIsFullscreen] = useState(false);
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

  // Dragging and interaction refs
  const isDraggingRef = useRef(false);
  const dragDistanceRef = useRef(0);
  const lastMousePosRef = useRef({ x: 0, y: 0 });

  // Interactive UI State
  const [searchQuery, setSearchQuery] = useState('');
  const [selectedNode, setSelectedNode] = useState<EpistemicTopologyNode | null>(null);
  const [hoveredNodeId, setHoveredNodeId] = useState<string | null>(null);
  const hoveredNodeIdRef = useRef<string | null>(null);
  hoveredNodeIdRef.current = hoveredNodeId;

  const [drawerOpen, setDrawerOpen] = useState(false);
  const [isIngestionOpen, setIsIngestionOpen] = useState(false);
  const [isWorkspaceOpen, setIsWorkspaceOpen] = useState(false);
  const [googleUser, setGoogleUser] = useState<User | null>(() => getCurrentUser());

  // Density Mode State: 'smart' (Auto LoD) | 'architecture' | 'full' (Phyllotaxis Full Horizon)
  const [densityMode, setDensityMode] = useState<DensityMode>('smart');
  // Tracks manually expanded Document and Section Hubs
  const [expandedClusterIds, setExpandedClusterIds] = useState<Set<string>>(new Set());

  // Ingested Graph State
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

  const handleIngestionComplete = useCallback(async (_items?: IngestionBatchItem[]) => {
    const updated = await GraphStorage.getIngestedGraph();
    setIngestedGraph(updated);
  }, []);

  const handleClearIngested = useCallback(async () => {
    if (window.confirm('Clear all ingested documents and reset graph to baseline topology?')) {
      await GraphStorage.clearIngestedGraph();
      setIngestedGraph(GraphStorage.getIngestedGraphSync());
      setSelectedNode(null);
      setDrawerOpen(false);
      setExpandedClusterIds(new Set());
    }
  }, []);

  useEffect(() => {
    const closeOnEscape = (event: KeyboardEvent) => {
      if (event.key === 'Escape') {
        setDrawerOpen(false);
        canvasRef.current?.focus();
      }
    };
    if (drawerOpen) document.addEventListener('keydown', closeOnEscape);
    return () => document.removeEventListener('keydown', closeOnEscape);
  }, [drawerOpen]);

  // Active Hierarchical Baseline Tree
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
  const labelCullerRef = useRef<ScreenSpaceLabelCuller>(new ScreenSpaceLabelCuller());

  // Defensive helper for canvas bounding box
  const getCanvasRectDefensive = useCallback((): DOMRect | null => {
    const canvas = canvasRef.current;
    if (!canvas) return null;
    try {
      const rect = canvas.getBoundingClientRect();
      if (rect && rect.width > 0 && rect.height > 0) {
        return rect;
      }
    } catch {
      // In detached or test environments, getBoundingClientRect may throw
    }
    const width = canvas.clientWidth || (typeof window !== 'undefined' ? window.innerWidth : 1200);
    const height = canvas.clientHeight || (typeof window !== 'undefined' ? window.innerHeight : 800);
    return {
      left: 0,
      top: 0,
      right: width,
      bottom: height,
      width,
      height,
      x: 0,
      y: 0,
      toJSON: () => ({})
    };
  }, []);

  // Initialize Deep Starfield & Nebula Clusters
  useEffect(() => {
    const stars: typeof starsRef.current = [];
    const width = 4500;
    const height = 3500;
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
      { x: -350, y: -200, radius: 600, color: 'rgba(0, 240, 255, 0.08)', opacity: 0.8 },
      { x: 500, y: 100, radius: 720, color: 'rgba(139, 92, 246, 0.09)', opacity: 0.9 },
      { x: 150, y: -300, radius: 450, color: 'rgba(56, 189, 248, 0.07)', opacity: 0.75 },
      { x: 750, y: -250, radius: 500, color: 'rgba(217, 70, 239, 0.07)', opacity: 0.8 },
      { x: -200, y: 400, radius: 600, color: 'rgba(30, 58, 138, 0.15)', opacity: 0.85 },
      { x: 950, y: 300, radius: 480, color: 'rgba(14, 165, 233, 0.07)', opacity: 0.7 }
    ];
  }, []);

  // 1. Current Semantic Zoom Tier (Memoized Selector preventing re-renders during smooth pan/zoom)
  const currentLoDTier: LoDTier = useMemo(() => {
    return getLoDTier(viewport.scale);
  }, [viewport.scale]);

  // 2. Active ViewGraph Projection via Pure Spatial Engine
  const viewGraph = useMemo(() => {
    return projectViewGraph({
      treeData,
      ingestedGraph,
      densityMode,
      lodTier: currentLoDTier,
      expandedClusterIds,
      searchQuery,
      selectedNodeId: selectedNode?.id || null,
      hoveredNodeId
    });
  }, [
    treeData,
    ingestedGraph,
    densityMode,
    currentLoDTier,
    expandedClusterIds,
    searchQuery,
    selectedNode?.id,
    hoveredNodeId
  ]);

  const layoutTree = viewGraph.positionedNodes;
  const layoutTreeRef = useRef(layoutTree);
  layoutTreeRef.current = layoutTree;

  const bundledEdges = viewGraph.bundledEdges;
  const bundledEdgesRef = useRef(bundledEdges);
  bundledEdgesRef.current = bundledEdges;

  // Lookup map for fast node retrieval by ID across the entire topology
  const allNodesMap = useMemo(() => {
    const map = new Map<string, EpistemicTopologyNode>();
    const traverse = (n: EpistemicTopologyNode) => {
      map.set(n.id, n);
      if (n.children) n.children.forEach(traverse);
    };
    traverse(treeData);

    // Index all ingested nodes
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
        metadata: Object.entries(n.metadata || {}).map(([l, v]) => ({
          label: l,
          value: v,
          category: 'epistemic' as const
        })),
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

  // Toggle expansion of an individual Document or Section Hub
  const handleToggleClusterExpansion = useCallback((clusterId: string) => {
    setExpandedClusterIds((prev) => {
      const next = new Set(prev);
      if (next.has(clusterId)) {
        next.delete(clusterId);
      } else {
        next.add(clusterId);
      }
      return next;
    });
  }, []);

  // Center camera smoothly on any selected topology node
  const handleCenterNode = useCallback((node: EpistemicTopologyNode) => {
    const rect = getCanvasRectDefensive();
    if (!rect) return;
    const pos = layoutTreeRef.current.find((n) => n.id === node.id);
    if (!pos) return;
    const drawerOffset = window.innerWidth >= 640 ? 220 : 0;
    const targetX = (rect.width - drawerOffset) / 2 - pos.x * viewportRef.current.scale;
    const targetY = rect.height / 2 - pos.y * viewportRef.current.scale;
    setViewport((v) => ({ ...v, x: targetX, y: targetY }));
  }, [getCanvasRectDefensive]);

  // Filter or highlight connected relata
  const handleFilterConnected = useCallback((node: EpistemicTopologyNode) => {
    if (node.title) {
      const cleanKeyword = node.title.replace(/^[\d.]+\s*/, '').split(':')[0].trim();
      setSearchQuery(cleanKeyword);
    }
  }, []);

  // Select node by ID from drawer connected links
  const handleSelectNodeById = useCallback(
    (nodeId: string) => {
      const target = allNodesMap.get(nodeId);
      if (target) {
        setSelectedNode(target);
        setDrawerOpen(true);
        const pos = layoutTreeRef.current.find((n) => n.id === nodeId);
        if (pos) {
          handleCenterNode(pos);
        }
      }
    },
    [allNodesMap, handleCenterNode]
  );

  // Mouse & Gesture Handlers with Defensive Checks
  const handlePointerDown = (e: React.PointerEvent<HTMLCanvasElement>) => {
    if (e.button !== 0) return;
    e.currentTarget.setPointerCapture(e.pointerId);
    dragDistanceRef.current = 0;
    isDraggingRef.current = true;
    lastMousePosRef.current = { x: e.clientX, y: e.clientY };
  };

  const handlePointerMove = (e: React.PointerEvent<HTMLCanvasElement>) => {
    const rect = getCanvasRectDefensive();
    if (!rect) return;

    if (isDraggingRef.current) {
      const dx = e.clientX - lastMousePosRef.current.x;
      const dy = e.clientY - lastMousePosRef.current.y;
      dragDistanceRef.current += Math.hypot(dx, dy);
      lastMousePosRef.current = { x: e.clientX, y: e.clientY };

      setViewport((prev) => ({
        ...prev,
        x: Number.isFinite(prev.x + dx) ? prev.x + dx : prev.x,
        y: Number.isFinite(prev.y + dy) ? prev.y + dy : prev.y
      }));
    } else {
      // Hover detection for 1-hop Ego-Network Spotlight
      const canvasX = e.clientX - rect.left;
      const canvasY = e.clientY - rect.top;
      const vp = viewportRef.current;
      const safeScale = Number.isFinite(vp.scale) && vp.scale > 0 ? vp.scale : 0.85;
      const safeX = Number.isFinite(vp.x) ? vp.x : 0;
      const safeY = Number.isFinite(vp.y) ? vp.y : 0;
      const worldX = (canvasX - safeX) / safeScale;
      const worldY = (canvasY - safeY) / safeScale;

      let hitId: string | null = null;
      const currentNodes = layoutTreeRef.current;
      for (let i = currentNodes.length - 1; i >= 0; i--) {
        const node = currentNodes[i];
        const hitRadius = Math.max(node.radius || 12, 16);
        const dist = Math.hypot(node.x - worldX, node.y - worldY);
        if (dist <= hitRadius) {
          hitId = node.id;
          break;
        }
      }

      if (hitId !== hoveredNodeIdRef.current) {
        setHoveredNodeId(hitId);
        if (canvasRef.current) {
          canvasRef.current.style.cursor = hitId ? 'pointer' : 'grab';
        }
      }
    }
  };

  const handlePointerUp = (e: React.PointerEvent<HTMLCanvasElement>) => {
    isDraggingRef.current = false;
    if (e.currentTarget.hasPointerCapture(e.pointerId)) {
      e.currentTarget.releasePointerCapture(e.pointerId);
    }
    if (canvasRef.current) {
      canvasRef.current.style.cursor = hoveredNodeIdRef.current ? 'pointer' : 'grab';
    }
  };

  const handleWheel = useCallback((e: WheelEvent) => {
    e.preventDefault();
    const rect = getCanvasRectDefensive();
    if (!rect) return;

    const zoomFactor = e.deltaY < 0 ? 1.12 : 0.89;
    const mouseX = e.clientX - rect.left;
    const mouseY = e.clientY - rect.top;

    setViewport((prev) => {
      const currentScale = Number.isFinite(prev.scale) && prev.scale > 0 ? prev.scale : 0.85;
      const newScale = Math.min(Math.max(currentScale * zoomFactor, 0.15), 3.8);
      const ratio = newScale / currentScale;
      const newX = mouseX - (mouseX - prev.x) * ratio;
      const newY = mouseY - (mouseY - prev.y) * ratio;
      return {
        x: Number.isFinite(newX) ? newX : prev.x,
        y: Number.isFinite(newY) ? newY : prev.y,
        scale: newScale
      };
    });
  }, [getCanvasRectDefensive]);

  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    canvas.addEventListener('wheel', handleWheel, { passive: false });
    return () => canvas.removeEventListener('wheel', handleWheel);
  }, [handleWheel]);

  const handleCanvasClick = (e: React.MouseEvent<HTMLCanvasElement>) => {
    if (dragDistanceRef.current > 4) return;
    const rect = getCanvasRectDefensive();
    if (!rect) return;

    const canvasX = e.clientX - rect.left;
    const canvasY = e.clientY - rect.top;
    const vp = viewportRef.current;
    const worldX = (canvasX - vp.x) / vp.scale;
    const worldY = (canvasY - vp.y) / vp.scale;

    let found: PositionedVisualNode | null = null;
    const currentNodes = layoutTreeRef.current;
    for (let i = currentNodes.length - 1; i >= 0; i--) {
      const node = currentNodes[i];
      const hitRadius = Math.max(node.radius || 12, 18);
      const dist = Math.hypot(node.x - worldX, node.y - worldY);
      if (dist <= hitRadius) {
        found = node;
        break;
      }
    }

    if (found) {
      if (found.isClusterHub && (found.childCount || 0) > 0) {
        handleToggleClusterExpansion(found.id);
      }
      setSelectedNode(found);
      setDrawerOpen(true);
    } else {
      setDrawerOpen(false);
      setSelectedNode(null);
    }
  };

  const handleResetView = useCallback(() => {
    const canvas = canvasRef.current;
    const nodes = layoutTreeRef.current;
    if (!canvas || !nodes || nodes.length === 0) return;
    const rect = getCanvasRectDefensive();
    const clientWidth = rect?.width || canvas.clientWidth || (typeof window !== 'undefined' ? window.innerWidth : 1200);
    const clientHeight = rect?.height || canvas.clientHeight || (typeof window !== 'undefined' ? window.innerHeight : 800);
    if (!Number.isFinite(clientWidth) || !Number.isFinite(clientHeight) || clientWidth <= 0 || clientHeight <= 0) return;

    const validNodes = nodes.filter((n) => Number.isFinite(n.x) && Number.isFinite(n.y));
    if (validNodes.length === 0) return;

    const xs = validNodes.map((n) => n.x);
    const ys = validNodes.map((n) => n.y);
    const minX = Math.min(...xs) - 80;
    const maxX = Math.max(...xs) + 180;
    const minY = Math.min(...ys) - 80;
    const maxY = Math.max(...ys) + 80;

    const spanX = Math.max(120, maxX - minX);
    const spanY = Math.max(120, maxY - minY);
    const height = Math.max(160, clientHeight - 80);
    const scaleX = (clientWidth - 48) / spanX;
    const scaleY = height / spanY;
    const rawScale = Math.min(scaleX, scaleY);
    const safeScale = Number.isFinite(rawScale) && rawScale > 0
      ? Math.max(0.15, Math.min(0.85, rawScale))
      : 0.85;

    const targetX = clientWidth / 2 - ((minX + maxX) / 2) * safeScale;
    const targetY = clientHeight / 2 - ((minY + maxY) / 2) * safeScale;

    setViewport({
      x: Number.isFinite(targetX) ? targetX : clientWidth / 2.8,
      y: Number.isFinite(targetY) ? targetY : clientHeight / 2.2,
      scale: safeScale
    });
  }, [getCanvasRectDefensive]);

  useEffect(() => {
    handleResetView();
  }, [handleResetView]);

  const handleExpandAll = () => {
    const toggle = (node: EpistemicTopologyNode): EpistemicTopologyNode => ({
      ...node,
      _collapsed: false,
      children: node.children ? node.children.map(toggle) : undefined
    });
    setTreeData(toggle(treeData));

    const allHubIds = new Set<string>();
    ingestedGraph.nodes.forEach((n) => {
      if (n.nodeKind === 'document-hub' || n.nodeKind === 'section') {
        allHubIds.add(n.id);
      }
    });
    setExpandedClusterIds(allHubIds);
  };

  const handleCollapseAll = () => {
    const toggle = (node: EpistemicTopologyNode, depth: number = 0): EpistemicTopologyNode => ({
      ...node,
      _collapsed: depth >= 1,
      children: node.children ? node.children.map((c) => toggle(c, depth + 1)) : undefined
    });
    setTreeData(toggle(treeData, 0));
    setExpandedClusterIds(new Set());
  };

  // Main Canvas Render Loop (60 FPS Performance Pipeline) coupled with container ResizeObserver
  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const ctx = canvas.getContext('2d');
    if (!ctx) return;

    let running = true;
    let lastFrame = 0;

    const handleResize = () => {
      const parent = canvasContainerRef.current || canvas.parentElement;
      if (!parent) return;
      const pWidth = parent.clientWidth || canvas.clientWidth || (typeof window !== 'undefined' ? window.innerWidth : 1200);
      const pHeight = parent.clientHeight || canvas.clientHeight || (typeof window !== 'undefined' ? window.innerHeight : 800);
      if (pWidth <= 0 || pHeight <= 0) return;
      const dpr = Math.min(window.devicePixelRatio || 1, 2);
      const targetW = Math.floor(pWidth * dpr);
      const targetH = Math.floor(pHeight * dpr);
      if (canvas.width !== targetW || canvas.height !== targetH) {
        canvas.width = targetW;
        canvas.height = targetH;
      }
      ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
    };

    handleResize();

    const resizeObserver = new ResizeObserver(handleResize);
    if (canvasContainerRef.current) {
      resizeObserver.observe(canvasContainerRef.current);
    } else if (canvas.parentElement) {
      resizeObserver.observe(canvas.parentElement);
    }
    window.addEventListener('resize', handleResize);

    const render = (now: number) => {
      if (!running) return;
      if (document.hidden || now - lastFrame < 1000 / 60) {
        animFrameIdRef.current = requestAnimationFrame(render);
        return;
      }
      timeRef.current += lastFrame ? Math.min((now - lastFrame) / 1000, 0.05) : 1 / 60;
      lastFrame = now;
      const t = timeRef.current;
      const vp = viewportRef.current;
      const activeNodes = layoutTreeRef.current;
      const activeEdges = bundledEdgesRef.current;
      const activeHoverId = hoveredNodeIdRef.current;

      const width = canvas.clientWidth || canvas.parentElement?.clientWidth || (typeof window !== 'undefined' ? window.innerWidth : 1200);
      const height = canvas.clientHeight || canvas.parentElement?.clientHeight || (typeof window !== 'undefined' ? window.innerHeight : 800);
      if (width <= 0 || height <= 0) {
        animFrameIdRef.current = requestAnimationFrame(render);
        return;
      }

      const safeScale = Number.isFinite(vp.scale) && vp.scale > 0 ? vp.scale : 0.85;
      const safeX = Number.isFinite(vp.x) ? vp.x : width / 2.8;
      const safeY = Number.isFinite(vp.y) ? vp.y : height / 2.2;
      const lodTier = getLoDTier(safeScale);

      ctx.save();
      ctx.clearRect(0, 0, width, height);

      // 1. Deep Void Base Gradient (strictly bounded to positive finite radii)
      const maxDim = Math.max(width, height, 100);
      const innerR = Math.min(50, maxDim * 0.1);
      const baseGrad = ctx.createRadialGradient(
        width / 2,
        height / 2,
        innerR,
        width / 2,
        height / 2,
        maxDim
      );
      baseGrad.addColorStop(0, '#040714');
      baseGrad.addColorStop(0.5, '#02030a');
      baseGrad.addColorStop(1, '#000000');
      ctx.fillStyle = baseGrad;
      ctx.fillRect(0, 0, width, height);

      // 2. Render Ambient Nebula Clouds
      nebulaCloudsRef.current.forEach((nebula) => {
        const screenX = safeX + nebula.x * safeScale * 0.35;
        const screenY = safeY + nebula.y * safeScale * 0.35;
        const screenR = nebula.radius * safeScale;
        if (!Number.isFinite(screenX) || !Number.isFinite(screenY) || !Number.isFinite(screenR) || screenR <= 1) {
          return;
        }
        if (
          screenX + screenR < 0 ||
          screenX - screenR > width ||
          screenY + screenR < 0 ||
          screenY - screenR > height
        )
          return;

        const g = ctx.createRadialGradient(screenX, screenY, 0, screenX, screenY, screenR);
        g.addColorStop(0, nebula.color);
        g.addColorStop(1, 'transparent');
        ctx.fillStyle = g;
        ctx.beginPath();
        ctx.arc(screenX, screenY, screenR, 0, Math.PI * 2);
        ctx.fill();
      });

      // 3. Render Twinkling Multi-Spectral Starfield
      starsRef.current.forEach((star) => {
        const sx = safeX + star.x * safeScale * 0.55;
        const sy = safeY + star.y * safeScale * 0.55;
        const starR = star.size * Math.max(0.6, safeScale * 0.9);
        if (!Number.isFinite(sx) || !Number.isFinite(sy) || !Number.isFinite(starR) || starR <= 0) return;
        if (sx < 0 || sx > width || sy < 0 || sy > height) return;

        const pulse = Math.sin(t * star.speed * 60 + star.phase);
        const alpha = Math.max(0.1, star.baseAlpha + pulse * 0.3);

        ctx.fillStyle = star.color;
        ctx.globalAlpha = alpha;
        ctx.beginPath();
        ctx.arc(sx, sy, starR, 0, Math.PI * 2);
        ctx.fill();
      });
      ctx.globalAlpha = 1.0;

      // 4. World-Space Coordinate Transform
      ctx.save();
      ctx.translate(safeX, safeY);
      ctx.scale(safeScale, safeScale);

      // 5. Render 3D Torus Geometric Wireframe (Central Baseline Void)
      ctx.save();
      const torusR = 380;
      const tubeR = 110;
      const rings = 18;
      const segments = 22;
      const rotY = t * 0.1;
      const rotX = 0.55 + Math.sin(t * 0.07) * 0.08;

      ctx.strokeStyle = 'rgba(0, 240, 255, 0.10)';
      ctx.lineWidth = Math.max(0.5, 1 / safeScale);

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

      // 6. 1-Hop Ego-Network Spotlight Calculation
      const spotlightActive = Boolean(selectedNode || activeHoverId);
      const activeSpotlightId = selectedNode?.id || activeHoverId;
      const activeSpotlightNode = activeSpotlightId
        ? activeNodes.find((n) => n.id === activeSpotlightId)
        : null;

      const spotlightNeighborIds = new Set<string>();
      if (activeSpotlightId) {
        spotlightNeighborIds.add(activeSpotlightId);
        if (activeSpotlightNode?.connectedNodeIds) {
          activeSpotlightNode.connectedNodeIds.forEach((id) => spotlightNeighborIds.add(id));
        }
      }

      // 7. Render Hierarchical Baseline Light-Stream Bridges
      activeNodes.forEach((node) => {
        if (!node.parent) return;
        const p = node.parent;
        if (!Number.isFinite(node.x) || !Number.isFinite(node.y) || !Number.isFinite(p.x) || !Number.isFinite(p.y)) return;

        const isHighlighted =
          node.isMatch ||
          (activeSpotlightId &&
            (node.id === activeSpotlightId ||
              p.id === activeSpotlightId ||
              spotlightNeighborIds.has(node.id)));

        // Spotlight dimming: 15% opacity for unrelated background paths
        const edgeAlpha = spotlightActive ? (isHighlighted ? 0.95 : 0.15) : 0.35;
        ctx.globalAlpha = edgeAlpha;

        const dx = node.x - p.x;
        const dy = node.y - p.y;
        const cp1x = p.x + dx * 0.5;
        const cp1y = p.y;
        const cp2x = p.x + dx * 0.5;
        const cp2y = node.y;

        ctx.beginPath();
        ctx.moveTo(p.x, p.y);
        ctx.bezierCurveTo(cp1x, cp1y, cp2x, cp2y, node.x, node.y);
        ctx.strokeStyle = isHighlighted ? 'rgba(0, 240, 255, 0.9)' : 'rgba(56, 189, 248, 0.28)';
        ctx.lineWidth = (isHighlighted ? 3.2 : 1.6) / safeScale;
        ctx.stroke();

        if (isHighlighted) {
          ctx.beginPath();
          ctx.moveTo(p.x, p.y);
          ctx.bezierCurveTo(cp1x, cp1y, cp2x, cp2y, node.x, node.y);
          ctx.strokeStyle = '#ffffff';
          ctx.lineWidth = 1.2 / safeScale;
          ctx.stroke();
        }
      });
      ctx.globalAlpha = 1.0;

      // 8. Render Bundled Inter-Cluster Meta-Edges & Relational Arcs
      const culler = labelCullerRef.current;
      culler.reset(width, height, 55);

      activeEdges.forEach((edge) => {
        if (
          !Number.isFinite(edge.sourceX) ||
          !Number.isFinite(edge.sourceY) ||
          !Number.isFinite(edge.targetX) ||
          !Number.isFinite(edge.targetY)
        )
          return;

        const isHighlighted =
          edge.isHighlighted ||
          (activeSpotlightId &&
            (edge.source === activeSpotlightId ||
              edge.target === activeSpotlightId ||
              (spotlightNeighborIds.has(edge.source) && spotlightNeighborIds.has(edge.target))));

        const edgeAlpha = spotlightActive ? (isHighlighted ? 1.0 : 0.12) : 0.45;
        ctx.globalAlpha = edgeAlpha;

        // Quadratic Bézier curve with gentle orthogonal arc
        const midX = (edge.sourceX + edge.targetX) / 2;
        const midY = (edge.sourceY + edge.targetY) / 2;
        const dist = Math.hypot(edge.targetX - edge.sourceX, edge.targetY - edge.sourceY);
        const nx = -((edge.targetY - edge.sourceY) / (dist || 1)) * 32;
        const ny = ((edge.targetX - edge.sourceX) / (dist || 1)) * 32;
        const ctrlX = midX + nx;
        const ctrlY = midY + ny;

        ctx.beginPath();
        ctx.moveTo(edge.sourceX, edge.sourceY);
        ctx.quadraticCurveTo(ctrlX, ctrlY, edge.targetX, edge.targetY);

        const baseWidth = edge.isMetaEdge
          ? Math.min(6, 1.4 + Math.log2(edge.bundleCount + 1))
          : 1.4;
        const strokeW = (isHighlighted ? baseWidth * 1.6 : baseWidth) / safeScale;

        if (edge.relationType === 'proposed-contradiction' || edge.relationType === 'contradicts') {
          const dash = Math.max(1, 5 / safeScale);
          ctx.setLineDash([dash, dash]);
          ctx.strokeStyle = isHighlighted ? 'rgba(244, 63, 94, 0.95)' : 'rgba(244, 63, 94, 0.7)';
        } else if (edge.edgeCategory === 'philosophical') {
          ctx.setLineDash([]);
          ctx.strokeStyle = isHighlighted ? 'rgba(16, 185, 129, 0.95)' : 'rgba(16, 185, 129, 0.55)';
        } else {
          ctx.setLineDash([]);
          ctx.strokeStyle = isHighlighted ? 'rgba(0, 240, 255, 0.9)' : 'rgba(56, 189, 248, 0.4)';
        }

        ctx.lineWidth = strokeW;
        ctx.stroke();
        ctx.setLineDash([]);

        // Meta-Edge Badge: Visibility based on Semantic Zoom Tier
        const shouldShowEdgeLabel =
          lodTier >= 3
            ? true
            : isHighlighted || (edge.isMetaEdge && lodTier >= 1);

        if (shouldShowEdgeLabel && lodTier >= 1) {
          const badgeText = edge.isMetaEdge && lodTier < 3
            ? `${edge.bundleCount} links`
            : edge.relationType || `${edge.bundleCount} links`;

          const screenCtrlX = safeX + ctrlX * safeScale;
          const screenCtrlY = safeY + ctrlY * safeScale;

          if (culler.isInFrustum(screenCtrlX, screenCtrlY)) {
            const fontPx = 10;
            const textW = badgeText.length * 6.2 + 10;
            const edgeRect: ScreenRect = {
              x1: screenCtrlX - textW / 2 - 4,
              y1: screenCtrlY - fontPx,
              x2: screenCtrlX + textW / 2 + 4,
              y2: screenCtrlY + fontPx,
              priority: isHighlighted ? 9000 : 400
            };

            const canDrawEdgeLabel = isHighlighted || culler.testAndInsert(edgeRect);

            if (canDrawEdgeLabel) {
              ctx.save();
              ctx.font = '10px -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, sans-serif';
              const padX = 6;
              const padY = 3;

              ctx.fillStyle = isHighlighted ? 'rgba(15, 23, 42, 0.95)' : 'rgba(2, 6, 23, 0.85)';
              ctx.strokeStyle = isHighlighted
                ? 'rgba(56, 189, 248, 0.85)'
                : edge.relationType === 'contradicts'
                ? 'rgba(244, 63, 94, 0.6)'
                : 'rgba(148, 163, 184, 0.35)';
              ctx.lineWidth = 1 / safeScale;

              ctx.beginPath();
              drawRoundRect(ctx, ctrlX - textW / 2 - padX, ctrlY - 7 - padY, textW + padX * 2, 14 + padY * 2, 4);
              ctx.fill();
              ctx.stroke();

              ctx.fillStyle = isHighlighted
                ? '#38bdf8'
                : edge.relationType === 'contradicts'
                ? '#fda4af'
                : '#cbd5e1';
              ctx.textAlign = 'center';
              ctx.textBaseline = 'middle';
              ctx.fillText(badgeText, ctrlX, ctrlY);
              ctx.restore();
            }
          }
        }
      });
      ctx.globalAlpha = 1.0;

      // 9. Semantic Zoom Label Allocation & Collision Avoidance Grid
      const candidates: Array<{
        node: PositionedVisualNode;
        screenX: number;
        screenY: number;
        screenR: number;
        displayLabel: string;
      }> = [];

      activeNodes.forEach((node) => {
        if (!Number.isFinite(node.x) || !Number.isFinite(node.y)) return;
        const sx = safeX + node.x * safeScale;
        const sy = safeY + node.y * safeScale;
        const sr = (node.radius || 12) * safeScale;

        // Frustum Culling
        if (!culler.isInFrustum(sx, sy)) {
          node.canRenderLabel = false;
          return;
        }

        // Tier-Based Progressive Label Disclosure
        let shouldRenderLabel = false;
        let maxChars = 26;

        if (lodTier === 0) {
          shouldRenderLabel = Boolean(
            node.isMatch ||
            node.id === activeSpotlightId ||
            (node.level !== undefined && node.level <= 1) ||
            node.isClusterHub ||
            node.isFolded ||
            node.nodeKind === 'document-hub'
          );
          maxChars = 20;
        } else if (lodTier === 1) {
          shouldRenderLabel = Boolean(
            node.isMatch ||
            node.id === activeSpotlightId ||
            (node.level !== undefined && node.level <= 2) ||
            node.isClusterHub ||
            (node.degree || 0) >= 3
          );
          maxChars = 28;
        } else if (lodTier === 2) {
          shouldRenderLabel = true;
          maxChars = 34;
        } else {
          shouldRenderLabel = true;
          maxChars = 54;
        }

        const displayLabel = formatCanvasDisplayLabel(node.title, node.nodeKind, maxChars);
        node.canvasLabel = displayLabel;

        if (shouldRenderLabel) {
          candidates.push({
            node,
            screenX: sx,
            screenY: sy,
            screenR: sr,
            displayLabel
          });
        } else {
          node.canRenderLabel = false;
        }
      });

      // Sort candidate labels descending by priority score
      candidates.sort((a, b) => (b.node.priorityScore || 0) - (a.node.priorityScore || 0));

      // Register orbs of high-priority nodes to prevent labels from writing over neighbor circles
      candidates.slice(0, 20).forEach((c) => {
        culler.registerNodeOrb(c.screenX, c.screenY, c.screenR);
      });

      // AABB Collision Insertion Test (enforcing max 55 labels per frame)
      candidates.forEach((c) => {
        const fontSizePx = Math.max(
          10,
          Math.min(
            14,
            (c.node.level !== undefined && c.node.level <= 1 ? 13 : 11) *
              Math.min(1.2, Math.max(0.85, safeScale))
          )
        );
        const labelWidthPx = c.displayLabel.length * fontSizePx * 0.58 + 14;
        const labelHeightPx = fontSizePx + 8;

        const accepted = culler.testAndInsert({
          x1: c.screenX + c.screenR + 6,
          y1: c.screenY - labelHeightPx / 2,
          x2: c.screenX + c.screenR + 6 + labelWidthPx,
          y2: c.screenY + labelHeightPx / 2,
          priority: c.node.priorityScore || 0
        });

        c.node.canRenderLabel = accepted;
      });

      // 10. Render Luminous Nodes & Optical Glyphs
      activeNodes.forEach((node) => {
        if (!Number.isFinite(node.x) || !Number.isFinite(node.y)) return;
        const radius = Math.max(2, node.radius || 12);
        const isSelected = selectedNode && selectedNode.id === node.id;
        const isHovered = activeHoverId === node.id;
        const isMatch = node.isMatch;

        // Spotlight dimming
        const isSpotlightNode =
          !spotlightActive ||
          node.id === activeSpotlightId ||
          spotlightNeighborIds.has(node.id);

        ctx.globalAlpha = isSpotlightNode ? 1.0 : 0.15;

        // Aura Particles around Major Hubs
        if (node.particleCount && (isSpotlightNode || !spotlightActive)) {
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
          ctx.globalAlpha = isSpotlightNode ? 1.0 : 0.15;
        }

        // Luminous Glow Radial Gradient
        const glowR = Math.max(radius * 1.1, radius * (isSelected ? 3.8 : isHovered ? 3.0 : 2.4));
        const innerGlow = Math.max(0.1, radius * 0.2);
        if (Number.isFinite(glowR) && glowR > innerGlow) {
          const glow = ctx.createRadialGradient(
            node.x,
            node.y,
            innerGlow,
            node.x,
            node.y,
            glowR
          );
          glow.addColorStop(0, node.color || '#00f0ff');
          glow.addColorStop(0.4, node.glowColor || 'rgba(56, 189, 248, 0.4)');
          glow.addColorStop(1, 'transparent');
          ctx.fillStyle = glow;
          ctx.beginPath();
          ctx.arc(node.x, node.y, glowR, 0, Math.PI * 2);
          ctx.fill();
        }

        // Node Solid Core Orb
        ctx.beginPath();
        ctx.arc(node.x, node.y, radius, 0, Math.PI * 2);
        ctx.fillStyle = isSelected ? '#ffffff' : isHovered ? '#e0f2fe' : (node.color || '#00f0ff');
        ctx.fill();
        ctx.strokeStyle = isSelected
          ? '#38bdf8'
          : isMatch
          ? '#f43f5e'
          : (node.glowColor || '#38bdf8');
        ctx.lineWidth = (isSelected ? 3.5 : isHovered ? 2.5 : 1.5) / safeScale;
        ctx.stroke();

        // Compound Supernode Folded Child Count Badge (+N items)
        if (node.isFolded && (node.hiddenCount || node.childCount)) {
          ctx.save();
          const badgeCount = node.hiddenCount || node.childCount || 0;
          const badgeText = `+${badgeCount} items`;
          ctx.font = 'bold 9px monospace';
          const bw = ctx.measureText(badgeText).width;
          const bx = node.x;
          const by = node.y + radius + 11;

          ctx.fillStyle = 'rgba(6, 78, 59, 0.9)';
          ctx.strokeStyle = 'rgba(52, 211, 153, 0.8)';
          ctx.lineWidth = 1 / safeScale;

          ctx.beginPath();
          drawRoundRect(ctx, bx - bw / 2 - 5, by - 7, bw + 10, 14, 4);
          ctx.fill();
          ctx.stroke();

          ctx.fillStyle = '#6ee7b7';
          ctx.textAlign = 'center';
          ctx.textBaseline = 'middle';
          ctx.fillText(badgeText, bx, by);
          ctx.restore();
        }

        // Collision-Culled Node Typography
        if (node.canRenderLabel && node.canvasLabel) {
          const fontSize = Math.max(10, node.level !== undefined && node.level <= 1 ? 13 : 11);
          ctx.font = `${fontSize}px -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, sans-serif`;
          ctx.fillStyle = isSelected
            ? '#ffffff'
            : isHovered
            ? '#38bdf8'
            : isMatch
            ? '#fda4af'
            : '#e0f2fe';
          ctx.textAlign = 'left';
          ctx.textBaseline = 'middle';
          ctx.shadowColor = 'rgba(0, 0, 0, 0.95)';
          ctx.shadowBlur = 6;
          ctx.fillText(node.canvasLabel, node.x + radius + 8, node.y);
          ctx.shadowBlur = 0;

          // Tier 3: Render confidence modality micro-tag
          if (lodTier >= 3 && node.confidenceStatus) {
            ctx.font = '8px monospace';
            ctx.fillStyle =
              node.confidenceStatus === 'source-explicit'
                ? '#34d399'
                : node.confidenceStatus === 'strongly-supported-inference'
                ? '#38bdf8'
                : '#fbbf24';
            ctx.fillText(node.confidenceStatus, node.x + radius + 8, node.y + 13);
          }
        }
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
  }, [viewGraph, selectedNode]);

  // Compute matching count for search bar feedback
  const searchMatchCount = useMemo(() => {
    if (!searchQuery.trim()) return 0;
    return layoutTree.filter((n) => n.isMatch).length;
  }, [layoutTree, searchQuery]);

  return (
    <div
      ref={containerRef}
      className={`relative w-full h-full min-h-screen overflow-hidden select-none font-sans bg-black ${
        isFullscreen ? 'fixed inset-0 z-50' : 'w-full h-full'
      }`}
      style={{
        display: isMobile ? 'block' : 'grid',
        gridTemplateColumns: isMobile ? undefined : 'var(--sidebar-width, 320px) 1fr',
        transition: 'grid-template-columns 250ms cubic-bezier(0.4, 0, 0.2, 1)',
        ['--sidebar-width' as any]: sidebarOpen ? '320px' : '0px'
      }}
    >
      {/* Mobile Backdrop Overlay */}
      {isMobile && sidebarOpen && (
        <div
          onClick={() => setSidebarOpen(false)}
          className="fixed inset-0 z-30 bg-black/70 backdrop-blur-sm transition-opacity"
          aria-hidden="true"
        />
      )}

      {/* 1. Collapsible Glassmorphic Left Sidebar */}
      <aside
        className={`
          ${
            isMobile
              ? `fixed inset-y-0 left-0 z-40 w-[320px] max-w-[85vw] shadow-2xl transition-transform duration-250 ease-in-out ${
                  sidebarOpen ? 'translate-x-0' : '-translate-x-full'
                }`
              : `relative z-20 h-full overflow-hidden transition-all duration-250 ease-in-out ${
                  sidebarOpen ? 'opacity-100 pointer-events-auto' : 'opacity-0 pointer-events-none'
                }`
          }
          flex flex-col bg-slate-950/85 backdrop-blur-md border-r border-slate-800/80 text-slate-100
        `}
        style={!isMobile ? { width: 'var(--sidebar-width, 320px)' } : undefined}
      >
        <div className="w-[320px] min-w-[320px] h-full flex flex-col overflow-hidden">
          {/* Sidebar Header & Brand Telemetry */}
          <div className="p-4 border-b border-slate-800/80 bg-slate-950/90 flex flex-col gap-1.5 flex-shrink-0">
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-2">
                <div className="w-7 h-7 rounded-lg bg-cyan-950/80 border border-cyan-500/50 flex items-center justify-center shadow-[0_0_12px_rgba(0,240,255,0.3)]">
                  <Sparkles className="w-4 h-4 text-cyan-400 animate-pulse" />
                </div>
                <div>
                  <h1 className="text-sm font-bold tracking-wide text-white drop-shadow-[0_0_8px_rgba(0,240,255,0.5)]">
                    JOURNAL314 Ω
                  </h1>
                  <p className="text-[10px] text-cyan-400/80 font-mono tracking-wider">
                    Nihiltheistic Hypermap
                  </p>
                </div>
              </div>
              <span className="px-1.5 py-0.5 rounded text-[9px] font-mono font-medium bg-cyan-950/60 border border-cyan-800/60 text-cyan-300">
                v2.6 Ω
              </span>
            </div>
          </div>

          {/* Sticky Search & Filtering Section */}
          <div className="p-3 border-b border-slate-800/80 bg-slate-950/70 backdrop-blur-sm flex-shrink-0">
            <div className="relative w-full">
              <Search className="w-3.5 h-3.5 text-cyan-400 absolute left-3 top-2.5" />
              <input
                type="text"
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                placeholder="Search concepts, authors..."
                className="w-full rounded-lg pl-8 pr-7 py-1.5 text-xs text-white placeholder-slate-500 border transition-all duration-200 focus:outline-none focus:ring-1 focus:ring-cyan-400 bg-slate-900/90 border-slate-800 hover:border-slate-700"
              />
              {searchQuery && (
                <button
                  onClick={() => setSearchQuery('')}
                  className="absolute right-2.5 top-2.5 text-slate-400 hover:text-white"
                  title="Clear search"
                >
                  <X className="w-3.5 h-3.5" />
                </button>
              )}
            </div>
            {searchQuery && (
              <div className="mt-1.5 flex items-center justify-between text-[10px] font-mono px-1">
                <span className="text-rose-400">{searchMatchCount} matching entities</span>
                <button
                  onClick={() => setSearchQuery('')}
                  className="text-slate-400 hover:text-slate-200 underline"
                >
                  Reset
                </button>
              </div>
            )}
          </div>

          {/* Scrollable Workspace Controls */}
          <div className="flex-1 overflow-y-auto overflow-x-hidden p-4 space-y-5 custom-scrollbar">
            {/* Section 1: Navigation & Telemetry */}
            <div className="space-y-2.5">
              <div className="flex items-center justify-between text-[11px] font-semibold tracking-wider uppercase text-slate-400">
                <span className="flex items-center gap-1.5">
                  <Activity className="w-3.5 h-3.5 text-cyan-400" />
                  Telemetry & LoD
                </span>
                <span
                  className="px-1.5 py-0.5 rounded text-[9px] font-mono font-medium bg-slate-900 border border-slate-800 text-cyan-300"
                  title={LOD_TIER_LABELS[currentLoDTier].description}
                >
                  {LOD_TIER_LABELS[currentLoDTier].name}
                </span>
              </div>

              {/* Node Counters Card */}
              <div className="bg-slate-900/60 rounded-lg p-2.5 border border-slate-800/80 space-y-1.5 font-mono text-xs">
                <div className="flex items-center justify-between">
                  <span className="text-slate-400">Visible on Canvas:</span>
                  <span className="text-cyan-300 font-semibold">{layoutTree.length} nodes</span>
                </div>
                <div className="flex items-center justify-between">
                  <span className="text-slate-400">Corpus Capacity:</span>
                  <span className="text-slate-300">
                    {ingestedGraph.nodes.length > 0
                      ? `${50 + ingestedGraph.nodes.length} nodes`
                      : '50 baseline'}
                  </span>
                </div>
                {ingestedGraph.nodes.length > 0 && (
                  <div className="flex items-center justify-between text-emerald-400 text-[11px] pt-1 border-t border-slate-800/60">
                    <span>Ingested Documents:</span>
                    <span>
                      +{ingestedGraph.nodes.length} from{' '}
                      {new Set(ingestedGraph.nodes.map((n) => n.sourceFile)).size} docs
                    </span>
                  </div>
                )}
              </div>

              {/* Density Mode Segmented Selector */}
              <div className="space-y-1">
                <label className="text-[10px] font-mono uppercase tracking-wider text-slate-400 flex items-center gap-1">
                  <Sliders className="w-3 h-3 text-cyan-400" /> Density Mode
                </label>
                <div className="grid grid-cols-3 gap-1 bg-slate-900/80 p-1 rounded-lg border border-slate-800 text-[11px] font-mono">
                  <button
                    type="button"
                    onClick={() => setDensityMode('smart')}
                    className={`py-1.5 px-1 rounded transition text-center ${
                      densityMode === 'smart'
                        ? 'bg-cyan-950 text-cyan-300 border border-cyan-700/60 font-semibold shadow-sm'
                        : 'text-slate-400 hover:text-slate-200'
                    }`}
                    title="Auto Progressive Disclosure with Semantic Zoom"
                  >
                    Smart LoD
                  </button>
                  <button
                    type="button"
                    onClick={() => setDensityMode('architecture')}
                    className={`py-1.5 px-1 rounded transition text-center ${
                      densityMode === 'architecture'
                        ? 'bg-purple-950 text-purple-300 border border-purple-700/60 font-semibold shadow-sm'
                        : 'text-slate-400 hover:text-slate-200'
                    }`}
                    title="Baseline + Document Hubs + Sections + Concepts"
                  >
                    Arch
                  </button>
                  <button
                    type="button"
                    onClick={() => setDensityMode('full')}
                    className={`py-1.5 px-1 rounded transition text-center ${
                      densityMode === 'full'
                        ? 'bg-indigo-950 text-indigo-300 border border-indigo-700/60 font-semibold shadow-sm'
                        : 'text-slate-400 hover:text-slate-200'
                    }`}
                    title="Phyllotaxis Spiral Packing (Full Horizon)"
                  >
                    Full
                  </button>
                </div>
              </div>
            </div>

            {/* Section 2: Action Triggers */}
            <div className="space-y-2.5 pt-2 border-t border-slate-800/80">
              <h2 className="text-[11px] font-semibold tracking-wider uppercase text-slate-400 flex items-center gap-1.5">
                <Layers className="w-3.5 h-3.5 text-emerald-400" />
                Action Triggers
              </h2>

              <div className="space-y-2">
                {/* Primary Document Ingestion Button */}
                <button
                  type="button"
                  onClick={() => setIsIngestionOpen(true)}
                  className="w-full py-2 px-3 rounded-lg text-xs font-semibold text-emerald-200 border transition-all duration-200 hover:text-white flex items-center justify-between active:scale-[0.98] cursor-pointer group"
                  style={{
                    backgroundColor: 'rgba(6, 78, 59, 0.75)',
                    borderColor: 'rgba(52, 211, 153, 0.8)',
                    boxShadow: '0 0 12px rgba(16, 185, 129, 0.25)'
                  }}
                  title="Ingest philosophical writings (Markdown, Text, PDF, JSON, CSV)"
                >
                  <span className="flex items-center gap-2">
                    <Upload className="w-4 h-4 text-emerald-400 group-hover:scale-110 transition-transform" />
                    <span>Ingest Documents</span>
                  </span>
                  <span className="text-[10px] font-mono text-emerald-300/80 uppercase">Upload</span>
                </button>

                {/* Google Workspace & Drive Button */}
                <button
                  type="button"
                  onClick={() => setIsWorkspaceOpen(true)}
                  className="w-full py-2 px-3 rounded-lg text-xs font-semibold text-blue-200 border transition-all duration-200 hover:text-white flex items-center justify-between active:scale-[0.98] cursor-pointer group"
                  style={{
                    backgroundColor: 'rgba(30, 58, 138, 0.75)',
                    borderColor: 'rgba(96, 165, 250, 0.8)',
                    boxShadow: '0 0 12px rgba(59, 130, 246, 0.25)'
                  }}
                  title="Google Drive & Google Docs Hub"
                >
                  <span className="flex items-center gap-2">
                    <HardDrive className="w-4 h-4 text-blue-400 group-hover:scale-110 transition-transform" />
                    <span>Drive & Docs Hub</span>
                  </span>
                  {googleUser ? (
                    <span className="flex items-center gap-1 text-[10px] font-mono text-emerald-300">
                      <span className="w-2 h-2 rounded-full bg-emerald-400 shadow-[0_0_6px_#34d399]" />
                      Synced
                    </span>
                  ) : (
                    <span className="text-[10px] font-mono text-blue-300/80">Connect</span>
                  )}
                </button>

                {/* Cluster Expansion & Collapse */}
                <div className="grid grid-cols-2 gap-2 pt-1">
                  <button
                    type="button"
                    onClick={handleExpandAll}
                    className="py-1.5 px-2.5 rounded-lg text-xs font-medium text-cyan-200 border transition active:scale-95 bg-slate-900/80 border-cyan-800/60 hover:bg-slate-800 flex items-center justify-center gap-1 cursor-pointer"
                    title="Expand all baseline nodes and document clusters"
                  >
                    <ChevronRight className="w-3.5 h-3.5 text-cyan-400 rotate-90" />
                    <span>Expand All</span>
                  </button>

                  <button
                    type="button"
                    onClick={handleCollapseAll}
                    className="py-1.5 px-2.5 rounded-lg text-xs font-medium text-purple-200 border transition active:scale-95 bg-slate-900/80 border-purple-800/60 hover:bg-slate-800 flex items-center justify-center gap-1 cursor-pointer"
                    title="Fold document clusters into supernodes"
                  >
                    <ChevronRight className="w-3.5 h-3.5 text-purple-400" />
                    <span>Collapse All</span>
                  </button>
                </div>

                {/* Reset Ingested Graph */}
                {ingestedGraph.nodes.length > 0 && (
                  <button
                    type="button"
                    onClick={handleClearIngested}
                    className="w-full py-1.5 px-3 rounded-lg text-xs font-medium text-rose-300 border border-rose-500/40 bg-rose-950/40 hover:bg-rose-900/60 transition active:scale-95 flex items-center justify-center gap-1.5 cursor-pointer mt-1"
                    title="Clear Ingested Graph"
                  >
                    <Trash2 className="w-3.5 h-3.5 text-rose-400" />
                    <span>Reset Ingested Corpus</span>
                  </button>
                )}
              </div>
            </div>

            {/* Section 3: Epistemic Taxonomy Legend */}
            <div className="space-y-2 pt-2 border-t border-slate-800/80">
              <h2 className="text-[11px] font-semibold tracking-wider uppercase text-slate-400 flex items-center gap-1.5">
                <Compass className="w-3.5 h-3.5 text-purple-400" />
                Epistemic Legend
              </h2>
              <div className="bg-slate-900/40 rounded-lg p-2.5 border border-slate-800/60 space-y-1.5 text-[11px] font-mono">
                <div className="flex items-center gap-2">
                  <span className="w-2.5 h-2.5 rounded-full bg-cyan-400 shadow-[0_0_6px_#22d3ee]" />
                  <span className="text-slate-300">Baseline Ontology</span>
                </div>
                <div className="flex items-center gap-2">
                  <span className="w-2.5 h-2.5 rounded-full bg-emerald-400 shadow-[0_0_6px_#34d399]" />
                  <span className="text-slate-300">Document Supernodes</span>
                </div>
                <div className="flex items-center gap-2">
                  <span className="w-2.5 h-2.5 rounded-full bg-indigo-400 shadow-[0_0_6px_#818cf8]" />
                  <span className="text-slate-300">Section & Concept Hubs</span>
                </div>
                <div className="flex items-center gap-2">
                  <span className="w-2.5 h-2.5 rounded-full bg-rose-400 shadow-[0_0_6px_#f43f5e]" />
                  <span className="text-slate-300">Dialectical Tensions</span>
                </div>
                <div className="flex items-center gap-2">
                  <span className="w-2.5 h-2.5 rounded-full bg-amber-400 shadow-[0_0_6px_#fbbf24]" />
                  <span className="text-slate-300">Unresolved References</span>
                </div>
              </div>
            </div>
          </div>

          {/* Sidebar Footer Controls */}
          <div className="p-3 border-t border-slate-800/80 bg-slate-950/90 flex items-center justify-between text-xs font-mono text-slate-400 flex-shrink-0">
            <span className="text-cyan-400/90">Zoom: {Math.round(viewport.scale * 100)}%</span>
            <button
              type="button"
              onClick={handleResetView}
              className="px-2 py-1 rounded bg-slate-900 hover:bg-slate-800 border border-slate-700/80 text-cyan-300 hover:text-white transition flex items-center gap-1 active:scale-95 cursor-pointer"
              title="Reset Viewport Center"
            >
              <Maximize2 className="w-3 h-3" />
              <span>Center</span>
            </button>
          </div>
        </div>
      </aside>

      {/* 2. Sleek Boundary Toggle Button */}
      <button
        type="button"
        onClick={() => setSidebarOpen((prev) => !prev)}
        className="absolute top-4 z-40 w-8 h-8 rounded-full bg-slate-900/95 hover:bg-slate-800 border border-cyan-500/50 text-cyan-300 hover:text-white flex items-center justify-center shadow-[0_0_12px_rgba(0,240,255,0.3)] backdrop-blur-md transition-all duration-200 active:scale-95 cursor-pointer focus:outline-none focus:ring-2 focus:ring-cyan-500/50"
        style={{
          left: isMobile
            ? (sidebarOpen ? 'calc(320px - 14px)' : '14px')
            : (sidebarOpen ? 'calc(var(--sidebar-width, 320px) - 16px)' : '16px'),
          transition: 'left 250ms cubic-bezier(0.4, 0, 0.2, 1)'
        }}
        title={sidebarOpen ? 'Collapse sidebar' : 'Expand sidebar'}
        aria-label={sidebarOpen ? 'Collapse sidebar' : 'Expand sidebar'}
      >
        <ChevronRight
          className={`w-4 h-4 transition-transform duration-250 ${sidebarOpen ? 'rotate-180' : ''}`}
        />
      </button>

      {/* 3. Main Graph Canvas Viewport Wrapper */}
      <main ref={canvasContainerRef} className="relative w-full h-full overflow-hidden">
        {/* Full-Viewport Cosmic Canvas */}
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
            if (event.key === 'Enter') {
              setSelectedNode(layoutTree[0]);
              setDrawerOpen(true);
            } else if (event.key === 'Escape') {
              setDrawerOpen(false);
            } else if (event.key === 'Home') {
              event.preventDefault();
              handleResetView();
            } else if (['ArrowLeft', 'ArrowRight', 'ArrowUp', 'ArrowDown'].includes(event.key)) {
              event.preventDefault();
              setViewport((v) => ({
                ...v,
                x: Number.isFinite(v.x) ? v.x + (event.key === 'ArrowLeft' ? 30 : event.key === 'ArrowRight' ? -30 : 0) : v.x,
                y: Number.isFinite(v.y) ? v.y + (event.key === 'ArrowUp' ? 30 : event.key === 'ArrowDown' ? -30 : 0) : v.y
              }));
            } else if (['+', '=', '-'].includes(event.key)) {
              event.preventDefault();
              setViewport((v) => {
                const curScale = Number.isFinite(v.scale) && v.scale > 0 ? v.scale : 0.85;
                return {
                  ...v,
                  scale: Math.min(3.8, Math.max(0.15, curScale * (event.key === '-' ? 0.89 : 1.12)))
                };
              });
            }
          }}
          style={{ touchAction: 'none' }}
          className="w-full h-full cursor-grab active:cursor-grabbing block focus-visible:outline focus-visible:outline-cyan-400"
        />

        {/* Floating Quick Viewport Dock (Bottom-Right) */}
        <div className="absolute bottom-5 right-5 z-30 flex items-center gap-2">
          <button
            type="button"
            onClick={() => setViewport((v) => ({ ...v, scale: Math.min(v.scale * 1.2, 3.8) }))}
            className="p-2.5 rounded-lg bg-zinc-950/80 text-cyan-300 border border-cyan-500/50 hover:border-cyan-400 backdrop-blur-md transition active:scale-95 cursor-pointer shadow-lg"
            title="Zoom In (+)"
          >
            <ZoomIn className="w-4 h-4" />
          </button>

          <button
            type="button"
            onClick={() => setViewport((v) => ({ ...v, scale: Math.max(v.scale * 0.8, 0.15) }))}
            className="p-2.5 rounded-lg bg-zinc-950/80 text-cyan-300 border border-cyan-500/50 hover:border-cyan-400 backdrop-blur-md transition active:scale-95 cursor-pointer shadow-lg"
            title="Zoom Out (-)"
          >
            <ZoomOut className="w-4 h-4" />
          </button>

          <button
            type="button"
            onClick={handleResetView}
            className="p-2.5 rounded-lg bg-zinc-950/80 text-cyan-300 border border-cyan-500/50 hover:border-cyan-400 backdrop-blur-md transition active:scale-95 cursor-pointer shadow-lg"
            title="Center Canvas (Home)"
          >
            <Maximize2 className="w-4 h-4" />
          </button>

          <button
            type="button"
            onClick={async () => {
              if (document.fullscreenElement) {
                await document.exitFullscreen();
              } else {
                await containerRef.current?.requestFullscreen().catch(() => setIsFullscreen(true));
              }
            }}
            className="p-2.5 rounded-lg bg-zinc-950/80 text-purple-300 border border-purple-500/50 hover:border-purple-400 backdrop-blur-md transition active:scale-95 cursor-pointer shadow-lg"
            title={isFullscreen ? 'Exit Fullscreen' : 'Fullscreen'}
          >
            {isFullscreen ? <Minimize2 className="w-4 h-4" /> : <Maximize2 className="w-4 h-4" />}
          </button>
        </div>

        {/* Canvas Navigation Hints & Zoom Scale (Bottom-Left) */}
        <footer className="absolute bottom-4 left-4 z-20 flex flex-wrap items-center gap-2 text-[9px] sm:text-[11px] font-mono text-cyan-300/70 pointer-events-none">
          <span className="hidden sm:inline px-2.5 py-1 rounded bg-black/75 backdrop-blur-md border border-cyan-500/30">
            • Pan: Drag canvas
          </span>
          <span className="hidden sm:inline px-2.5 py-1 rounded bg-black/75 backdrop-blur-md border border-cyan-500/30">
            • Zoom: Scroll wheel ({Math.round(viewport.scale * 100)}%)
          </span>
          <span className="px-2.5 py-1 rounded bg-black/75 backdrop-blur-md border border-cyan-500/30">
            • Inspect & Expand: Click node
          </span>
        </footer>

        {/* Accessible High-Performance Side-Panel Drawer */}
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
          isClusterExpanded={selectedNode ? expandedClusterIds.has(selectedNode.id) : false}
          onToggleClusterExpansion={handleToggleClusterExpansion}
        />

        {/* Document Ingestion Subsystem Modal */}
        <IngestionModal
          isOpen={isIngestionOpen}
          onClose={() => setIsIngestionOpen(false)}
          onIngestionComplete={handleIngestionComplete}
          onOpenGoogleWorkspace={() => setIsWorkspaceOpen(true)}
        />

        {/* Google Workspace Integration Modal (Drive & Docs) */}
        <GoogleWorkspaceModal
          isOpen={isWorkspaceOpen}
          onClose={() => setIsWorkspaceOpen(false)}
          onIngestionComplete={handleIngestionComplete}
          selectedNode={selectedNode}
          baselineTree={treeData}
          ingestedGraph={ingestedGraph}
        />
      </main>
    </div>
  );
};
