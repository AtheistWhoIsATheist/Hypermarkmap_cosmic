import React, { useRef, useEffect, useCallback } from 'react';
import type { PositionedVisualNode, ViewportCamera } from '../utils/graphSpatialEngine';

interface CosmicMinimapProps {
  nodes: PositionedVisualNode[];
  viewport: ViewportCamera;
  canvasWidth: number;
  canvasHeight: number;
  onPanToWorld: (worldX: number, worldY: number) => void;
  className?: string;
}

export const CosmicMinimap: React.FC<CosmicMinimapProps> = ({
  nodes,
  viewport,
  canvasWidth,
  canvasHeight,
  onPanToWorld,
  className = ''
}) => {
  const minimapCanvasRef = useRef<HTMLCanvasElement | null>(null);
  const isDraggingRef = useRef(false);

  // Compute bounding box of all nodes with safety margins
  const bounds = React.useMemo(() => {
    if (!nodes || nodes.length === 0) {
      return { minX: -600, maxX: 600, minY: -400, maxY: 400, width: 1200, height: 800 };
    }
    let minX = Infinity;
    let maxX = -Infinity;
    let minY = Infinity;
    let maxY = -Infinity;

    for (const node of nodes) {
      if (Number.isFinite(node.x) && Number.isFinite(node.y)) {
        if (node.x < minX) minX = node.x;
        if (node.x > maxX) maxX = node.x;
        if (node.y < minY) minY = node.y;
        if (node.y > maxY) maxY = node.y;
      }
    }

    if (!Number.isFinite(minX)) {
      return { minX: -600, maxX: 600, minY: -400, maxY: 400, width: 1200, height: 800 };
    }

    const pad = 120;
    minX -= pad;
    maxX += pad;
    minY -= pad;
    maxY += pad;

    return {
      minX,
      maxX,
      minY,
      maxY,
      width: Math.max(200, maxX - minX),
      height: Math.max(200, maxY - minY)
    };
  }, [nodes]);

  // Render Minimap
  useEffect(() => {
    const canvas = minimapCanvasRef.current;
    if (!canvas) return;
    const ctx = canvas.getContext('2d');
    if (!ctx) return;

    const w = canvas.width;
    const h = canvas.height;

    ctx.clearRect(0, 0, w, h);

    // Deep cosmic background
    const bgGrad = ctx.createLinearGradient(0, 0, w, h);
    bgGrad.addColorStop(0, '#0B0E14');
    bgGrad.addColorStop(1, '#121824');
    ctx.fillStyle = bgGrad;
    ctx.fillRect(0, 0, w, h);

    // Grid lines
    ctx.strokeStyle = 'rgba(255, 255, 255, 0.04)';
    ctx.lineWidth = 1;
    ctx.beginPath();
    for (let x = 20; x < w; x += 20) {
      ctx.moveTo(x, 0);
      ctx.lineTo(x, h);
    }
    for (let y = 15; y < h; y += 15) {
      ctx.moveTo(0, y);
      ctx.lineTo(w, y);
    }
    ctx.stroke();

    // Scale world coordinates to minimap coordinates
    const scaleX = (w - 16) / bounds.width;
    const scaleY = (h - 16) / bounds.height;
    const mapScale = Math.min(scaleX, scaleY);

    const offsetX = 8 + (w - 16 - bounds.width * mapScale) / 2;
    const offsetY = 8 + (h - 16 - bounds.height * mapScale) / 2;

    const worldToMap = (wx: number, wy: number) => ({
      mx: offsetX + (wx - bounds.minX) * mapScale,
      my: offsetY + (wy - bounds.minY) * mapScale
    });

    // Draw nodes as dots
    for (let i = 0; i < nodes.length; i++) {
      const node = nodes[i];
      if (!Number.isFinite(node.x) || !Number.isFinite(node.y)) continue;
      const { mx, my } = worldToMap(node.x, node.y);

      let dotColor = '#38bdf8'; // Cyan default
      let dotR = 1.5;

      if (node.isClusterHub || node.nodeKind === 'document-hub') {
        dotColor = '#34d399'; // Emerald
        dotR = 3;
      } else if (node.nodeKind === 'section') {
        dotColor = '#818cf8'; // Indigo
        dotR = 2.2;
      } else if (node.nodeKind === 'unresolved-reference') {
        dotColor = '#fbbf24'; // Amber
        dotR = 1.8;
      } else if (node.color?.includes('#f43f5e')) {
        dotColor = '#f43f5e'; // Rose
        dotR = 2;
      }

      ctx.fillStyle = dotColor;
      ctx.beginPath();
      ctx.arc(mx, my, dotR, 0, Math.PI * 2);
      ctx.fill();
    }

    // Draw Viewport Frustum Box
    const safeScale = Number.isFinite(viewport.scale) && viewport.scale > 0 ? viewport.scale : 0.85;
    const safeW = canvasWidth > 0 ? canvasWidth : 1000;
    const safeH = canvasHeight > 0 ? canvasHeight : 700;

    // World coordinates of current screen viewport
    const viewWorldLeft = -viewport.x / safeScale;
    const viewWorldTop = -viewport.y / safeScale;
    const viewWorldRight = viewWorldLeft + safeW / safeScale;
    const viewWorldBottom = viewWorldTop + safeH / safeScale;

    const topLeft = worldToMap(viewWorldLeft, viewWorldTop);
    const bottomRight = worldToMap(viewWorldRight, viewWorldBottom);

    const boxX = Math.max(2, Math.min(w - 6, topLeft.mx));
    const boxY = Math.max(2, Math.min(h - 6, topLeft.my));
    const boxW = Math.max(8, Math.min(w - 4, bottomRight.mx - topLeft.mx));
    const boxH = Math.max(8, Math.min(h - 4, bottomRight.my - topLeft.my));

    // Viewport box fill and glow border
    ctx.fillStyle = 'rgba(0, 240, 255, 0.08)';
    ctx.fillRect(boxX, boxY, boxW, boxH);

    ctx.strokeStyle = '#00f0ff';
    ctx.lineWidth = 1.5;
    ctx.strokeRect(boxX, boxY, boxW, boxH);

    // Corner accents
    ctx.strokeStyle = '#34d399';
    ctx.lineWidth = 2;
    const arm = 3;
    // Top-left
    ctx.beginPath();
    ctx.moveTo(boxX, boxY + arm);
    ctx.lineTo(boxX, boxY);
    ctx.lineTo(boxX + arm, boxY);
    ctx.stroke();
  }, [nodes, viewport, canvasWidth, canvasHeight, bounds]);

  // Handle click or drag on minimap to pan main viewport
  const handleMinimapInteraction = useCallback(
    (e: React.PointerEvent<HTMLCanvasElement>) => {
      const canvas = minimapCanvasRef.current;
      if (!canvas) return;
      const rect = canvas.getBoundingClientRect();
      const clickX = e.clientX - rect.left;
      const clickY = e.clientY - rect.top;

      const w = canvas.width;
      const h = canvas.height;

      const scaleX = (w - 16) / bounds.width;
      const scaleY = (h - 16) / bounds.height;
      const mapScale = Math.min(scaleX, scaleY);

      const offsetX = 8 + (w - 16 - bounds.width * mapScale) / 2;
      const offsetY = 8 + (h - 16 - bounds.height * mapScale) / 2;

      // Map click coordinate back to world coordinates
      const worldX = bounds.minX + (clickX - offsetX) / mapScale;
      const worldY = bounds.minY + (clickY - offsetY) / mapScale;

      onPanToWorld(worldX, worldY);
    },
    [bounds, onPanToWorld]
  );

  return (
    <div
      className={`relative rounded-xl overflow-hidden border border-white/10 shadow-[0_8px_24px_rgba(0,0,0,0.6)] bg-[#0B0E14]/90 backdrop-blur-md ${className}`}
      title="Cosmic Minimap (Click or drag to navigate)"
    >
      <div className="flex items-center justify-between px-2.5 py-1 bg-[#121824]/80 border-b border-white/10 text-[10px] font-mono text-slate-300">
        <span className="flex items-center gap-1.5 text-cyan-300">
          <span className="w-1.5 h-1.5 rounded-full bg-cyan-400 animate-pulse" />
          Minimap
        </span>
        <span className="text-slate-400 text-[9px]">{nodes.length} nodes</span>
      </div>
      <canvas
        ref={minimapCanvasRef}
        width={180}
        height={110}
        onPointerDown={(e) => {
          isDraggingRef.current = true;
          e.currentTarget.setPointerCapture(e.pointerId);
          handleMinimapInteraction(e);
        }}
        onPointerMove={(e) => {
          if (isDraggingRef.current) {
            handleMinimapInteraction(e);
          }
        }}
        onPointerUp={(e) => {
          isDraggingRef.current = false;
          if (e.currentTarget.hasPointerCapture(e.pointerId)) {
            e.currentTarget.releasePointerCapture(e.pointerId);
          }
        }}
        onPointerCancel={(e) => {
          isDraggingRef.current = false;
          if (e.currentTarget.hasPointerCapture(e.pointerId)) {
            e.currentTarget.releasePointerCapture(e.pointerId);
          }
        }}
        className="w-[180px] h-[110px] block cursor-crosshair active:cursor-grabbing"
      />
    </div>
  );
};
