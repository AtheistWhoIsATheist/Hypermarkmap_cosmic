import React, { useState } from 'react';
import {
  Search,
  X,
  Sliders,
  Maximize2,
  Minimize2,
  ZoomIn,
  ZoomOut,
  Compass,
  RotateCcw,
  ChevronDown,
  ChevronUp,
  Map as MapIcon,
  ChevronLeft,
  ChevronRight,
  Layers,
  PlusCircle,
  Download
} from 'lucide-react';
import { CosmicMinimap } from './CosmicMinimap';
import type { PositionedVisualNode, ViewportCamera, LayoutPhysicsOptions } from '../utils/graphSpatialEngine';

interface CosmicFloatingHUDProps {
  nodes: PositionedVisualNode[];
  viewport: ViewportCamera;
  canvasWidth: number;
  canvasHeight: number;
  searchQuery: string;
  onSearchChange: (query: string) => void;
  searchMatchCount: number;
  matchingNodes: PositionedVisualNode[];
  onSelectNode: (node: PositionedVisualNode) => void;
  onPanToWorld: (worldX: number, worldY: number) => void;
  layoutOptions: LayoutPhysicsOptions;
  onLayoutOptionsChange: (options: LayoutPhysicsOptions) => void;
  onOpenResetLayoutModal: () => void;
  onResetView: () => void;
  onZoomIn: () => void;
  onZoomOut: () => void;
  isFullscreen: boolean;
  onToggleFullscreen: () => void;
  onOpenCreateNode?: () => void;
  onOpenExport?: () => void;
}

export const CosmicFloatingHUD: React.FC<CosmicFloatingHUDProps> = ({
  nodes,
  viewport,
  canvasWidth,
  canvasHeight,
  searchQuery,
  onSearchChange,
  searchMatchCount,
  matchingNodes,
  onSelectNode,
  onPanToWorld,
  layoutOptions,
  onLayoutOptionsChange,
  onOpenResetLayoutModal,
  onResetView,
  onZoomIn,
  onZoomOut,
  isFullscreen,
  onToggleFullscreen,
  onOpenCreateNode,
  onOpenExport
}) => {
  const [isHudExpanded, setIsHudExpanded] = useState(true);
  const [showMinimap, setShowMinimap] = useState(true);
  const [showLayoutSliders, setShowLayoutSliders] = useState(false);
  const [currentMatchIndex, setCurrentMatchIndex] = useState(0);

  // Cycle through search matches
  const handleNextMatch = () => {
    if (matchingNodes.length === 0) return;
    const nextIdx = (currentMatchIndex + 1) % matchingNodes.length;
    setCurrentMatchIndex(nextIdx);
    const target = matchingNodes[nextIdx];
    if (target) {
      onSelectNode(target);
      onPanToWorld(target.x, target.y);
    }
  };

  const handlePrevMatch = () => {
    if (matchingNodes.length === 0) return;
    const prevIdx = (currentMatchIndex - 1 + matchingNodes.length) % matchingNodes.length;
    setCurrentMatchIndex(prevIdx);
    const target = matchingNodes[prevIdx];
    if (target) {
      onSelectNode(target);
      onPanToWorld(target.x, target.y);
    }
  };

  return (
    <div className="absolute top-4 right-4 z-30 flex flex-col items-end gap-2.5 max-w-[calc(100vw-32px)] sm:max-w-md pointer-events-auto">
      {/* Main Glassmorphic HUD Card */}
      <div className="w-full bg-[#0B0E14]/90 backdrop-blur-md border border-white/10 rounded-2xl shadow-[0_12px_36px_rgba(0,0,0,0.65)] overflow-hidden transition-all duration-300">
        {/* HUD Top Bar & Collapse Toggle */}
        <div className="flex items-center justify-between px-3.5 py-2.5 bg-[#121824]/90 border-b border-white/10">
          <div className="flex items-center gap-2">
            <span className="w-2 h-2 rounded-full bg-cyan-400 shadow-[0_0_8px_#00f0ff]" />
            <span className="font-serif font-bold text-xs tracking-wide text-slate-100 flex items-center gap-1.5">
              Epistemic HUD
              <span className="text-[10px] font-mono text-cyan-300/80 px-1 py-0.2 rounded bg-cyan-950/80 border border-cyan-500/30">
                {Math.round(viewport.scale * 100)}%
              </span>
            </span>
          </div>

          <div className="flex items-center gap-1.5">
            {onOpenCreateNode && (
              <button
                type="button"
                onClick={onOpenCreateNode}
                className="px-2 py-1 rounded-lg border border-indigo-500/40 bg-indigo-950/70 hover:bg-indigo-900/80 text-indigo-200 text-xs font-medium transition cursor-pointer flex items-center gap-1 shadow-sm active:scale-95"
                title="Add Concept Node (N)"
                aria-label="Add Concept Node"
              >
                <PlusCircle className="w-3.5 h-3.5 text-indigo-400" />
                <span className="hidden sm:inline text-[11px]">Concept</span>
              </button>
            )}

            {onOpenExport && (
              <button
                type="button"
                onClick={onOpenExport}
                className="px-2 py-1 rounded-lg border border-cyan-500/40 bg-cyan-950/70 hover:bg-cyan-900/80 text-cyan-200 text-xs font-medium transition cursor-pointer flex items-center gap-1 shadow-sm active:scale-95"
                title="Export Topology JSON (Ctrl+E)"
                aria-label="Export Topology JSON"
              >
                <Download className="w-3.5 h-3.5 text-cyan-400" />
                <span className="hidden sm:inline text-[11px]">Export</span>
              </button>
            )}

            <button
              type="button"
              onClick={() => setShowMinimap((prev) => !prev)}
              className={`p-1.5 rounded-lg border text-xs transition cursor-pointer ${
                showMinimap
                  ? 'bg-cyan-950/80 border-cyan-500/40 text-cyan-300 shadow-[0_0_10px_rgba(0,240,255,0.2)]'
                  : 'bg-[#0B0E14] border-white/10 text-slate-400 hover:text-white'
              }`}
              title={showMinimap ? 'Hide Territory Minimap' : 'Show Territory Minimap'}
              aria-label="Toggle Territory Minimap"
            >
              <MapIcon className="w-3.5 h-3.5" />
            </button>

            <button
              type="button"
              onClick={() => setShowLayoutSliders((prev) => !prev)}
              className={`p-1.5 rounded-lg border text-xs transition cursor-pointer ${
                showLayoutSliders
                  ? 'bg-emerald-950/80 border-emerald-500/40 text-emerald-300 shadow-[0_0_10px_rgba(16,185,129,0.2)]'
                  : 'bg-[#0B0E14] border-white/10 text-slate-400 hover:text-white'
              }`}
              title="Layout Physics & Distance Sliders"
              aria-label="Toggle Layout Controls"
            >
              <Sliders className="w-3.5 h-3.5" />
            </button>

            <button
              type="button"
              onClick={() => setIsHudExpanded((prev) => !prev)}
              className="p-1.5 rounded-lg bg-[#0B0E14] border border-white/10 text-slate-400 hover:text-white transition cursor-pointer"
              title={isHudExpanded ? 'Collapse HUD' : 'Expand HUD'}
              aria-label={isHudExpanded ? 'Collapse HUD' : 'Expand HUD'}
            >
              {isHudExpanded ? <ChevronUp className="w-3.5 h-3.5" /> : <ChevronDown className="w-3.5 h-3.5" />}
            </button>
          </div>
        </div>

        {/* Collapsible Content */}
        {isHudExpanded && (
          <div className="p-3 space-y-3">
            {/* Search & Auto-Pan Bar */}
            <div className="relative w-full">
              <Search className="w-3.5 h-3.5 text-cyan-400 absolute left-3 top-2.5" />
              <input
                type="text"
                value={searchQuery}
                onChange={(e) => onSearchChange(e.target.value)}
                placeholder="Instant filter & auto-pan..."
                className="w-full rounded-xl pl-8 pr-16 py-1.5 text-xs text-white placeholder-slate-500 bg-[#121824]/90 border border-white/10 focus:outline-none focus:ring-1 focus:ring-cyan-400 focus:border-cyan-500/50 transition-all"
              />

              {searchQuery && (
                <div className="absolute right-2 top-1.5 flex items-center gap-1">
                  <button
                    type="button"
                    onClick={handlePrevMatch}
                    disabled={matchingNodes.length === 0}
                    className="p-1 rounded text-slate-400 hover:text-white disabled:opacity-30 cursor-pointer"
                    title="Previous match"
                    aria-label="Previous search match"
                  >
                    <ChevronLeft className="w-3 h-3" />
                  </button>
                  <button
                    type="button"
                    onClick={handleNextMatch}
                    disabled={matchingNodes.length === 0}
                    className="p-1 rounded text-slate-400 hover:text-white disabled:opacity-30 cursor-pointer"
                    title="Next match"
                    aria-label="Next search match"
                  >
                    <ChevronRight className="w-3 h-3" />
                  </button>
                  <button
                    type="button"
                    onClick={() => onSearchChange('')}
                    className="p-1 rounded text-slate-400 hover:text-rose-400 cursor-pointer"
                    title="Clear search"
                    aria-label="Clear search input"
                  >
                    <X className="w-3 h-3" />
                  </button>
                </div>
              )}
            </div>

            {searchQuery && (
              <div className="flex items-center justify-between px-1 text-[11px] font-mono">
                <span className="text-emerald-400 font-medium">
                  {searchMatchCount} match{searchMatchCount === 1 ? '' : 'es'} found
                  {matchingNodes.length > 0 && ` (${currentMatchIndex + 1}/${matchingNodes.length})`}
                </span>
                <button
                  type="button"
                  onClick={() => {
                    if (matchingNodes[0]) {
                      onSelectNode(matchingNodes[0]);
                      onPanToWorld(matchingNodes[0].x, matchingNodes[0].y);
                    }
                  }}
                  className="text-cyan-300 hover:text-cyan-200 underline cursor-pointer"
                >
                  Focus Top Match
                </button>
              </div>
            )}

            {/* Layout Physics & Distance Sliders */}
            {showLayoutSliders && (
              <div className="p-2.5 rounded-xl bg-[#121824]/90 border border-white/10 space-y-2.5 font-mono text-[11px] text-slate-300 animate-in fade-in duration-200">
                <div className="flex items-center justify-between pb-1 border-b border-white/10">
                  <span className="text-emerald-300 font-semibold flex items-center gap-1.5">
                    <Sliders className="w-3 h-3" />
                    Layout Physics
                  </span>
                  <button
                    type="button"
                    onClick={onOpenResetLayoutModal}
                    className="text-[10px] text-slate-400 hover:text-cyan-300 flex items-center gap-1 transition cursor-pointer"
                    title="Reset layout physics to default"
                  >
                    <RotateCcw className="w-2.5 h-2.5" />
                    Reset
                  </button>
                </div>

                {/* Force Strength Slider */}
                <div className="space-y-1">
                  <div className="flex justify-between text-[10px]">
                    <span className="text-slate-400">Force Strength</span>
                    <span className="text-cyan-300 font-bold">
                      {(layoutOptions.forceStrength ?? 1.0).toFixed(1)}x
                    </span>
                  </div>
                  <input
                    type="range"
                    min="0.5"
                    max="2.0"
                    step="0.1"
                    value={layoutOptions.forceStrength ?? 1.0}
                    onChange={(e) =>
                      onLayoutOptionsChange({
                        ...layoutOptions,
                        forceStrength: parseFloat(e.target.value)
                      })
                    }
                    className="w-full h-1.5 rounded-lg bg-slate-800 accent-cyan-400 cursor-pointer"
                    aria-label="Force Strength slider"
                  />
                </div>

                {/* Link Distance Slider */}
                <div className="space-y-1">
                  <div className="flex justify-between text-[10px]">
                    <span className="text-slate-400">Link Distance</span>
                    <span className="text-emerald-300 font-bold">
                      {Math.round((layoutOptions.linkDistance ?? 1.0) * 100)}%
                    </span>
                  </div>
                  <input
                    type="range"
                    min="0.5"
                    max="2.0"
                    step="0.05"
                    value={layoutOptions.linkDistance ?? 1.0}
                    onChange={(e) =>
                      onLayoutOptionsChange({
                        ...layoutOptions,
                        linkDistance: parseFloat(e.target.value)
                      })
                    }
                    className="w-full h-1.5 rounded-lg bg-slate-800 accent-emerald-400 cursor-pointer"
                    aria-label="Link Distance slider"
                  />
                </div>

                {/* Collision Radius Slider */}
                <div className="space-y-1">
                  <div className="flex justify-between text-[10px]">
                    <span className="text-slate-400">Collision Radius</span>
                    <span className="text-purple-300 font-bold">
                      {Math.round(layoutOptions.collisionRadius ?? 28)}px
                    </span>
                  </div>
                  <input
                    type="range"
                    min="10"
                    max="60"
                    step="2"
                    value={layoutOptions.collisionRadius ?? 28}
                    onChange={(e) =>
                      onLayoutOptionsChange({
                        ...layoutOptions,
                        collisionRadius: parseFloat(e.target.value)
                      })
                    }
                    className="w-full h-1.5 rounded-lg bg-slate-800 accent-purple-400 cursor-pointer"
                    aria-label="Collision Radius slider"
                  />
                </div>
              </div>
            )}

            {/* Quick Navigation Toolbar */}
            <div className="flex items-center justify-between gap-1 pt-1 border-t border-white/10 text-slate-300">
              <div className="flex items-center gap-1">
                <button
                  type="button"
                  onClick={onZoomIn}
                  className="p-1.5 rounded-lg bg-[#121824] hover:bg-slate-800 border border-white/10 text-cyan-300 hover:text-white transition active:scale-95 cursor-pointer"
                  title="Zoom In (+)"
                  aria-label="Zoom in"
                >
                  <ZoomIn className="w-3.5 h-3.5" />
                </button>
                <button
                  type="button"
                  onClick={onZoomOut}
                  className="p-1.5 rounded-lg bg-[#121824] hover:bg-slate-800 border border-white/10 text-cyan-300 hover:text-white transition active:scale-95 cursor-pointer"
                  title="Zoom Out (-)"
                  aria-label="Zoom out"
                >
                  <ZoomOut className="w-3.5 h-3.5" />
                </button>
                <button
                  type="button"
                  onClick={onResetView}
                  className="px-2 py-1.5 rounded-lg bg-[#121824] hover:bg-slate-800 border border-white/10 text-cyan-300 hover:text-white transition active:scale-95 text-xs font-mono flex items-center gap-1 cursor-pointer"
                  title="Center & Fit Viewport (Home)"
                  aria-label="Center viewport"
                >
                  <Compass className="w-3.5 h-3.5" />
                  <span>Fit</span>
                </button>
              </div>

              <button
                type="button"
                onClick={onToggleFullscreen}
                className="p-1.5 rounded-lg bg-[#121824] hover:bg-slate-800 border border-white/10 text-purple-300 hover:text-white transition active:scale-95 cursor-pointer"
                title={isFullscreen ? 'Exit Fullscreen' : 'Enter Fullscreen'}
                aria-label="Toggle Fullscreen"
              >
                {isFullscreen ? <Minimize2 className="w-3.5 h-3.5" /> : <Maximize2 className="w-3.5 h-3.5" />}
              </button>
            </div>
          </div>
        )}
      </div>

      {/* Territory Minimap Preview Box */}
      {showMinimap && (
        <CosmicMinimap
          nodes={nodes}
          viewport={viewport}
          canvasWidth={canvasWidth}
          canvasHeight={canvasHeight}
          onPanToWorld={onPanToWorld}
        />
      )}
    </div>
  );
};
