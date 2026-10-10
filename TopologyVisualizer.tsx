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
  Quote
} from 'lucide-react';
import {
  MARKMAP_EPITEMIC_TOPOLOGY,
  type EpistemicTopologyNode
} from './GroundedEpistemicTopologyData';

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
    return positioned;
  }, [treeData, searchQuery]);

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
    }
  };

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
        ctx.font = `${Math.max(10, (node.level <= 1 ? 13 : 11))}px -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, sans-serif`;
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
  }, [layoutTree, selectedNode]);

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
        className="absolute top-4 left-4 right-4 sm:right-auto sm:max-w-2xl z-30 p-4 rounded-xl border backdrop-blur-xl transition-all duration-300 pointer-events-auto"
        style={{
          backgroundColor: 'rgba(4, 8, 22, 0.75)',
          borderColor: 'rgba(56, 189, 248, 0.75)',
          boxShadow: '0 0 25px rgba(0, 240, 255, 0.3), inset 0 0 16px rgba(139, 92, 246, 0.22)'
        }}
      >
        <div className="flex flex-col space-y-2.5">
          <div>
            <h1 className="text-lg sm:text-xl font-bold tracking-wide text-white drop-shadow-[0_0_12px_rgba(0,240,255,0.7)] flex items-center gap-2">
              <Sparkles className="w-5 h-5 text-cyan-400 animate-pulse" />
              <span>JOURNAL314 Ω — Nihiltheistic Hypermap Visual</span>
            </h1>
            <p className="text-xs font-mono text-cyan-300/90 tracking-wider mt-0.5">
              {layoutTree.length} visible nodes &nbsp;•&nbsp; Visual reference topology
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

      {/* 5. Holographic Glassmorphic Node Inspector Drawer */}
      {drawerOpen && selectedNode && (
        <aside
          className="absolute top-0 right-0 bottom-0 w-full sm:w-[420px] z-40 p-5 flex flex-col backdrop-blur-2xl border-l transition-transform duration-300 shadow-2xl overflow-y-auto"
          style={{
            backgroundColor: 'rgba(2, 6, 20, 0.90)',
            borderColor: 'rgba(0, 240, 255, 0.6)',
            boxShadow: '-10px 0 35px rgba(0, 240, 255, 0.25)'
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
                  backgroundColor: 'rgba(8, 16, 36, 0.8)',
                  borderColor: 'rgba(56, 189, 248, 0.5)'
                }}
              >
                <div className="text-[10px] font-mono text-cyan-400 uppercase tracking-wider flex items-center gap-1.5">
                  <Quote className="w-3 h-3" />
                  <span>Philosophical Fragment</span>
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
                Topological Metadata
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
                  <span className="text-emerald-400 font-bold">Preserved (100%)</span>
                </div>
              </div>
            </div>

            {selectedNode.children && selectedNode.children.length > 0 && (
              <div className="space-y-1.5">
                <div className="text-[10px] font-mono text-zinc-400 uppercase tracking-wider">
                  Connected Branches ({selectedNode.children.length})
                </div>
                <div className="space-y-1 max-h-56 overflow-y-auto pr-1">
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
          </div>
        </aside>
      )}
    </div>
  );
};
