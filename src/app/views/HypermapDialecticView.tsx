import React, { useState, useEffect, useRef, useMemo, useCallback } from 'react';
import * as d3 from 'd3';
import {
  Network,
  GitBranch,
  Layers,
  ZoomIn,
  ZoomOut,
  Maximize2,
  Minimize2,
  Search,
  Filter,
  Plus,
  Trash2,
  Edit3,
  Zap,
  RefreshCw,
  Download,
  AlertTriangle,
  CheckCircle2,
  BookOpen,
  ChevronRight,
  ChevronDown,
  Info,
  Scale,
  X,
  ExternalLink,
  Sliders,
  Flame,
  Sparkles
} from 'lucide-react';
import { GroundedEpistemicTopology } from './GroundedEpistemicTopology';
import { api } from '../api';
import type {
  HypermapNode,
  HypermapTreeNode,
  HypermapNodeInput,
  HypermapStats,
  WarrantCategory,
  HypermapNodeType
} from '../types';

interface HypermapDialecticViewProps {
  onTriggerResearchLoop?: (focusArea: string) => void;
}

export const HypermapDialecticView: React.FC<HypermapDialecticViewProps> = ({
  onTriggerResearchLoop
}) => {
  // Tree & Hierarchy State
  const [treeData, setTreeData] = useState<HypermapTreeNode | null>(null);
  const [stats, setStats] = useState<HypermapStats | null>(null);
  const [loading, setLoading] = useState<boolean>(true);
  const [error, setError] = useState<string | null>(null);
  const [rootFilter, setRootFilter] = useState<'all' | 'tree_journal314_phenomenology' | 'tree_pec_omega_dialectic'>('all');
  const [visualEngine, setVisualEngine] = useState<'grounded_topology' | 'd3_matrix'>('grounded_topology');

  // Interactive Selection & Drawer
  const [selectedNode, setSelectedNode] = useState<HypermapTreeNode | null>(null);
  const [drawerOpen, setDrawerOpen] = useState<boolean>(false);

  // Search & Filter
  const [searchQuery, setSearchQuery] = useState<string>('');
  const [typeFilter, setTypeFilter] = useState<string>('all');
  const [warrantFilter, setWarrantFilter] = useState<string>('all');

  // Modals & Action States
  const [showAddModal, setShowAddModal] = useState<boolean>(false);
  const [showEditModal, setShowEditModal] = useState<boolean>(false);
  const [densifying, setDensifying] = useState<boolean>(false);
  const [densifySuccessMsg, setDensifySuccessMsg] = useState<string | null>(null);
  const [densifyStrategy, setDensifyStrategy] = useState<string>('Paraconsistent LP Antinomy & Adversarial Defeater');

  // Node Input Form State
  const [formData, setFormData] = useState<{
    title: string;
    node_type: HypermapNodeType;
    warrant_category: WarrantCategory;
    payload_text: string;
    epistemic_status: 'directly_attested' | 'strongly_supported' | 'supported' | 'plausible' | 'underdetermined' | 'disputed';
    paradox_relation: string;
  }>({
    title: '',
    node_type: 'claim',
    warrant_category: 'W2',
    payload_text: '',
    epistemic_status: 'supported',
    paradox_relation: ''
  });

  // SVG and Zoom Container References
  const svgRef = useRef<SVGSVGElement | null>(null);
  const gRef = useRef<SVGGElement | null>(null);
  const zoomBehaviorRef = useRef<d3.ZoomBehavior<SVGSVGElement, unknown> | null>(null);

  // Load Tree Data and Stats
  const loadHypermap = useCallback(async (root?: string) => {
    try {
      setLoading(true);
      setError(null);
      const [tree, st] = await Promise.all([
        api.getHypermapTree(root === 'all' ? undefined : root),
        api.getHypermapStats()
      ]);
      setTreeData(tree);
      setStats(st);
    } catch (err: any) {
      console.error('Failed to load hypermap tree:', err);
      setError(err.message || 'Failed to initialize Hypermap Matrix');
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    loadHypermap(rootFilter);
  }, [rootFilter, loadHypermap]);

  // Node Color Mapper
  const getNodeColor = (type: string, warrant?: string) => {
    if (type === 'cosmos') return '#f59e0b'; // amber-500
    if (type === 'root') return '#d97706'; // amber-600
    if (type === 'domain') return '#eab308'; // yellow-500
    if (type === 'category') return '#8b5cf6'; // purple-500
    if (type === 'paradox') return '#f43f5e'; // rose-500
    if (type === 'objection') return '#f97316'; // orange-500
    if (type === 'revision') return '#a855f7'; // violet-500
    if (type === 'insight') return '#06b6d4'; // cyan-500
    if (warrant === 'W0') return '#94a3b8'; // slate-400
    if (warrant === 'W1') return '#38bdf8'; // sky-400
    if (warrant === 'W2') return '#34d399'; // emerald-400
    if (warrant === 'W3') return '#fbbf24'; // amber-400
    if (warrant === 'W4') return '#f87171'; // red-400
    if (warrant === 'W5') return '#e11d48'; // rose-600
    return '#10b981'; // emerald-500
  };

  // Node Type Label
  const formatNodeType = (type: string) => {
    switch (type) {
      case 'cosmos': return 'Cosmic Nexus';
      case 'root': return 'Root Tree';
      case 'domain': return 'Canonical Domain';
      case 'category': return 'Corpus Category';
      case 'claim': return 'Attributed Claim';
      case 'paradox': return 'LP Antinomy (Dialetheia)';
      case 'objection': return 'Adversarial Defeater';
      case 'revision': return 'Mandatory Revision';
      case 'insight': return 'Phenomenological Insight';
      default: return type.toUpperCase();
    }
  };

  // D3 Hierarchical Rendering Engine
  useEffect(() => {
    if (!treeData || !svgRef.current) return;

    const svg = d3.select(svgRef.current);
    svg.selectAll('*').remove();

    const width = svgRef.current.clientWidth || 1200;
    const height = svgRef.current.clientHeight || 750;

    // Outer Main Group
    const g = svg.append('g').attr('class', 'hypermap-content-group');
    gRef.current = g.node();

    // Setup D3 Zoom with boundary limits
    const zoom = d3.zoom<SVGSVGElement, unknown>()
      .scaleExtent([0.15, 3.5])
      .on('zoom', (event) => {
        g.attr('transform', event.transform);
      });

    svg.call(zoom);
    zoomBehaviorRef.current = zoom;

    // D3 Hierarchy Conversion
    // Clone tree data to allow mutable _collapsed toggles
    const hierarchyData = d3.hierarchy<HypermapTreeNode>(treeData, (d) => {
      if (d._collapsed) return null;
      return d.children;
    });

    // Compute tree layout
    // Dynamic node size based on depth and density
    const dx = 42;
    const dy = 260;
    const treeLayout = d3.tree<HypermapTreeNode>().nodeSize([dx, dy]);
    treeLayout(hierarchyData);

    // Compute bounding box to set initial zoom & center
    let x0 = Infinity;
    let x1 = -x0;
    let y0 = Infinity;
    let y1 = -y0;

    hierarchyData.each((d: any) => {
      if (d.x > x1) x1 = d.x;
      if (d.x < x0) x0 = d.x;
      if (d.y > y1) y1 = d.y;
      if (d.y < y0) y0 = d.y;
    });

    // Initial transform: center root on the left
    const initialTransform = d3.zoomIdentity
      .translate(80, height / 2 - (x0 + x1) / 2)
      .scale(0.85);

    svg.call(zoom.transform, initialTransform);

    // Filter matching predicate
    const matchesSearch = (d: any) => {
      if (!searchQuery.trim()) return false;
      const q = searchQuery.toLowerCase();
      return (
        d.data.title.toLowerCase().includes(q) ||
        d.data.payload_text.toLowerCase().includes(q) ||
        (d.data.warrant_category && d.data.warrant_category.toLowerCase().includes(q)) ||
        (d.data.paradox_relation && d.data.paradox_relation.toLowerCase().includes(q))
      );
    };

    const matchesFilter = (d: any) => {
      if (typeFilter !== 'all' && d.data.node_type !== typeFilter) return false;
      if (warrantFilter !== 'all' && d.data.warrant_category !== warrantFilter) return false;
      return true;
    };

    // Render Links
    const linkGenerator = d3.linkHorizontal<any, any>()
      .x((d) => d.y)
      .y((d) => d.x);

    g.append('g')
      .attr('class', 'links')
      .selectAll('path')
      .data(hierarchyData.links())
      .join('path')
      .attr('d', linkGenerator as any)
      .attr('fill', 'none')
      .attr('stroke', (d: any) => {
        if (d.target.data.node_type === 'paradox') return '#f43f5e88';
        if (d.target.data.node_type === 'objection') return '#f9731688';
        return '#3f3f46'; // zinc-700
      })
      .attr('stroke-width', (d: any) => {
        if (d.target.data.node_type === 'paradox') return 2;
        if (d.source.depth === 0) return 2.5;
        return 1.25;
      })
      .attr('stroke-dasharray', (d: any) => {
        if (d.target.data.node_type === 'paradox') return '4,3';
        if (d.target.data.node_type === 'objection') return '3,2';
        return 'none';
      });

    // Render Nodes
    const node = g.append('g')
      .attr('class', 'nodes')
      .selectAll('g')
      .data(hierarchyData.descendants())
      .join('g')
      .attr('transform', (d: any) => `translate(${d.y},${d.x})`)
      .attr('cursor', 'pointer')
      .on('click', (event, d: any) => {
        event.stopPropagation();
        setSelectedNode(d.data);
        setDrawerOpen(true);
      })
      .on('dblclick', (event, d: any) => {
        event.stopPropagation();
        // Toggle collapse state
        d.data._collapsed = !d.data._collapsed;
        setTreeData({ ...treeData });
      });

    // Node Outer Glow for Paradox or Search Match
    node.each(function (d: any) {
      const el = d3.select(this);
      const isSearchMatch = matchesSearch(d);
      const isParadox = d.data.node_type === 'paradox';
      const isSelected = selectedNode?.id === d.data.id;

      if (isSearchMatch || isParadox || isSelected) {
        el.append('circle')
          .attr('r', isSelected ? 18 : isSearchMatch ? 16 : 14)
          .attr('fill', 'none')
          .attr('stroke', isSelected ? '#38bdf8' : isSearchMatch ? '#fbbf24' : '#f43f5e')
          .attr('stroke-width', 2)
          .attr('opacity', 0.8)
          .attr('class', 'animate-pulse');
      }
    });

    // Node Main Circle
    node.append('circle')
      .attr('r', (d: any) => {
        if (d.depth === 0) return 12;
        if (d.depth === 1) return 9;
        if (d.data.node_type === 'paradox') return 8;
        if (d.data.node_type === 'objection') return 7;
        return 6;
      })
      .attr('fill', (d: any) => getNodeColor(d.data.node_type, d.data.warrant_category))
      .attr('stroke', (d: any) => d.data._collapsed ? '#ffffff' : '#18181b')
      .attr('stroke-width', (d: any) => d.data._collapsed ? 2.5 : 1.5);

    // Indicator inside collapsed nodes with hidden children
    node.filter((d: any) => Boolean(d.data.children && d.data.children.length > 0 && d.data._collapsed))
      .append('text')
      .attr('text-anchor', 'middle')
      .attr('dy', '0.3em')
      .attr('fill', '#ffffff')
      .attr('font-size', '9px')
      .attr('font-weight', 'bold')
      .text('+');

    // Warrant Category Pill Badge (if present)
    node.filter((d: any) => Boolean(d.data.warrant_category))
      .append('rect')
      .attr('x', (d: any) => d.children ? -42 : 14)
      .attr('y', -14)
      .attr('width', 24)
      .attr('height', 12)
      .attr('rx', 3)
      .attr('fill', '#18181b')
      .attr('stroke', (d: any) => getNodeColor(d.data.node_type, d.data.warrant_category))
      .attr('stroke-width', 1);

    node.filter((d: any) => Boolean(d.data.warrant_category))
      .append('text')
      .attr('x', (d: any) => d.children ? -30 : 26)
      .attr('y', -5)
      .attr('text-anchor', 'middle')
      .attr('font-size', '8px')
      .attr('font-family', 'monospace')
      .attr('font-weight', 'bold')
      .attr('fill', (d: any) => getNodeColor(d.data.node_type, d.data.warrant_category))
      .text((d: any) => d.data.warrant_category);

    // Node Title Label
    node.append('text')
      .attr('dy', '0.32em')
      .attr('x', (d: any) => (d.children && !d.data._collapsed ? -12 : 12))
      .attr('text-anchor', (d: any) => (d.children && !d.data._collapsed ? 'end' : 'start'))
      .attr('font-size', (d: any) => {
        if (d.depth === 0) return '13px';
        if (d.depth === 1) return '11.5px';
        return '10.5px';
      })
      .attr('font-family', (d: any) => d.depth <= 1 ? 'Georgia, serif' : 'system-ui, sans-serif')
      .attr('font-weight', (d: any) => d.depth <= 1 ? '600' : '400')
      .attr('fill', (d: any) => {
        if (matchesSearch(d)) return '#fbbf24';
        if (!matchesFilter(d)) return '#52525b';
        if (d.data.node_type === 'paradox') return '#fda4af';
        if (d.data.node_type === 'objection') return '#fdba74';
        return '#f4f4f5'; // zinc-100
      })
      .text((d: any) => {
        const title = d.data.title;
        return title.length > 42 ? title.slice(0, 40) + '…' : title;
      });

  }, [treeData, searchQuery, typeFilter, warrantFilter, selectedNode]);

  // Zoom Controls Handlers
  const handleZoomIn = () => {
    if (svgRef.current && zoomBehaviorRef.current) {
      d3.select(svgRef.current).transition().duration(250).call(zoomBehaviorRef.current.scaleBy, 1.3);
    }
  };

  const handleZoomOut = () => {
    if (svgRef.current && zoomBehaviorRef.current) {
      d3.select(svgRef.current).transition().duration(250).call(zoomBehaviorRef.current.scaleBy, 0.75);
    }
  };

  const handleResetZoom = () => {
    if (svgRef.current && zoomBehaviorRef.current) {
      const height = svgRef.current.clientHeight || 750;
      const transform = d3.zoomIdentity.translate(80, height / 2 - 100).scale(0.85);
      d3.select(svgRef.current).transition().duration(400).call(zoomBehaviorRef.current.transform, transform);
    }
  };

  // Expand / Collapse Helpers
  const setAllCollapsed = (node: HypermapTreeNode, collapsed: boolean, maxDepth?: number, currentDepth: number = 0) => {
    if (maxDepth !== undefined) {
      node._collapsed = currentDepth >= maxDepth;
    } else {
      node._collapsed = collapsed;
    }
    if (node.children) {
      for (const c of node.children) {
        setAllCollapsed(c, collapsed, maxDepth, currentDepth + 1);
      }
    }
  };

  const handleExpandAll = () => {
    if (!treeData) return;
    const cloned = JSON.parse(JSON.stringify(treeData));
    setAllCollapsed(cloned, false);
    setTreeData(cloned);
  };

  const handleCollapseToDepth = (depth: number) => {
    if (!treeData) return;
    const cloned = JSON.parse(JSON.stringify(treeData));
    setAllCollapsed(cloned, false, depth);
    setTreeData(cloned);
  };

  // Dialectical Densification Trigger
  const handleDensifyNode = async () => {
    if (!selectedNode) return;
    try {
      setDensifying(true);
      setDensifySuccessMsg(null);
      const res = await api.densifyHypermapNode(selectedNode.id, densifyStrategy);
      setDensifySuccessMsg(`Successfully synthesized ${res.newNodes.length} dialectical branches. Corpus Matrix now at ${res.totalTreeNodes} nodes.`);
      await loadHypermap(rootFilter);
      // Update selected node
      const updated = await api.getHypermapNode(selectedNode.id);
      setSelectedNode({ ...updated, children: selectedNode.children });
    } catch (err: any) {
      alert(`Densification failed: ${err.message}`);
    } finally {
      setDensifying(false);
    }
  };

  // Add Child Node Submission
  const handleAddChildNode = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!selectedNode) return;
    try {
      const payload: HypermapNodeInput = {
        parent_id: selectedNode.id,
        root_tree_id: selectedNode.root_tree_id,
        title: formData.title,
        node_type: formData.node_type,
        warrant_category: formData.warrant_category,
        payload_text: formData.payload_text,
        epistemic_status: formData.epistemic_status,
        paradox_relation: formData.paradox_relation || undefined
      };
      await api.addHypermapNode(payload);
      setShowAddModal(false);
      setFormData({
        title: '',
        node_type: 'claim',
        warrant_category: 'W2',
        payload_text: '',
        epistemic_status: 'supported',
        paradox_relation: ''
      });
      await loadHypermap(rootFilter);
    } catch (err: any) {
      alert(`Failed to add node: ${err.message}`);
    }
  };

  // Edit Node Submission
  const handleEditNode = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!selectedNode) return;
    try {
      const updated = await api.updateHypermapNode(selectedNode.id, {
        title: formData.title,
        warrant_category: formData.warrant_category,
        payload_text: formData.payload_text,
        epistemic_status: formData.epistemic_status,
        paradox_relation: formData.paradox_relation
      });
      setShowEditModal(false);
      setSelectedNode({ ...selectedNode, ...updated });
      await loadHypermap(rootFilter);
    } catch (err: any) {
      alert(`Failed to update node: ${err.message}`);
    }
  };

  // Delete Node Submission
  const handleDeleteNode = async () => {
    if (!selectedNode) return;
    if (selectedNode.node_type === 'root' || selectedNode.node_type === 'cosmos') {
      alert('Cannot delete primary root tree.');
      return;
    }
    const conf = window.confirm(`Are you sure you want to delete "${selectedNode.title}" and all its sub-branches from SQLite?`);
    if (!conf) return;

    try {
      const res = await api.deleteHypermapNode(selectedNode.id);
      alert(`Cascade deleted ${res.deletedCount} nodes.`);
      setDrawerOpen(false);
      setSelectedNode(null);
      await loadHypermap(rootFilter);
    } catch (err: any) {
      alert(`Failed to delete: ${err.message}`);
    }
  };

  // Export Hypermap as JSON
  const handleExportJSON = () => {
    if (!treeData) return;
    const dataStr = 'data:text/json;charset=utf-8,' + encodeURIComponent(JSON.stringify(treeData, null, 2));
    const dlAnchor = document.createElement('a');
    dlAnchor.setAttribute('href', dataStr);
    dlAnchor.setAttribute('download', `nihiltheism_hypermap_${rootFilter}_${Date.now()}.json`);
    dlAnchor.click();
  };

  return (
    <div className="space-y-6">
      {/* Top Header & Cosmic Statistics Ribbon */}
      <div className="bg-zinc-900/80 backdrop-blur-md border border-zinc-800 rounded-xl p-5 shadow-2xl relative overflow-hidden">
        <div className="absolute top-0 right-0 w-96 h-40 bg-gradient-to-l from-amber-500/10 via-rose-500/5 to-transparent pointer-events-none"></div>

        <div className="flex flex-col lg:flex-row lg:items-center lg:justify-between gap-4">
          <div>
            <div className="flex items-center space-x-2 text-xs font-mono text-amber-500 tracking-wider uppercase mb-1">
              <Network className="w-3.5 h-3.5" />
              <span>PEC-Ω Matrix Architecture</span>
              <span className="text-zinc-600">/</span>
              <span>1,808-Node Preserved Corpus Hypermap</span>
            </div>
            <h1 className="text-2xl sm:text-3xl font-serif font-bold text-zinc-100 flex items-center gap-3">
              Dynamic Epistemic Hypermap
              <span className="text-xs px-2.5 py-0.5 rounded-full bg-amber-500/20 text-amber-300 border border-amber-500/30 font-sans font-normal">
                Bidirectional Dialectic
              </span>
            </h1>
            <p className="text-xs text-zinc-400 mt-1 max-w-3xl">
              Unified hierarchical visualization spanning <strong className="text-zinc-200">Tree 1 (Journal314 Systematic Phenomenology)</strong> and <strong className="text-zinc-200">Tree 2 (PEC-Ω Paraconsistent Dialectic)</strong>. Full CRUD, Graham Priest LP true contradictions, and real-time state synchronization into SQLite.
            </p>
          </div>

          {/* Root Tree Switcher & Visual Engine Mode Toggle */}
          <div className="flex flex-wrap items-center gap-2.5">
            {/* Visual Engine Mode Switcher */}
            <div className="flex items-center rounded-xl p-1 bg-zinc-950 border border-cyan-500/40 shadow-[0_0_15px_rgba(0,240,255,0.15)]">
              <button
                onClick={() => setVisualEngine('grounded_topology')}
                className={`px-3 py-1.5 rounded-lg text-xs font-semibold transition-all duration-200 flex items-center gap-1.5 ${
                  visualEngine === 'grounded_topology'
                    ? 'bg-cyan-500 text-zinc-950 shadow-[0_0_12px_rgba(0,240,255,0.6)] font-bold'
                    : 'text-cyan-300 hover:text-white'
                }`}
                title="Luminous Cosmic Void Epistemic Topology with 3D Torus Vortex"
              >
                <Sparkles className="w-3.5 h-3.5" />
                <span>Grounded Topology</span>
              </button>
              <button
                onClick={() => setVisualEngine('d3_matrix')}
                className={`px-3 py-1.5 rounded-lg text-xs font-semibold transition-all duration-200 flex items-center gap-1.5 ${
                  visualEngine === 'd3_matrix'
                    ? 'bg-amber-500 text-zinc-950 font-bold shadow-lg shadow-amber-500/30'
                    : 'text-zinc-400 hover:text-zinc-200'
                }`}
                title="D3 Paraconsistent Hierarchical Tree Matrix"
              >
                <Network className="w-3.5 h-3.5" />
                <span>D3 Tree Matrix</span>
              </button>
            </div>

            <div className="h-6 w-px bg-zinc-800 hidden sm:block"></div>

            <button
              onClick={() => setRootFilter('all')}
              className={`px-3 py-1.5 rounded-lg text-xs font-medium transition flex items-center gap-1.5 ${
                rootFilter === 'all'
                  ? 'bg-amber-600 text-zinc-950 font-bold shadow-lg shadow-amber-600/20'
                  : 'bg-zinc-800 text-zinc-300 hover:bg-zinc-700'
              }`}
            >
              <Layers className="w-3.5 h-3.5" />
              <span>Cosmos (Unified 1,808)</span>
            </button>
            <button
              onClick={() => setRootFilter('tree_journal314_phenomenology')}
              className={`px-3 py-1.5 rounded-lg text-xs font-medium transition flex items-center gap-1.5 ${
                rootFilter === 'tree_journal314_phenomenology'
                  ? 'bg-amber-600 text-zinc-950 font-bold shadow-lg shadow-amber-600/20'
                  : 'bg-zinc-800 text-zinc-300 hover:bg-zinc-700'
              }`}
            >
              <GitBranch className="w-3.5 h-3.5" />
              <span>Tree 1: Journal314 Ω</span>
            </button>
            <button
              onClick={() => setRootFilter('tree_pec_omega_dialectic')}
              className={`px-3 py-1.5 rounded-lg text-xs font-medium transition flex items-center gap-1.5 ${
                rootFilter === 'tree_pec_omega_dialectic'
                  ? 'bg-amber-600 text-zinc-950 font-bold shadow-lg shadow-amber-600/20'
                  : 'bg-zinc-800 text-zinc-300 hover:bg-zinc-700'
              }`}
            >
              <Scale className="w-3.5 h-3.5" />
              <span>Tree 2: PEC-Ω Antinomy</span>
            </button>
            <button
              onClick={() => loadHypermap(rootFilter)}
              className="p-1.5 rounded-lg bg-zinc-800 hover:bg-zinc-700 text-zinc-400 hover:text-zinc-200 transition"
              title="Refresh Tree"
            >
              <RefreshCw className={`w-4 h-4 ${loading ? 'animate-spin text-amber-500' : ''}`} />
            </button>
          </div>
        </div>

        {/* Live Metrics Grid */}
        {stats && (
          <div className="grid grid-cols-2 sm:grid-cols-4 lg:grid-cols-6 gap-3 mt-4 pt-4 border-t border-zinc-800/80 font-mono text-xs">
            <div className="bg-zinc-950/60 p-2.5 rounded-lg border border-zinc-800">
              <span className="text-zinc-500 block text-[10px] uppercase">Total Active Nodes</span>
              <span className="text-lg font-bold text-amber-400">{stats.totalNodes.toLocaleString()}</span>
            </div>
            <div className="bg-zinc-950/60 p-2.5 rounded-lg border border-zinc-800">
              <span className="text-zinc-500 block text-[10px] uppercase">Tree 1 (Phenomenology)</span>
              <span className="text-lg font-bold text-zinc-200">{stats.tree1Nodes.toLocaleString()}</span>
            </div>
            <div className="bg-zinc-950/60 p-2.5 rounded-lg border border-zinc-800">
              <span className="text-zinc-500 block text-[10px] uppercase">Tree 2 (PEC-Ω Matrix)</span>
              <span className="text-lg font-bold text-zinc-200">{stats.tree2Nodes.toLocaleString()}</span>
            </div>
            <div className="bg-zinc-950/60 p-2.5 rounded-lg border border-zinc-800">
              <span className="text-zinc-500 block text-[10px] uppercase">LP Antinomies {`{0, 1}`}</span>
              <span className="text-lg font-bold text-rose-400">{stats.byType['paradox'] || 0}</span>
            </div>
            <div className="bg-zinc-950/60 p-2.5 rounded-lg border border-zinc-800">
              <span className="text-zinc-500 block text-[10px] uppercase">Adversarial Defeaters</span>
              <span className="text-lg font-bold text-orange-400">{stats.byType['objection'] || 0}</span>
            </div>
            <div className="bg-zinc-950/60 p-2.5 rounded-lg border border-zinc-800">
              <span className="text-zinc-500 block text-[10px] uppercase">W0–W4 Warrants</span>
              <div className="flex items-center gap-1 text-[11px] font-bold mt-1">
                <span className="text-emerald-400" title="W2 Supported">W2:{stats.byWarrant['W2'] || 0}</span>
                <span className="text-amber-400" title="W3 Phenomenological Recurrence">W3:{stats.byWarrant['W3'] || 0}</span>
                <span className="text-rose-400" title="W4 Retained Disagreement">W4:{stats.byWarrant['W4'] || 0}</span>
              </div>
            </div>
          </div>
        )}
      </div>

      {/* Visual Engine Body: Grounded Epistemic Topology or D3 Tree Matrix */}
      {visualEngine === 'grounded_topology' ? (
        <div className="space-y-4">
          <GroundedEpistemicTopology
            canonicalTreeData={treeData}
            stats={stats}
            onSelectCanonicalNode={(cNode) => {
              setSelectedNode(cNode);
              setDrawerOpen(true);
            }}
            onTriggerResearchLoop={onTriggerResearchLoop}
          />
        </div>
      ) : (
        <>
          {/* Control Toolbar: Search, Filters, Depth Expand, & Zoom */}
          <div className="bg-zinc-900/70 border border-zinc-800 rounded-xl p-3 flex flex-wrap items-center justify-between gap-3 text-xs">
        {/* Search Bar */}
        <div className="flex items-center gap-2 flex-1 min-w-[240px]">
          <div className="relative flex-1">
            <Search className="w-3.5 h-3.5 text-zinc-400 absolute left-3 top-2.5" />
            <input
              type="text"
              placeholder="Search 1,808 nodes by concept, paradox, warrant, or text..."
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              className="w-full bg-zinc-950 border border-zinc-800 rounded-lg pl-8 pr-8 py-1.5 text-zinc-200 placeholder-zinc-500 focus:outline-none focus:border-amber-500"
            />
            {searchQuery && (
              <button
                onClick={() => setSearchQuery('')}
                className="absolute right-2.5 top-2.5 text-zinc-500 hover:text-zinc-300"
              >
                <X className="w-3.5 h-3.5" />
              </button>
            )}
          </div>

          {/* Type Filter */}
          <div className="flex items-center gap-1.5">
            <Filter className="w-3.5 h-3.5 text-zinc-500" />
            <select
              value={typeFilter}
              onChange={(e) => setTypeFilter(e.target.value)}
              className="bg-zinc-950 border border-zinc-800 rounded-lg px-2.5 py-1.5 text-zinc-300 focus:outline-none focus:border-amber-500"
            >
              <option value="all">All Types</option>
              <option value="domain">Domains</option>
              <option value="category">Categories</option>
              <option value="claim">Claims</option>
              <option value="paradox">LP Antinomies</option>
              <option value="objection">Objections</option>
              <option value="revision">Revisions</option>
              <option value="insight">Insights</option>
            </select>
          </div>

          {/* Warrant Filter */}
          <select
            value={warrantFilter}
            onChange={(e) => setWarrantFilter(e.target.value)}
            className="bg-zinc-950 border border-zinc-800 rounded-lg px-2.5 py-1.5 text-zinc-300 focus:outline-none focus:border-amber-500"
          >
            <option value="all">All Warrants</option>
            <option value="W0">W0: Raw Citation</option>
            <option value="W1">W1: First-Person Report</option>
            <option value="W2">W2: Attributed Corpus Premise</option>
            <option value="W3">W3: Phenomenological Recurrence</option>
            <option value="W4">W4: Retained Dialectical Disagreement</option>
            <option value="W5">W5: Banned Closure</option>
          </select>
        </div>

        {/* Depth Expansion & Zoom Controls */}
        <div className="flex items-center gap-2">
          {/* Depth Buttons */}
          <div className="flex items-center border border-zinc-800 rounded-lg overflow-hidden bg-zinc-950">
            <span className="px-2 py-1 text-[11px] text-zinc-500 font-mono">Depth:</span>
            <button
              onClick={() => handleCollapseToDepth(1)}
              className="px-2 py-1 hover:bg-zinc-800 text-zinc-400 hover:text-zinc-200 border-l border-zinc-800"
              title="Expand to Level 1 (Domains)"
            >
              1
            </button>
            <button
              onClick={() => handleCollapseToDepth(2)}
              className="px-2 py-1 hover:bg-zinc-800 text-zinc-400 hover:text-zinc-200 border-l border-zinc-800"
              title="Expand to Level 2 (Categories)"
            >
              2
            </button>
            <button
              onClick={() => handleCollapseToDepth(3)}
              className="px-2 py-1 hover:bg-zinc-800 text-zinc-400 hover:text-zinc-200 border-l border-zinc-800"
              title="Expand to Level 3 (Claims)"
            >
              3
            </button>
            <button
              onClick={handleExpandAll}
              className="px-2 py-1 hover:bg-zinc-800 text-amber-400 border-l border-zinc-800 font-medium"
              title="Expand All 1,808 Nodes"
            >
              All
            </button>
          </div>

          {/* Zoom Buttons */}
          <div className="flex items-center border border-zinc-800 rounded-lg overflow-hidden bg-zinc-950">
            <button
              onClick={handleZoomIn}
              className="p-1.5 hover:bg-zinc-800 text-zinc-400 hover:text-zinc-200"
              title="Zoom In"
            >
              <ZoomIn className="w-3.5 h-3.5" />
            </button>
            <button
              onClick={handleZoomOut}
              className="p-1.5 hover:bg-zinc-800 text-zinc-400 hover:text-zinc-200 border-l border-zinc-800"
              title="Zoom Out"
            >
              <ZoomOut className="w-3.5 h-3.5" />
            </button>
            <button
              onClick={handleResetZoom}
              className="p-1.5 hover:bg-zinc-800 text-zinc-400 hover:text-zinc-200 border-l border-zinc-800"
              title="Reset View"
            >
              <Maximize2 className="w-3.5 h-3.5" />
            </button>
          </div>

          {/* JSON Export */}
          <button
            onClick={handleExportJSON}
            className="px-2.5 py-1.5 rounded-lg bg-zinc-800 hover:bg-zinc-700 text-zinc-300 hover:text-zinc-100 flex items-center gap-1"
            title="Export Tree JSON"
          >
            <Download className="w-3.5 h-3.5" />
            <span>Export</span>
          </button>
        </div>
      </div>

      {/* Main Interactive Stage & Canvas */}
      <div className="relative bg-zinc-950 border border-zinc-800 rounded-xl overflow-hidden shadow-2xl h-[760px] flex">
        {/* Loading Overlay */}
        {loading && (
          <div className="absolute inset-0 z-30 bg-zinc-950/80 backdrop-blur-sm flex flex-col items-center justify-center space-y-3 text-amber-500 font-mono text-xs">
            <RefreshCw className="w-8 h-8 animate-spin" />
            <span>Compiling D3 Dialectic Matrix across 1,808 nodes...</span>
          </div>
        )}

        {/* Error Overlay */}
        {error && (
          <div className="absolute inset-0 z-30 bg-zinc-950/90 flex flex-col items-center justify-center space-y-4 text-rose-400 text-sm max-w-md mx-auto text-center px-4">
            <AlertTriangle className="w-10 h-10 text-rose-500" />
            <p className="font-semibold">{error}</p>
            <button
              onClick={() => loadHypermap(rootFilter)}
              className="px-4 py-2 rounded-lg bg-zinc-800 hover:bg-zinc-700 text-zinc-200 text-xs font-mono"
            >
              Retry Compilation
            </button>
          </div>
        )}

        {/* SVG Canvas for D3 Tree */}
        <div className="flex-1 h-full w-full relative">
          <svg
            ref={svgRef}
            className="w-full h-full select-none"
            style={{ backgroundColor: '#09090b' }}
          ></svg>

          {/* Canvas Help Watermark */}
          <div className="absolute bottom-3 left-3 bg-zinc-900/80 backdrop-blur-md border border-zinc-800/80 rounded-lg px-3 py-2 text-[11px] font-mono text-zinc-400 pointer-events-none flex items-center gap-3">
            <span>• Single click: Select & Inspect</span>
            <span>• Double click: Toggle Branch Collapse</span>
            <span>• Drag: Pan Canvas</span>
            <span>• Scroll: Zoom</span>
          </div>

          {/* Legend Overlay */}
          <div className="absolute top-3 right-3 bg-zinc-900/80 backdrop-blur-md border border-zinc-800 rounded-lg p-2.5 text-[11px] space-y-1.5 hidden md:block pointer-events-none">
            <div className="text-[10px] text-zinc-500 uppercase tracking-wider font-mono">Legend</div>
            <div className="flex items-center gap-2 text-zinc-300">
              <span className="w-2.5 h-2.5 rounded-full bg-yellow-500"></span>
              <span>Domain / Category</span>
            </div>
            <div className="flex items-center gap-2 text-zinc-300">
              <span className="w-2.5 h-2.5 rounded-full bg-emerald-400"></span>
              <span>Claim (W2/W3)</span>
            </div>
            <div className="flex items-center gap-2 text-zinc-300">
              <span className="w-2.5 h-2.5 rounded-full bg-rose-500 animate-pulse"></span>
              <span className="text-rose-300 font-semibold">LP Antinomy (Dialetheia)</span>
            </div>
            <div className="flex items-center gap-2 text-zinc-300">
              <span className="w-2.5 h-2.5 rounded-full bg-orange-500"></span>
              <span>Adversarial Defeater (W4)</span>
            </div>
          </div>
        </div>

        {/* Glassmorphic Slide-Out Node Inspector Drawer */}
        {drawerOpen && selectedNode && (
          <aside className="w-full sm:w-[440px] bg-zinc-900/95 backdrop-blur-xl border-l border-zinc-800 flex flex-col h-full z-20 shadow-2xl animate-in slide-in-from-right duration-200">
            {/* Drawer Header */}
            <div className="p-4 border-b border-zinc-800 flex items-start justify-between bg-zinc-950/40">
              <div>
                <div className="flex items-center gap-2 text-[10px] font-mono uppercase tracking-wider text-amber-500">
                  <span>{formatNodeType(selectedNode.node_type)}</span>
                  {selectedNode.warrant_category && (
                    <span className="px-1.5 py-0.5 rounded bg-zinc-800 text-zinc-300 border border-zinc-700">
                      {selectedNode.warrant_category}
                    </span>
                  )}
                  <span className="text-zinc-600">|</span>
                  <span className="text-zinc-400">{selectedNode.epistemic_status}</span>
                </div>
                <h2 className="text-base font-serif font-bold text-zinc-100 mt-1 leading-snug">
                  {selectedNode.title}
                </h2>
              </div>
              <button
                onClick={() => setDrawerOpen(false)}
                className="p-1 rounded-lg text-zinc-400 hover:text-zinc-200 hover:bg-zinc-800 transition"
              >
                <X className="w-4 h-4" />
              </button>
            </div>

            {/* Drawer Content */}
            <div className="flex-1 overflow-y-auto p-4 space-y-4 text-xs">
              {/* Densify Success Banner */}
              {densifySuccessMsg && (
                <div className="p-2.5 rounded-lg bg-emerald-950/50 border border-emerald-800/80 text-emerald-300 flex items-center gap-2">
                  <CheckCircle2 className="w-4 h-4 text-emerald-400 flex-shrink-0" />
                  <span>{densifySuccessMsg}</span>
                </div>
              )}

              {/* Payload Text / Philosophical Exegesis */}
              <div className="bg-zinc-950 p-3.5 rounded-lg border border-zinc-800 space-y-1.5">
                <span className="text-[10px] uppercase font-mono text-zinc-500 tracking-wider">Philosophical Payload & Exegesis</span>
                <p className="text-zinc-200 leading-relaxed font-sans text-xs whitespace-pre-wrap">
                  {selectedNode.payload_text || 'No explicit payload text recorded.'}
                </p>
              </div>

              {/* Paradox Relation Details (if LP Antinomy) */}
              {selectedNode.paradox_relation && (
                <div className="bg-rose-950/30 p-3.5 rounded-lg border border-rose-800/50 space-y-1.5">
                  <div className="flex items-center gap-1.5 text-rose-400 font-mono text-[10px] uppercase tracking-wider font-semibold">
                    <Flame className="w-3.5 h-3.5 text-rose-500" />
                    <span>Graham Priest Logic of Paradox (LP) Antinomy</span>
                  </div>
                  <p className="text-rose-200/90 text-xs leading-relaxed">
                    Evaluated as a true contradiction under Priestian dialetheism: designated valuation <strong className="font-mono text-rose-300">{`v(P) = {0, 1}`}</strong>.
                    Operates at the conceptual limit without explosive material implication.
                  </p>
                  <div className="text-[10px] text-zinc-400 font-mono mt-1">
                    Relation ID: <span className="text-zinc-300">{selectedNode.paradox_relation}</span>
                  </div>
                </div>
              )}

              {/* Warrant & Epistemic Attributes */}
              <div className="grid grid-cols-2 gap-2 text-[11px] font-mono">
                <div className="bg-zinc-950/80 p-2 rounded border border-zinc-800">
                  <span className="text-zinc-500 block text-[9px] uppercase">Warrant Discipline</span>
                  <span className="text-amber-400 font-semibold">{selectedNode.warrant_category || 'N/A'}</span>
                </div>
                <div className="bg-zinc-950/80 p-2 rounded border border-zinc-800">
                  <span className="text-zinc-500 block text-[9px] uppercase">Fidelity Label</span>
                  <span className="text-zinc-300">{selectedNode.fidelity_label || 'PROPOSED'}</span>
                </div>
                <div className="bg-zinc-950/80 p-2 rounded border border-zinc-800">
                  <span className="text-zinc-500 block text-[9px] uppercase">Database Node ID</span>
                  <span className="text-zinc-400 text-[10px] truncate block" title={selectedNode.id}>{selectedNode.id}</span>
                </div>
                <div className="bg-zinc-950/80 p-2 rounded border border-zinc-800">
                  <span className="text-zinc-500 block text-[9px] uppercase">Associated Root</span>
                  <span className="text-zinc-300 text-[10px]">{selectedNode.root_tree_id === 'tree_journal314_phenomenology' ? 'Tree 1 (Phenomenology)' : 'Tree 2 (PEC-Ω)'}</span>
                </div>
              </div>

              {/* Sub-Branches (Children List) */}
              <div className="space-y-1.5">
                <div className="flex items-center justify-between">
                  <span className="text-[10px] uppercase font-mono text-zinc-500 tracking-wider">
                    Immediate Sub-Branches ({selectedNode.children?.length || 0})
                  </span>
                  <button
                    onClick={() => {
                      setFormData({
                        title: '',
                        node_type: 'claim',
                        warrant_category: 'W2',
                        payload_text: '',
                        epistemic_status: 'supported',
                        paradox_relation: ''
                      });
                      setShowAddModal(true);
                    }}
                    className="text-[10px] text-amber-500 hover:text-amber-400 flex items-center gap-1 font-medium"
                  >
                    <Plus className="w-3 h-3" />
                    <span>Add Child</span>
                  </button>
                </div>

                <div className="max-h-48 overflow-y-auto space-y-1.5 pr-1">
                  {selectedNode.children && selectedNode.children.length > 0 ? (
                    selectedNode.children.map((child) => (
                      <div
                        key={child.id}
                        onClick={() => setSelectedNode(child)}
                        className="p-2 rounded-lg bg-zinc-950 hover:bg-zinc-800 border border-zinc-800/80 cursor-pointer transition flex items-center justify-between group"
                      >
                        <div className="flex items-center gap-2 overflow-hidden">
                          <span
                            className="w-2 h-2 rounded-full flex-shrink-0"
                            style={{ backgroundColor: getNodeColor(child.node_type, child.warrant_category) }}
                          ></span>
                          <span className="text-zinc-200 group-hover:text-amber-400 truncate text-xs">
                            {child.title}
                          </span>
                        </div>
                        <span className="text-[10px] font-mono text-zinc-500 uppercase flex-shrink-0">
                          {child.node_type}
                        </span>
                      </div>
                    ))
                  ) : (
                    <div className="text-zinc-500 text-[11px] italic p-2 bg-zinc-950/40 rounded border border-dashed border-zinc-800 text-center">
                      Leaf node — ready for dialectical densification.
                    </div>
                  )}
                </div>
              </div>

              {/* Generative Dialectical Densification Section */}
              <div className="p-3.5 rounded-lg bg-gradient-to-br from-amber-950/30 to-zinc-950 border border-amber-800/40 space-y-2.5">
                <div className="flex items-center gap-1.5 text-amber-400 font-mono text-[10px] uppercase tracking-wider font-semibold">
                  <Zap className="w-3.5 h-3.5 text-amber-500" />
                  <span>Dialectical Densification Engine</span>
                </div>
                <p className="text-[11px] text-zinc-400 leading-relaxed">
                  Automatically synthesizes 3-4 rigorous child dialectical branches: a refined proposition (W3), an adversarial defeater (W4), and a paraconsistent LP true contradiction {`{0, 1}`}.
                </p>

                <div className="space-y-1">
                  <label className="text-[10px] text-zinc-500 uppercase font-mono">Strategy Formulation:</label>
                  <input
                    type="text"
                    value={densifyStrategy}
                    onChange={(e) => setDensifyStrategy(e.target.value)}
                    placeholder="e.g. Nishida Pre-Reflective vs Neurocomputational Defeater"
                    className="w-full bg-zinc-950 border border-zinc-800 rounded px-2.5 py-1 text-xs text-zinc-200 focus:outline-none focus:border-amber-500"
                  />
                </div>

                <button
                  onClick={handleDensifyNode}
                  disabled={densifying}
                  className="w-full py-2 px-3 rounded-lg bg-amber-600 hover:bg-amber-500 text-zinc-950 font-bold text-xs flex items-center justify-center gap-1.5 transition disabled:opacity-50 shadow-lg shadow-amber-600/20"
                >
                  <Zap className={`w-3.5 h-3.5 ${densifying ? 'animate-bounce text-zinc-950' : ''}`} />
                  <span>{densifying ? 'Synthesizing Paraconsistent Branches...' : '⚡ Synthesize Dialectical Branches'}</span>
                </button>
              </div>
            </div>

            {/* Drawer Footer Actions */}
            <div className="p-3 border-t border-zinc-800 bg-zinc-950/80 flex items-center justify-between gap-2">
              <div className="flex items-center gap-2">
                <button
                  onClick={() => {
                    setFormData({
                      title: selectedNode.title,
                      node_type: selectedNode.node_type,
                      warrant_category: selectedNode.warrant_category || 'W2',
                      payload_text: selectedNode.payload_text,
                      epistemic_status: selectedNode.epistemic_status,
                      paradox_relation: selectedNode.paradox_relation || ''
                    });
                    setShowEditModal(true);
                  }}
                  className="p-1.5 rounded-lg bg-zinc-800 hover:bg-zinc-700 text-zinc-300 hover:text-zinc-100 transition flex items-center gap-1 text-[11px]"
                  title="Edit Node"
                >
                  <Edit3 className="w-3.5 h-3.5" />
                  <span>Edit</span>
                </button>
                <button
                  onClick={handleDeleteNode}
                  className="p-1.5 rounded-lg bg-rose-950/40 hover:bg-rose-900/60 text-rose-300 border border-rose-800/50 transition flex items-center gap-1 text-[11px]"
                  title="Cascade Delete Node"
                >
                  <Trash2 className="w-3.5 h-3.5" />
                  <span>Delete</span>
                </button>
              </div>

              {onTriggerResearchLoop && (
                <button
                  onClick={() => onTriggerResearchLoop(selectedNode.title)}
                  className="px-2.5 py-1.5 rounded-lg bg-zinc-800 hover:bg-zinc-700 text-zinc-200 text-[11px] font-medium flex items-center gap-1 transition"
                  title="Trigger Autonomous Research Loop on this Concept"
                >
                  <BookOpen className="w-3.5 h-3.5 text-amber-400" />
                  <span>Research Loop</span>
                </button>
              )}
            </div>
          </aside>
        )}
      </div>
        </>
      )}

      {/* Add Child Node Modal */}
      {showAddModal && selectedNode && (
        <div className="fixed inset-0 z-50 bg-zinc-950/80 backdrop-blur-sm flex items-center justify-center p-4">
          <div className="bg-zinc-900 border border-zinc-800 rounded-xl p-6 max-w-lg w-full shadow-2xl space-y-4 animate-in fade-in zoom-in-95 duration-150">
            <div className="flex items-center justify-between border-b border-zinc-800 pb-3">
              <h3 className="font-serif font-bold text-lg text-zinc-100 flex items-center gap-2">
                <Plus className="w-4 h-4 text-amber-400" />
                <span>Add Dialectical Child Branch</span>
              </h3>
              <button onClick={() => setShowAddModal(false)} className="text-zinc-400 hover:text-zinc-200">
                <X className="w-4 h-4" />
              </button>
            </div>

            <div className="text-xs text-zinc-400">
              Spawning child node under parent: <strong className="text-zinc-200 font-serif">{selectedNode.title}</strong>
            </div>

            <form onSubmit={handleAddChildNode} className="space-y-3.5 text-xs">
              <div>
                <label className="block text-zinc-400 mb-1 font-mono uppercase text-[10px]">Branch Title</label>
                <input
                  type="text"
                  required
                  value={formData.title}
                  onChange={(e) => setFormData({ ...formData, title: e.target.value })}
                  placeholder="e.g. Paraconsistent LP Antinomy: Immanent Void Manifestation"
                  className="w-full bg-zinc-950 border border-zinc-800 rounded-lg px-3 py-2 text-zinc-200 focus:outline-none focus:border-amber-500"
                />
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block text-zinc-400 mb-1 font-mono uppercase text-[10px]">Node Type</label>
                  <select
                    value={formData.node_type}
                    onChange={(e) => setFormData({ ...formData, node_type: e.target.value as HypermapNodeType })}
                    className="w-full bg-zinc-950 border border-zinc-800 rounded-lg px-3 py-2 text-zinc-200 focus:outline-none focus:border-amber-500"
                  >
                    <option value="claim">Claim / Proposition</option>
                    <option value="paradox">LP Antinomy (Paradox)</option>
                    <option value="objection">Adversarial Defeater</option>
                    <option value="revision">Mandatory Revision</option>
                    <option value="insight">Phenomenological Insight</option>
                    <option value="category">Sub-Category</option>
                  </select>
                </div>

                <div>
                  <label className="block text-zinc-400 mb-1 font-mono uppercase text-[10px]">Warrant Category</label>
                  <select
                    value={formData.warrant_category}
                    onChange={(e) => setFormData({ ...formData, warrant_category: e.target.value as WarrantCategory })}
                    className="w-full bg-zinc-950 border border-zinc-800 rounded-lg px-3 py-2 text-zinc-200 focus:outline-none focus:border-amber-500"
                  >
                    <option value="W1">W1: First-Person Report</option>
                    <option value="W2">W2: Attributed Corpus Premise</option>
                    <option value="W3">W3: Phenomenological Recurrence</option>
                    <option value="W4">W4: Retained Dialectical Disagreement</option>
                  </select>
                </div>
              </div>

              <div>
                <label className="block text-zinc-400 mb-1 font-mono uppercase text-[10px]">Philosophical Payload Text</label>
                <textarea
                  required
                  rows={3}
                  value={formData.payload_text}
                  onChange={(e) => setFormData({ ...formData, payload_text: e.target.value })}
                  placeholder="Articulate the premise, dialectical tension, or defeater arguments..."
                  className="w-full bg-zinc-950 border border-zinc-800 rounded-lg px-3 py-2 text-zinc-200 focus:outline-none focus:border-amber-500 resize-none font-sans"
                ></textarea>
              </div>

              {formData.node_type === 'paradox' && (
                <div>
                  <label className="block text-rose-400 mb-1 font-mono uppercase text-[10px]">Paraconsistent LP Relation Label</label>
                  <input
                    type="text"
                    value={formData.paradox_relation}
                    onChange={(e) => setFormData({ ...formData, paradox_relation: e.target.value })}
                    placeholder="e.g. LP_priest_antinomy_manifest_unmanifest"
                    className="w-full bg-zinc-950 border border-rose-900/50 rounded-lg px-3 py-2 text-rose-200 focus:outline-none focus:border-rose-500"
                  />
                </div>
              )}

              <div className="flex items-center justify-end gap-2 pt-2 border-t border-zinc-800">
                <button
                  type="button"
                  onClick={() => setShowAddModal(false)}
                  className="px-4 py-2 rounded-lg bg-zinc-800 hover:bg-zinc-700 text-zinc-300 font-medium"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  className="px-4 py-2 rounded-lg bg-amber-600 hover:bg-amber-500 text-zinc-950 font-bold shadow-lg shadow-amber-600/20"
                >
                  Save & Synchronize to SQLite
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* Edit Node Modal */}
      {showEditModal && selectedNode && (
        <div className="fixed inset-0 z-50 bg-zinc-950/80 backdrop-blur-sm flex items-center justify-center p-4">
          <div className="bg-zinc-900 border border-zinc-800 rounded-xl p-6 max-w-lg w-full shadow-2xl space-y-4 animate-in fade-in zoom-in-95 duration-150">
            <div className="flex items-center justify-between border-b border-zinc-800 pb-3">
              <h3 className="font-serif font-bold text-lg text-zinc-100 flex items-center gap-2">
                <Edit3 className="w-4 h-4 text-amber-400" />
                <span>Edit Hypermap Node</span>
              </h3>
              <button onClick={() => setShowEditModal(false)} className="text-zinc-400 hover:text-zinc-200">
                <X className="w-4 h-4" />
              </button>
            </div>

            <form onSubmit={handleEditNode} className="space-y-3.5 text-xs">
              <div>
                <label className="block text-zinc-400 mb-1 font-mono uppercase text-[10px]">Title</label>
                <input
                  type="text"
                  required
                  value={formData.title}
                  onChange={(e) => setFormData({ ...formData, title: e.target.value })}
                  className="w-full bg-zinc-950 border border-zinc-800 rounded-lg px-3 py-2 text-zinc-200 focus:outline-none focus:border-amber-500"
                />
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block text-zinc-400 mb-1 font-mono uppercase text-[10px]">Warrant Category</label>
                  <select
                    value={formData.warrant_category}
                    onChange={(e) => setFormData({ ...formData, warrant_category: e.target.value as WarrantCategory })}
                    className="w-full bg-zinc-950 border border-zinc-800 rounded-lg px-3 py-2 text-zinc-200 focus:outline-none focus:border-amber-500"
                  >
                    <option value="W0">W0: Raw Citation</option>
                    <option value="W1">W1: First-Person Report</option>
                    <option value="W2">W2: Attributed Corpus Premise</option>
                    <option value="W3">W3: Phenomenological Recurrence</option>
                    <option value="W4">W4: Retained Dialectical Disagreement</option>
                    <option value="W5">W5: Banned Closure</option>
                  </select>
                </div>

                <div>
                  <label className="block text-zinc-400 mb-1 font-mono uppercase text-[10px]">Epistemic Status</label>
                  <select
                    value={formData.epistemic_status}
                    onChange={(e) => setFormData({ ...formData, epistemic_status: e.target.value as any })}
                    className="w-full bg-zinc-950 border border-zinc-800 rounded-lg px-3 py-2 text-zinc-200 focus:outline-none focus:border-amber-500"
                  >
                    <option value="directly_attested">Directly Attested</option>
                    <option value="strongly_supported">Strongly Supported</option>
                    <option value="supported">Supported</option>
                    <option value="plausible">Plausible</option>
                    <option value="underdetermined">Underdetermined</option>
                    <option value="disputed">Disputed</option>
                  </select>
                </div>
              </div>

              <div>
                <label className="block text-zinc-400 mb-1 font-mono uppercase text-[10px]">Payload Text</label>
                <textarea
                  required
                  rows={4}
                  value={formData.payload_text}
                  onChange={(e) => setFormData({ ...formData, payload_text: e.target.value })}
                  className="w-full bg-zinc-950 border border-zinc-800 rounded-lg px-3 py-2 text-zinc-200 focus:outline-none focus:border-amber-500 resize-none font-sans"
                ></textarea>
              </div>

              <div className="flex items-center justify-end gap-2 pt-2 border-t border-zinc-800">
                <button
                  type="button"
                  onClick={() => setShowEditModal(false)}
                  className="px-4 py-2 rounded-lg bg-zinc-800 hover:bg-zinc-700 text-zinc-300 font-medium"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  className="px-4 py-2 rounded-lg bg-amber-600 hover:bg-amber-500 text-zinc-950 font-bold"
                >
                  Update Node
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
};
