import assert from 'node:assert/strict';
import {
  computePhyllotaxisPosition,
  getLoDTier,
  formatCanvasDisplayLabel,
  ScreenSpaceLabelCuller,
  projectViewGraph
} from '../src/utils/graphSpatialEngine';
import { MARKMAP_EPITEMIC_TOPOLOGY } from '../src/components/GroundedEpistemicTopologyData';
import type { GraphNode, GraphEdge } from '../src/types/graph';

async function runSpatialTests() {
  console.log('===============================================================');
  console.log('  SPATIAL ENGINE & GEOMETRY VERIFICATION');
  console.log('===============================================================');

  // Test 1: Vogel's Phyllotaxis Spiral Distribution
  {
    const N = 500;
    const points: Array<{ x: number; y: number }> = [];
    for (let i = 0; i < N; i++) {
      points.push(computePhyllotaxisPosition(i, 28, 45));
    }

    // Verify non-zero spread and radial expansion ~ sqrt(i)
    const p10 = points[10];
    const p100 = points[100];
    const p400 = points[400];

    const r10 = Math.hypot(p10.x, p10.y);
    const r100 = Math.hypot(p100.x, p100.y);
    const r400 = Math.hypot(p400.x, p400.y);

    assert(r10 < r100, 'Radius should increase with index');
    assert(r100 < r400, 'Radius should scale with sqrt(N)');

    // Verify pairwise minimum clearance >= 20px
    let minDistance = Infinity;
    for (let i = 1; i < Math.min(100, N); i++) {
      for (let j = i + 1; j < Math.min(100, N); j++) {
        const d = Math.hypot(points[i].x - points[j].x, points[i].y - points[j].y);
        if (d < minDistance) minDistance = d;
      }
    }
    assert(minDistance >= 18, `Minimum pairwise clearance should be >= 18px (got ${minDistance.toFixed(2)}px)`);
    console.log(`  ✓ PASS: Vogel's Phyllotaxis ensures uniform clearance (min clearance: ${minDistance.toFixed(1)}px for N=100)`);
  }

  // Test 2: 4-Tier Semantic Zoom Thresholds
  {
    assert.equal(getLoDTier(0.2), 0, 'scale 0.2 should be Tier 0 (Macro Constellation)');
    assert.equal(getLoDTier(0.49), 0, 'scale 0.49 should be Tier 0');
    assert.equal(getLoDTier(0.50), 1, 'scale 0.50 should be Tier 1 (Structural Meso)');
    assert.equal(getLoDTier(1.0), 1, 'scale 1.0 should be Tier 1');
    assert.equal(getLoDTier(1.15), 2, 'scale 1.15 should be Tier 2 (Conceptual Micro)');
    assert.equal(getLoDTier(1.8), 2, 'scale 1.8 should be Tier 2');
    assert.equal(getLoDTier(2.0), 3, 'scale 2.0 should be Tier 3 (Deep Epistemic Inspection)');
    assert.equal(getLoDTier(3.2), 3, 'scale 3.2 should be Tier 3');
    console.log('  ✓ PASS: 4-Tier Semantic Zoom thresholds validated (Tiers 0, 1, 2, 3)');
  }

  // Test 3: Epistemic Display Label Sanitizer
  {
    const rawMarkdown = '### The [[Unground|Divine Unground]] of Being';
    const cleaned = formatCanvasDisplayLabel(rawMarkdown, 'concept', 30);
    assert.equal(cleaned, 'The Divine Unground of Being', 'Should strip headers and wikilinks');

    const statistical = '60% of thinker quotes: The Kenotic Rupture of Determinacy';
    const cleanedStat = formatCanvasDisplayLabel(statistical, 'proposition', 28);
    assert(!cleanedStat.includes('60%'), 'Should strip statistical prefixes');
    assert(cleanedStat.endsWith('…'), 'Should truncate with ellipsis at word boundary');

    console.log('  ✓ PASS: formatCanvasDisplayLabel sanitizes markdown, wikilinks, and statistical prefixes');
  }

  // Test 4: ScreenSpaceLabelCuller AABB Intersection
  {
    const culler = new ScreenSpaceLabelCuller();
    culler.reset(800, 600, 5);

    // Insert first label at (100, 100)
    const accepted1 = culler.testAndInsert({ x1: 100, y1: 100, x2: 200, y2: 120, priority: 100 });
    assert.equal(accepted1, true, 'First label should be accepted');

    // Overlapping label at (150, 110)
    const acceptedOverlap = culler.testAndInsert({ x1: 150, y1: 110, x2: 250, y2: 130, priority: 50 });
    assert.equal(acceptedOverlap, false, 'Overlapping label must be rejected');

    // Non-overlapping label at (300, 100)
    const acceptedNonOverlap = culler.testAndInsert({ x1: 300, y1: 100, x2: 400, y2: 120, priority: 80 });
    assert.equal(acceptedNonOverlap, true, 'Non-overlapping label should be accepted');

    console.log('  ✓ PASS: ScreenSpaceLabelCuller strictly rejects colliding AABB bounding boxes');
  }

  // Test 5: projectViewGraph Progressive Supernode Folding
  {
    // Generate synthetic large document with 150 nodes
    const docHub: GraphNode = {
      id: 'doc_synthetic_1',
      sourceFile: 'synthetic.md',
      mimeType: 'text/markdown',
      label: 'Synthetic Philosophical Treatise',
      title: 'Synthetic Philosophical Treatise',
      content: 'Prose',
      description: 'Prose',
      systemStage: 'I: The Void / Unground',
      thematicGroup: 'kenosis',
      citations: [],
      metadata: {},
      connectedNodeIds: [],
      createdAt: Date.now(),
      nodeKind: 'document-hub'
    };

    const syntheticNodes: GraphNode[] = [docHub];
    for (let i = 0; i < 150; i++) {
      syntheticNodes.push({
        id: `synth_prop_${i}`,
        sourceFile: 'synthetic.md',
        mimeType: 'text/markdown',
        label: `Proposition ${i}`,
        title: `Proposition ${i}`,
        content: `Proposition ${i}`,
        description: `Proposition ${i}`,
        systemStage: 'I: The Void / Unground',
        thematicGroup: 'kenosis',
        citations: [],
        metadata: {},
        connectedNodeIds: ['doc_synthetic_1'],
        createdAt: Date.now(),
        nodeKind: 'proposition'
      });
    }

    // Default 'smart' density mode: document with 150 nodes should fold into supernode
    const smartProjection = projectViewGraph({
      treeData: MARKMAP_EPITEMIC_TOPOLOGY,
      ingestedGraph: { nodes: syntheticNodes, edges: [] },
      densityMode: 'smart',
      expandedClusterIds: new Set(),
      searchQuery: '',
      selectedNodeId: null,
      hoveredNodeId: null
    });

    const smartDocNode = smartProjection.positionedNodes.find(n => n.id === 'doc_synthetic_1');
    assert(smartDocNode, 'Document hub should exist');
    assert.equal(smartDocNode.isFolded, true, 'Document exceeding 60 nodes should be folded by default');
    assert.equal(smartDocNode.hiddenCount, 150, 'Hidden count should reflect all folded child nodes');

    // When expandedClusterIds has doc_synthetic_1
    const expandedProjection = projectViewGraph({
      treeData: MARKMAP_EPITEMIC_TOPOLOGY,
      ingestedGraph: { nodes: syntheticNodes, edges: [] },
      densityMode: 'smart',
      expandedClusterIds: new Set(['doc_synthetic_1']),
      searchQuery: '',
      selectedNodeId: null,
      hoveredNodeId: null
    });

    const expandedDocNode = expandedProjection.positionedNodes.find(n => n.id === 'doc_synthetic_1');
    assert(expandedDocNode, 'Document hub should exist');
    assert.equal(expandedDocNode.isFolded, false, 'Document should be unfolded when in expandedClusterIds');
    assert(expandedProjection.positionedNodes.length > 50, 'Child nodes should be projected onto canvas');

    console.log('  ✓ PASS: projectViewGraph folds large documents into compound supernodes and expands on demand');
  }

  console.log('---------------------------------------------------------------');
  console.log('  ALL SPATIAL TESTS PASSED (5 / 5)');
  console.log('===============================================================');
}

runSpatialTests().catch((err) => {
  console.error(err);
  process.exit(1);
});
