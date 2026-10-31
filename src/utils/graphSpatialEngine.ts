/**
 * Epistemic Knowledge Graph Spatial Engine (src/utils/graphSpatialEngine.ts)
 * 
 * High-performance computational geometry, Vogel's Phyllotaxis Golden-Angle Spiral packing,
 * 4-Tier Semantic Zoom (Level of Detail), Screen-Space AABB Label Collision Grid,
 * Compound Supernode Projection, and Parallel Edge Bundling.
 */

import type { EpistemicTopologyNode } from '../components/GroundedEpistemicTopologyData';
import type { GraphNode, GraphEdge } from '../types/graph';

export type DensityMode = 'smart' | 'architecture' | 'full';
export type LoDTier = 0 | 1 | 2 | 3;

export interface ScreenRect {
  x1: number;
  y1: number;
  x2: number;
  y2: number;
  priority: number;
  label?: string;
}

export interface ViewportCamera {
  x: number;
  y: number;
  scale: number;
}

export interface PositionedVisualNode extends EpistemicTopologyNode {
  x: number;
  y: number;
  cx?: number;
  cy?: number;
  parent?: PositionedVisualNode;
  computedChildren?: PositionedVisualNode[];
  isMatch?: boolean;
  clusterId?: string;
  isClusterHub?: boolean;
  isFolded?: boolean;
  childCount?: number;
  hiddenCount?: number;
  degree?: number;
  priorityScore?: number;
  canvasLabel?: string;
  canRenderLabel?: boolean;
}

export interface BundledVisualEdge {
  id: string;
  source: string;
  target: string;
  sourceX: number;
  sourceY: number;
  targetX: number;
  targetY: number;
  relationType: string;
  edgeCategory?: string;
  bundleCount: number;
  isMetaEdge: boolean;
  isHighlighted?: boolean;
}

/**
 * Strips markdown formatting, statistical prefixes, and extracts concise epistemic label.
 */
export function formatCanvasDisplayLabel(
  rawTitle: string | undefined,
  nodeKind?: string,
  maxChars = 28
): string {
  if (!rawTitle) return '';

  // 1. Strip Markdown tokens (#, *, _, `, >, [[, ]])
  let cleaned = rawTitle
    .replace(/^#+\s*/, '')
    .replace(/[*_`]/g, '')
    .replace(/^>\s*/, '')
    .replace(/\[\[([^|\]]+)(?:\|([^\]]+))?\]\]/g, (_, target, alias) => alias || target)
    .trim();

  // 2. Strip statistical/noisy prefixes like "60% of thinker quotes...", "Chapter 1: "
  cleaned = cleaned.replace(/^\d+%\s+of\s+[^:]+:\s*/i, '');
  cleaned = cleaned.replace(/^Chapter\s+\d+[:\s-]*/i, '');
  cleaned = cleaned.replace(/^Section\s+\d+[:\s-]*/i, '');

  // 3. For document hubs, remove file extension if present
  if (nodeKind === 'document-hub') {
    cleaned = cleaned.replace(/\.(md|markdown|txt|pdf|json|csv)$/i, '');
  }

  // 4. Truncate at word boundary if exceeding maxChars
  if (cleaned.length <= maxChars) return cleaned;

  const truncated = cleaned.substring(0, maxChars);
  const lastSpace = truncated.lastIndexOf(' ');
  if (lastSpace > maxChars * 0.55) {
    return `${truncated.substring(0, lastSpace)}…`;
  }
  return `${truncated}…`;
}

/**
 * 4-Tier Semantic Zoom Scale Thresholds & Constants
 */
export const LOD_THRESHOLDS = {
  TIER_0_MAX: 0.50, // k < 0.50: Macro Constellation View
  TIER_1_MAX: 1.15, // 0.50 <= k < 1.15: Structural Meso View
  TIER_2_MAX: 2.00  // 1.15 <= k < 2.00: Conceptual Micro View; k >= 2.00: Deep Inspection View
} as const;

export const LOD_TIER_LABELS: Record<LoDTier, { name: string; description: string }> = {
  0: { name: 'Tier 0: Macro Constellation', description: 'Baseline Nodes + Document Supernodes + Bundled Meta-Edges' },
  1: { name: 'Tier 1: Structural Meso', description: 'Section Hubs & Primary Concept Hubs' },
  2: { name: 'Tier 2: Conceptual Micro', description: 'Granular Concepts & In-Frustum Propositions' },
  3: { name: 'Tier 3: Deep Inspection', description: 'Full Headlines, Provenance Badges & Relation Predicates' }
};

export function getLoDTier(scale: number | null | undefined): LoDTier {
  if (scale == null || !Number.isFinite(scale) || scale <= 0) {
    return 1; // Structural Meso View as safe baseline default
  }
  if (scale < LOD_THRESHOLDS.TIER_0_MAX) return 0; // Macro Constellation View
  if (scale < LOD_THRESHOLDS.TIER_1_MAX) return 1; // Structural Meso View
  if (scale < LOD_THRESHOLDS.TIER_2_MAX) return 2; // Conceptual Micro View
  return 3;                                        // Deep Epistemic Inspection View
}

/**
 * Vogel's Phyllotaxis Golden-Angle Spiral Coordinate Generator
 * θ_i = i * 137.50776405° (i * π * (3 - √5))
 * r_i = r_inner + c_spacing * √i
 */
const GOLDEN_ANGLE = Math.PI * (3 - Math.sqrt(5)); // ~2.39996322972865332 rad (~137.507764°)

export function computePhyllotaxisPosition(
  index: number,
  cSpacing = 28,
  rInner = 45,
  center: { x: number; y: number } = { x: 0, y: 0 }
): { x: number; y: number; r: number; theta: number } {
  if (index === 0) {
    return { x: center.x, y: center.y, r: 0, theta: 0 };
  }

  const theta = index * GOLDEN_ANGLE;
  const r = rInner + cSpacing * Math.sqrt(index);
  const x = center.x + Math.cos(theta) * r;
  const y = center.y + Math.sin(theta) * r;

  return { x, y, r, theta };
}

/**
 * Greedy 2D Screen-Space AABB Label Collision Grid
 * Guarantees zero text overlap and bounds label density per frame (max 55 labels).
 */
export class ScreenSpaceLabelCuller {
  private occupiedRects: ScreenRect[] = [];
  private maxVisibleLabels = 55;
  private width = 1920;
  private height = 1080;
  private margin = 60;

  public reset(viewportWidth: number, viewportHeight: number, maxLabels = 55): void {
    this.occupiedRects = [];
    this.width = Number.isFinite(viewportWidth) && viewportWidth > 0 ? viewportWidth : 1920;
    this.height = Number.isFinite(viewportHeight) && viewportHeight > 0 ? viewportHeight : 1080;
    this.maxVisibleLabels = maxLabels;
  }

  /**
   * Registers a high-priority node's screen circle as an occupied bounding box
   * so text labels do not draw directly over neighbor node orbs.
   */
  public registerNodeOrb(screenX: number, screenY: number, screenRadius: number): void {
    if (!Number.isFinite(screenX) || !Number.isFinite(screenY) || !Number.isFinite(screenRadius)) {
      return;
    }
    const pad = 4;
    this.occupiedRects.push({
      x1: screenX - screenRadius - pad,
      y1: screenY - screenRadius - pad,
      x2: screenX + screenRadius + pad,
      y2: screenY + screenRadius + pad,
      priority: 99999
    });
  }

  /**
   * Checks whether a screen point is inside the viewport frustum with margin
   */
  public isInFrustum(screenX: number, screenY: number): boolean {
    if (!Number.isFinite(screenX) || !Number.isFinite(screenY)) return false;
    return (
      screenX >= -this.margin &&
      screenX <= this.width + this.margin &&
      screenY >= -this.margin &&
      screenY <= this.height + this.margin
    );
  }

  /**
   * Attempts to place a label rectangle. Returns true if accepted with no collision.
   */
  public testAndInsert(rect: ScreenRect): boolean {
    if (
      !Number.isFinite(rect.x1) ||
      !Number.isFinite(rect.x2) ||
      !Number.isFinite(rect.y1) ||
      !Number.isFinite(rect.y2)
    ) {
      return false;
    }
    if (this.occupiedRects.length >= this.maxVisibleLabels + 10) {
      return false;
    }

    // Check bounds within viewport
    if (
      rect.x2 < 0 ||
      rect.x1 > this.width ||
      rect.y2 < 0 ||
      rect.y1 > this.height
    ) {
      return false;
    }

    // AABB intersection check
    for (let i = 0; i < this.occupiedRects.length; i++) {
      const occ = this.occupiedRects[i];
      const collides = !(
        rect.x2 < occ.x1 ||
        rect.x1 > occ.x2 ||
        rect.y2 < occ.y1 ||
        rect.y1 > occ.y2
      );
      if (collides) return false;
    }

    this.occupiedRects.push(rect);
    return true;
  }
}

export interface LayoutPhysicsOptions {
  forceStrength?: number;
  linkDistance?: number;
  collisionRadius?: number;
}

/**
 * Projects raw graph models into the active ViewGraph, applying progressive
 * folding, Phyllotaxis cluster packing, and cluster meta-edge aggregation.
 */
export function projectViewGraph(params: {
  treeData: EpistemicTopologyNode;
  ingestedGraph: { nodes: GraphNode[]; edges: GraphEdge[] };
  densityMode: DensityMode;
  lodTier?: LoDTier;
  expandedClusterIds: Set<string>;
  searchQuery: string;
  selectedNodeId: string | null;
  hoveredNodeId: string | null;
  layoutOptions?: LayoutPhysicsOptions;
}): {
  positionedNodes: PositionedVisualNode[];
  bundledEdges: BundledVisualEdge[];
  clusterCounts: Map<string, { total: number; hidden: number; sections: number }>;
} {
  const {
    treeData,
    ingestedGraph,
    densityMode,
    lodTier = 1,
    expandedClusterIds,
    searchQuery,
    selectedNodeId,
    hoveredNodeId,
    layoutOptions
  } = params;

  const forceMult = layoutOptions?.forceStrength ?? 1.0;
  const linkDistMult = layoutOptions?.linkDistance ?? 1.0;
  const collisionMult = layoutOptions?.collisionRadius != null ? Math.max(0.3, layoutOptions.collisionRadius / 28) : 1.0;

  const positioned: PositionedVisualNode[] = [];
  const qLower = searchQuery.toLowerCase().trim();

  // Step 1: Layout Baseline 50 Nodes in Central Constellation
  const rootPos: PositionedVisualNode = {
    ...treeData,
    x: 0,
    y: 0,
    isMatch: Boolean(
      qLower &&
        (treeData.title.toLowerCase().includes(qLower) ||
          (treeData.description && treeData.description.toLowerCase().includes(qLower)) ||
          (treeData.thematicGroup && treeData.thematicGroup.toLowerCase().includes(qLower)))
    ),
    priorityScore: 5000,
    clusterId: 'baseline_root',
    isClusterHub: true
  };
  positioned.push(rootPos);

  function layoutBaselineSubtree(
    node: EpistemicTopologyNode,
    parentPos: PositionedVisualNode,
    depth: number,
    angleStart: number,
    angleSpan: number
  ) {
    if (!node.children || node.children.length === 0 || node._collapsed) return;

    const leafCount = (n: EpistemicTopologyNode): number =>
      !n.children?.length || n._collapsed ? 1 : n.children.reduce((sum, child) => sum + leafCount(child), 0);
    const totalLeaves = node.children.reduce((sum, child) => sum + leafCount(child), 0);
    let cursor = angleStart;

    node.children.forEach((child) => {
      const span = (angleSpan * leafCount(child)) / (totalLeaves || 1);
      const theta = cursor + span / 2;
      cursor += span;
      const radius = (240 + (depth - 1) * 165) * linkDistMult * forceMult;
      const cx = Math.cos(theta) * radius;
      const cy = Math.sin(theta) * radius;

      const isMatch = Boolean(
        qLower &&
          (child.title.toLowerCase().includes(qLower) ||
            (child.description && child.description.toLowerCase().includes(qLower)) ||
            (child.thematicGroup && child.thematicGroup.toLowerCase().includes(qLower)) ||
            (child.systemStage && child.systemStage.toLowerCase().includes(qLower)) ||
            (child.quoteText && child.quoteText.toLowerCase().includes(qLower)))
      );

      const childPos: PositionedVisualNode = {
        ...child,
        x: cx,
        y: cy,
        parent: parentPos,
        isMatch,
        priorityScore: depth === 1 ? 3500 : 2500,
        clusterId: 'baseline_core'
      };

      positioned.push(childPos);
      layoutBaselineSubtree(child, childPos, depth + 1, theta - span / 2, span);
    });
  }

  layoutBaselineSubtree(treeData, rootPos, 1, -Math.PI, Math.PI * 2);

  // Step 2: Ingested Document Hubs and Compound Hierarchies
  const clusterCounts = new Map<string, { total: number; hidden: number; sections: number }>();

  if (ingestedGraph.nodes.length > 0) {
    const docHubs = ingestedGraph.nodes.filter((n) => n.nodeKind === 'document-hub');
    const nonHubs = ingestedGraph.nodes.filter((n) => n.nodeKind !== 'document-hub');

    const hubCount = Math.max(docHubs.length, 1);
    const hubAngleStep = (Math.PI * 2) / hubCount;

    // Outer Celestial Orbit for Document Hubs (R_doc = 1150px to 1550px)
    const baseOrbitalRadius = 1250 * linkDistMult;

    docHubs.forEach((hub, hIdx) => {
      const fileNodes = nonHubs.filter((n) => n.sourceFile === hub.sourceFile);
      const sections = fileNodes.filter((n) => n.nodeKind === 'section');
      const concepts = fileNodes.filter((n) => n.nodeKind !== 'section');
      const totalFileCount = fileNodes.length;

      const isExplicitlyExpanded =
        densityMode === 'full' ||
        expandedClusterIds.has(hub.id) ||
        (qLower.length > 0 && fileNodes.some((n) => (n.title || n.label).toLowerCase().includes(qLower)));

      // In Tier 0 (Macro Constellation, k < 0.50), Smart LoD collapses all document clusters into supernodes
      const isTier0Collapsed = densityMode === 'smart' && lodTier === 0 && !isExplicitlyExpanded;
      const isClusterExpanded = isExplicitlyExpanded || (densityMode === 'smart' && lodTier >= 1 && totalFileCount <= 60);

      // Position Document Hub along the celestial orbit
      const hubAngle = -Math.PI / 2 + hIdx * hubAngleStep;
      const hubDist = baseOrbitalRadius + (hIdx % 2 === 0 ? 0 : 180);
      const hubX = Math.cos(hubAngle) * hubDist;
      const hubY = Math.sin(hubAngle) * hubDist;

      const isMatch = Boolean(
        qLower &&
          ((hub.title && hub.title.toLowerCase().includes(qLower)) ||
            hub.label.toLowerCase().includes(qLower) ||
            (hub.description && hub.description.toLowerCase().includes(qLower)))
      );

      const hubPos: PositionedVisualNode = {
        id: hub.id,
        title: hub.title || hub.label,
        description: hub.description || hub.content,
        systemStage: hub.systemStage || 'Document Ingestion',
        thematicGroup: hub.thematicGroup || 'Ingested Corpus',
        citations: (hub.citations || []).map((c, i) =>
          typeof c === 'string' ? { id: `cit_${i}`, sourceTitle: hub.sourceFile, quoteSnippet: c } : c
        ),
        metadata: Object.entries(hub.metadata || {}).map(([l, v]) => ({
          label: l,
          value: v,
          category: 'system' as const
        })),
        connectedNodeIds: hub.connectedNodeIds || [],
        level: 1,
        type: 'document-hub',
        radius: 20,
        particleCount: 16,
        color: '#38bdf8',
        glowColor: 'rgba(56, 189, 248, 0.55)',
        x: hubX,
        y: hubY,
        isMatch,
        parent: rootPos,
        nodeKind: hub.nodeKind,
        processingMode: hub.processingMode,
        confidenceStatus: hub.confidenceStatus,
        sourceSpans: hub.sourceSpans,
        sourceFile: hub.sourceFile,
        clusterId: hub.id,
        isClusterHub: true,
        childCount: totalFileCount,
        isFolded: isTier0Collapsed || (!isClusterExpanded && totalFileCount > 40),
        hiddenCount: isTier0Collapsed || !isClusterExpanded ? totalFileCount : 0,
        priorityScore: 4500
      };
      positioned.push(hubPos);

      // If collapsed in Tier 0 or folded in Smart/Architecture mode, register count and stop here
      if (isTier0Collapsed || (!isClusterExpanded && totalFileCount > 60)) {
        clusterCounts.set(hub.id, {
          total: totalFileCount,
          hidden: totalFileCount,
          sections: sections.length
        });
        return;
      }

      // If expanded or small cluster: distribute Section Hubs and Concepts via Vogel's Phyllotaxis Spiral
      let hiddenInCluster = 0;
      clusterCounts.set(hub.id, {
        total: totalFileCount,
        hidden: 0,
        sections: sections.length
      });

      // Section Hubs Layout around Document Hub
      const secCount = sections.length;
      sections.forEach((sec, sIdx) => {
        // Position Section Hubs on a spacious phyllotaxis spiral around Document Hub
        const secPosRel = computePhyllotaxisPosition(
          sIdx + 1,
          46 * collisionMult,
          120 * linkDistMult * forceMult,
          { x: hubX, y: hubY }
        );
        const secX = secPosRel.x;
        const secY = secPosRel.y;

        const secMatch = Boolean(
          qLower &&
            ((sec.title && sec.title.toLowerCase().includes(qLower)) ||
              sec.label.toLowerCase().includes(qLower) ||
              (sec.description && sec.description.toLowerCase().includes(qLower)))
        );

        const childConcepts = concepts.filter(
          (c) => c.id.includes(sec.id) || (c.connectedNodeIds && c.connectedNodeIds.includes(sec.id))
        );

        const isSecExplicitlyExpanded =
          densityMode === 'full' ||
          expandedClusterIds.has(sec.id) ||
          expandedClusterIds.has(hub.id) ||
          (qLower.length > 0 && childConcepts.some((c) => (c.title || c.label).toLowerCase().includes(qLower)));

        // In Tier 1 (Structural Meso), propositions remain folded inside section hubs
        const isTier1PropFolded =
          densityMode === 'architecture' ||
          (densityMode === 'smart' && lodTier <= 1 && !isSecExplicitlyExpanded);

        const isSecExpanded =
          isSecExplicitlyExpanded ||
          (densityMode === 'smart' && lodTier >= 2 && childConcepts.length <= 25);

        const secPos: PositionedVisualNode = {
          id: sec.id,
          title: sec.title || sec.label,
          description: sec.description || sec.content,
          systemStage: sec.systemStage,
          thematicGroup: sec.thematicGroup,
          citations: (sec.citations || []).map((c, i) =>
            typeof c === 'string' ? { id: `cit_${i}`, sourceTitle: sec.sourceFile, quoteSnippet: c } : c
          ),
          metadata: Object.entries(sec.metadata || {}).map(([l, v]) => ({
            label: l,
            value: v,
            category: 'epistemic' as const
          })),
          connectedNodeIds: sec.connectedNodeIds || [],
          level: 2,
          type: 'section',
          radius: 14,
          color: '#818cf8',
          glowColor: 'rgba(129, 140, 248, 0.45)',
          x: secX,
          y: secY,
          isMatch: secMatch,
          parent: hubPos,
          nodeKind: sec.nodeKind,
          processingMode: sec.processingMode,
          confidenceStatus: sec.confidenceStatus,
          sourceSpans: sec.sourceSpans,
          sourceFile: sec.sourceFile,
          clusterId: hub.id,
          isClusterHub: true,
          childCount: childConcepts.length,
          isFolded: isTier1PropFolded || !isSecExpanded,
          hiddenCount: isTier1PropFolded
            ? childConcepts.filter((c) => c.nodeKind === 'proposition' || c.nodeKind === 'passage').length
            : !isSecExpanded
            ? childConcepts.length
            : 0,
          priorityScore: 2800
        };
        positioned.push(secPos);

        // If Section children are folded, count hidden and do not layout children
        if (!isSecExpanded && !isSecExplicitlyExpanded && lodTier < 2) {
          hiddenInCluster += childConcepts.length;
          return;
        }

        // Layout child Concepts & Propositions around Section Hub using Vogel's Golden-Angle Spiral
        childConcepts.forEach((concept, cIdx) => {
          // If in Tier 1 or architecture mode, skip proposition/passage nodes
          if (
            isTier1PropFolded &&
            (concept.nodeKind === 'proposition' || concept.nodeKind === 'passage')
          ) {
            hiddenInCluster++;
            return;
          }

          const cPosRel = computePhyllotaxisPosition(
            cIdx + 1,
            26 * collisionMult,
            48 * linkDistMult * forceMult,
            { x: secX, y: secY }
          );
          const isUnresolved = concept.nodeKind === 'unresolved-reference';
          const isProposition = concept.nodeKind === 'proposition' || concept.nodeKind === 'passage';

          const cMatch = Boolean(
            qLower &&
              ((concept.title && concept.title.toLowerCase().includes(qLower)) ||
                concept.label.toLowerCase().includes(qLower) ||
                (concept.description && concept.description.toLowerCase().includes(qLower)))
          );

          const conceptPos: PositionedVisualNode = {
            id: concept.id,
            title: concept.title || concept.label,
            description: concept.description || concept.content,
            systemStage: concept.systemStage,
            thematicGroup: concept.thematicGroup,
            citations: (concept.citations || []).map((c, i) =>
              typeof c === 'string' ? { id: `cit_${i}`, sourceTitle: concept.sourceFile, quoteSnippet: c } : c
            ),
            metadata: Object.entries(concept.metadata || {}).map(([l, v]) => ({
              label: l,
              value: v,
              category: 'epistemic' as const
            })),
            connectedNodeIds: concept.connectedNodeIds || [],
            level: 3,
            type: concept.nodeKind,
            radius: isUnresolved ? 8 : isProposition ? 7 : 11,
            color: isUnresolved
              ? '#f59e0b'
              : concept.confidenceStatus === 'source-explicit'
              ? '#10b981'
              : isProposition
              ? '#06b6d4'
              : '#00f0ff',
            glowColor: isUnresolved ? 'rgba(245, 158, 11, 0.4)' : 'rgba(0, 240, 255, 0.35)',
            x: cPosRel.x,
            y: cPosRel.y,
            isMatch: cMatch,
            parent: secPos,
            nodeKind: concept.nodeKind,
            processingMode: concept.processingMode,
            confidenceStatus: concept.confidenceStatus,
            sourceSpans: concept.sourceSpans,
            sourceFile: concept.sourceFile,
            clusterId: hub.id,
            priorityScore: isProposition ? 300 : 1200
          };
          positioned.push(conceptPos);
        });
      });

      // Handle unassigned/orphan concepts within Document Hub via Vogel's Spiral
      const assignedIds = new Set(positioned.map((p) => p.id));
      const orphanConcepts = fileNodes.filter((n) => !assignedIds.has(n.id));

      if (isClusterExpanded) {
        orphanConcepts.forEach((orphan, oIdx) => {
          if (
            (densityMode === 'architecture' || (densityMode === 'smart' && lodTier <= 1 && !isExplicitlyExpanded)) &&
            (orphan.nodeKind === 'proposition' || orphan.nodeKind === 'passage')
          ) {
            hiddenInCluster++;
            return;
          }

          const oPosRel = computePhyllotaxisPosition(
            oIdx + 1,
            28 * collisionMult,
            90 * linkDistMult * forceMult,
            { x: hubX, y: hubY }
          );
          const isUnresolved = orphan.nodeKind === 'unresolved-reference';
          const isProposition = orphan.nodeKind === 'proposition' || orphan.nodeKind === 'passage';

          positioned.push({
            id: orphan.id,
            title: orphan.title || orphan.label,
            description: orphan.description || orphan.content,
            systemStage: orphan.systemStage,
            thematicGroup: orphan.thematicGroup,
            citations: (orphan.citations || []).map((c, i) =>
              typeof c === 'string' ? { id: `cit_${i}`, sourceTitle: orphan.sourceFile, quoteSnippet: c } : c
            ),
            metadata: Object.entries(orphan.metadata || {}).map(([l, v]) => ({
              label: l,
              value: v,
              category: 'epistemic' as const
            })),
            connectedNodeIds: orphan.connectedNodeIds || [],
            level: 3,
            type: orphan.nodeKind,
            radius: isUnresolved ? 8 : isProposition ? 7 : 10,
            color: isUnresolved ? '#f59e0b' : '#00f0ff',
            glowColor: isUnresolved ? 'rgba(245, 158, 11, 0.4)' : 'rgba(0, 240, 255, 0.4)',
            x: oPosRel.x,
            y: oPosRel.y,
            isMatch: qLower
              ? Boolean(
                  (orphan.title && orphan.title.toLowerCase().includes(qLower)) ||
                    orphan.label.toLowerCase().includes(qLower)
                )
              : false,
            parent: hubPos,
            nodeKind: orphan.nodeKind,
            processingMode: orphan.processingMode,
            confidenceStatus: orphan.confidenceStatus,
            sourceSpans: orphan.sourceSpans,
            sourceFile: orphan.sourceFile,
            clusterId: hub.id,
            priorityScore: isProposition ? 250 : 1000
          });
        });
      } else {
        hiddenInCluster += orphanConcepts.length;
      }

      const currentStats = clusterCounts.get(hub.id);
      if (currentStats) {
        currentStats.hidden = hiddenInCluster;
      }
    });

    // Handle standalone or custom concept nodes not attached to an ingested docHub
    const positionedIds = new Set(positioned.map((p) => p.id));
    const standaloneNodes = ingestedGraph.nodes.filter((n) => !positionedIds.has(n.id));
    if (standaloneNodes.length > 0) {
      standaloneNodes.forEach((sNode, sIdx) => {
        let posX = sNode.x;
        let posY = sNode.y;

        if (typeof posX !== 'number' || typeof posY !== 'number' || !Number.isFinite(posX) || !Number.isFinite(posY)) {
          const sPosRel = computePhyllotaxisPosition(
            sIdx + 1,
            36 * collisionMult,
            160 * linkDistMult * forceMult,
            { x: 0, y: 0 }
          );
          posX = sPosRel.x;
          posY = sPosRel.y;
        }

        const isMatch = Boolean(
          qLower &&
            ((sNode.title && sNode.title.toLowerCase().includes(qLower)) ||
              (sNode.label && sNode.label.toLowerCase().includes(qLower)) ||
              (sNode.description && sNode.description.toLowerCase().includes(qLower)))
        );

        positioned.push({
          id: sNode.id,
          title: sNode.title || sNode.label,
          description: sNode.description || sNode.content,
          systemStage: sNode.systemStage || 'Stage V: Praxis & Epistemic Synthesis',
          thematicGroup: sNode.thematicGroup || 'Epistemic Architecture',
          citations: (sNode.citations || []).map((c, i) =>
            typeof c === 'string' ? { id: `cit_${i}`, sourceTitle: sNode.sourceFile, quoteSnippet: c } : c
          ),
          metadata: Object.entries(sNode.metadata || {}).map(([l, v]) => ({
            label: l,
            value: v,
            category: 'epistemic' as const
          })),
          connectedNodeIds: sNode.connectedNodeIds || [],
          level: sNode.level || 2,
          type: sNode.nodeKind || 'concept',
          radius: sNode.radius || 13,
          color: sNode.color || '#818cf8',
          glowColor: sNode.glowColor || 'rgba(129, 140, 248, 0.45)',
          x: posX,
          y: posY,
          isMatch,
          parent: rootPos,
          nodeKind: sNode.nodeKind || 'concept',
          processingMode: sNode.processingMode || 'STRUCTURALLY_INGESTED',
          confidenceStatus: sNode.confidenceStatus || 'source-explicit',
          sourceSpans: sNode.sourceSpans,
          sourceFile: sNode.sourceFile || 'User Defined',
          clusterId: 'custom_nodes',
          priorityScore: 3500
        });
      });
    }
  }

  // Step 3: Priority Scoring Boosts for Selected / Hovered / High-Degree Nodes
  const posMap = new Map<string, PositionedVisualNode>();
  positioned.forEach((n) => posMap.set(n.id, n));

  // Compute node degrees
  ingestedGraph.edges.forEach((edge) => {
    const s = posMap.get(edge.source);
    const t = posMap.get(edge.target);
    if (s) s.degree = (s.degree || 0) + 1;
    if (t) t.degree = (t.degree || 0) + 1;
  });

  positioned.forEach((n) => {
    if (n.id === selectedNodeId) {
      n.priorityScore = 10000;
    } else if (n.id === hoveredNodeId) {
      n.priorityScore = 8500;
    } else if (
      (selectedNodeId && n.connectedNodeIds?.includes(selectedNodeId)) ||
      (hoveredNodeId && n.connectedNodeIds?.includes(hoveredNodeId))
    ) {
      n.priorityScore = 8000;
    } else if (n.isMatch) {
      n.priorityScore = 6000;
    } else {
      n.priorityScore = (n.priorityScore || 500) + (n.degree || 0) * 15;
    }
  });

  // Step 4: Edge Bundling & Parallel Aggregation
  const bundledEdges: BundledVisualEdge[] = [];
  const edgeGroups = new Map<string, { edges: GraphEdge[]; sourceNode: PositionedVisualNode; targetNode: PositionedVisualNode }>();

  ingestedGraph.edges.forEach((edge) => {
    let sNode = posMap.get(edge.source);
    let tNode = posMap.get(edge.target);

    // If source or target is folded into a cluster, redirect link to the cluster hub
    if (!sNode) {
      const srcRaw = ingestedGraph.nodes.find((n) => n.id === edge.source);
      if (srcRaw) {
        sNode = positioned.find((p) => p.isClusterHub && p.clusterId === srcRaw.documentId);
      }
    }
    if (!tNode) {
      const tgtRaw = ingestedGraph.nodes.find((n) => n.id === edge.target);
      if (tgtRaw) {
        tNode = positioned.find((p) => p.isClusterHub && p.clusterId === tgtRaw.documentId);
      }
    }

    if (!sNode || !tNode || sNode.id === tNode.id) return;

    // Group parallel edges by endpoint pair
    const pairKey = `${sNode.id}-->${tNode.id}`;
    if (!edgeGroups.has(pairKey)) {
      edgeGroups.set(pairKey, { edges: [], sourceNode: sNode, targetNode: tNode });
    }
    edgeGroups.get(pairKey)!.edges.push(edge);
  });

  edgeGroups.forEach(({ edges, sourceNode, targetNode }, pairKey) => {
    const isHighlighted =
      Boolean(selectedNodeId && (sourceNode.id === selectedNodeId || targetNode.id === selectedNodeId)) ||
      Boolean(hoveredNodeId && (sourceNode.id === hoveredNodeId || targetNode.id === hoveredNodeId)) ||
      sourceNode.isMatch ||
      targetNode.isMatch;

    const primaryEdge = edges[0];
    bundledEdges.push({
      id: pairKey,
      source: sourceNode.id,
      target: targetNode.id,
      sourceX: sourceNode.x,
      sourceY: sourceNode.y,
      targetX: targetNode.x,
      targetY: targetNode.y,
      relationType: primaryEdge.relationType || 'relates',
      edgeCategory: primaryEdge.edgeCategory,
      bundleCount: edges.length,
      isMetaEdge: edges.length > 1,
      isHighlighted
    });
  });

  return {
    positionedNodes: positioned,
    bundledEdges,
    clusterCounts
  };
}

/**
  * Global Keyboard Guard Subroutine:
  * Detects if the event target is an active input, textarea, select, or contenteditable element.
  */
export const isEditableElement = (target: EventTarget | null): boolean => {
  if (!target) return false;
  if (typeof HTMLElement !== 'undefined' && !(target instanceof HTMLElement)) {
    return false;
  }
  const el = target as { tagName?: string; isContentEditable?: boolean };
  if (!el.tagName || typeof el.tagName !== 'string') return false;
  const tag = el.tagName.toLowerCase();
  return tag === 'input' || tag === 'textarea' || tag === 'select' || Boolean(el.isContentEditable);
};

/**
  * Inverse Affine Screen-to-World Spawn Projection:
  * Computes un-projected world coordinates from viewport center with deterministic collision avoidance.
  */
export const getViewportCenterWorldCoords = (
  dimensions: { width: number; height: number },
  transform: { x: number; y: number; k: number },
  existingNodes: Array<{ x?: number; y?: number }> = []
): { x: number; y: number } => {
  const safeWidth = dimensions.width > 0 ? dimensions.width : 800;
  const safeHeight = dimensions.height > 0 ? dimensions.height : 600;
  const safeScale = Number.isFinite(transform.k) && transform.k >= 0.1 ? transform.k : 1;

  let worldX = (safeWidth / 2 - transform.x) / safeScale;
  let worldY = (safeHeight / 2 - transform.y) / safeScale;

  // Deterministic collision avoidance against existing node centers
  let attempt = 0;
  const minSeparation = 36;
  while (
    attempt < 12 &&
    existingNodes.some(
      (n) =>
        typeof n.x === 'number' &&
        typeof n.y === 'number' &&
        Math.hypot(n.x - worldX, n.y - worldY) < minSeparation
    )
  ) {
    attempt += 1;
    const angle = attempt * 1.15;
    const radius = attempt * 18;
    worldX += Math.cos(angle) * radius;
    worldY += Math.sin(angle) * radius;
  }

  return { x: Math.round(worldX), y: Math.round(worldY) };
};
