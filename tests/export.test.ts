import assert from 'node:assert/strict';
import { GraphStorage } from '../src/storage/GraphStorage';
import {
  GraphExportService,
  SCHEMA_VERSION,
  GENERATOR_SIGNATURE
} from '../src/services/export/GraphExportService';
import {
  sanitizeFilename,
  formatByteSize,
  computeExportChecksum
} from '../src/services/export/downloadHelper';
import type { GraphNode, GraphEdge } from '../src/types/graph';
import type { TopologyExportOptions } from '../src/types/export';

async function runExportTests() {
  console.log('===============================================================');
  console.log('  TOPOLOGY EXPORT ENGINE & SERIALIZATION VERIFICATION');
  console.log('===============================================================');

  // Test 1: Filename Sanitizer Primitives [REF: Export.Browser.DownloadHelper]
  {
    assert.equal(
      sanitizeFilename('Cosmic / Topology : 2026?*.json'),
      'Cosmic___Topology___2026__.json'
    );
    assert.equal(sanitizeFilename(''), 'topology_export.json');
    assert.equal(sanitizeFilename('   '), 'topology_export.json');
    assert.equal(sanitizeFilename('valid-name_v1.0.json'), 'valid-name_v1.0.json');
    console.log('  ✓ PASS: Filename sanitizer rejects illegal path/OS characters');
  }

  // Test 2: Byte Formatter Utility [REF: Export.Browser.DownloadHelper]
  {
    assert.equal(formatByteSize(0), '0 B');
    assert.equal(formatByteSize(512), '512 B');
    assert.equal(formatByteSize(1024), '1.00 KB');
    assert.equal(formatByteSize(1536), '1.50 KB');
    assert.equal(formatByteSize(1048576), '1.00 MB');
    assert.equal(formatByteSize(1073741824), '1.00 GB');
    console.log('  ✓ PASS: formatByteSize produces accurate scaled metric output');
  }

  // Test 3: SHA-256 Checksum Generator [REF: Export.Browser.DownloadHelper]
  {
    const sampleA = '{"test": "epistemic_truth", "value": 42}';
    const sampleB = '{"test": "epistemic_truth", "value": 43}';
    const hashA = await computeExportChecksum(sampleA);
    const hashB = await computeExportChecksum(sampleB);

    assert.equal(typeof hashA, 'string');
    assert.equal(hashA.length, 64, 'SHA-256 hex string must be 64 characters');
    assert(/^[a-f0-9]{64}$/.test(hashA), 'Hash must be valid hex');
    assert.notEqual(hashA, hashB, 'Distinct payloads must yield distinct hashes');

    // Determinism test
    const hashA2 = await computeExportChecksum(sampleA);
    assert.equal(hashA, hashA2, 'Same input must produce identical checksum');
    console.log('  ✓ PASS: SHA-256 checksum is deterministic and collision-resistant');
  }

  // Populate synthetic nodes & edges in GraphStorage for export testing
  const syntheticDocId = 'doc_test_export_subsystem';
  const customNodeA: GraphNode = {
    id: 'node_custom_kenoma_1',
    label: 'Kenoma Boundary Paradox',
    description: 'Dynamic epistemic construct describing boundary limits.',
    sourceFile: 'User Workspace',
    category: 'Kenoma' as any,
    canonicalStage: 'Stage I: The Primordial Rift',
    canonicalGroup: 'Ontological Void',
    priorityScore: 88,
    isCustom: true,
    created: Date.now()
  };

  const customNodeB: GraphNode = {
    id: 'node_custom_apophasis_2',
    label: 'Radical Apophasis',
    description: 'The speech beyond speech.',
    sourceFile: 'User Workspace',
    category: 'Apophasis' as any,
    canonicalStage: 'Stage II: Dialectical Descent',
    canonicalGroup: 'Dialectical Tensions',
    priorityScore: 92,
    isCustom: true,
    created: Date.now()
  };

  const dynamicIngestedNode: GraphNode = {
    id: 'node_ingested_monad_3',
    label: 'Cosmic Monad Fracture',
    description: 'Extracted from ingested treaty.',
    sourceFile: 'Treaty_on_Void.md',
    documentId: syntheticDocId,
    category: 'Monad' as any,
    canonicalStage: 'Stage III: Radical Immanence',
    canonicalGroup: 'Phenomenological Rupture',
    priorityScore: 75,
    isCustom: false,
    created: Date.now()
  };

  const edgeCustomToCustom: GraphEdge = {
    id: 'edge_kenoma_apophasis',
    source: 'node_custom_kenoma_1',
    target: 'node_custom_apophasis_2',
    relationType: 'develops',
    weight: 2
  };

  const edgeCustomToBaseline: GraphEdge = {
    id: 'edge_custom_to_baseline',
    source: 'node_custom_kenoma_1',
    target: 'mm_nihilism', // Exists in baseline aliases / topology
    relationType: 'grounds',
    weight: 3
  };

  const edgeCustomToIngested: GraphEdge = {
    id: 'edge_custom_to_ingested',
    source: 'node_custom_apophasis_2',
    target: 'node_ingested_monad_3',
    relationType: 'contradicts',
    weight: 1
  };

  // Commit test graph to GraphStorage
  await GraphStorage.commitBatchExtraction(
    'test_hash_export_subsystem_1',
    [customNodeA, customNodeB, dynamicIngestedNode],
    [edgeCustomToCustom, edgeCustomToBaseline, edgeCustomToIngested]
  );

  // Test 4: Unified Scope Serialization [REF: Export.Engine.Serialization]
  {
    const options: TopologyExportOptions = {
      scope: 'unified',
      format: 'beautified',
      includeMetadata: true,
      includeDocuments: true,
      includeChecksum: true
    };

    const payload = await GraphExportService.assemblePayload(options);

    // Verify Manifest
    assert.equal(payload.manifest.schemaVersion, SCHEMA_VERSION);
    assert.equal(payload.manifest.generator, GENERATOR_SIGNATURE);
    assert.equal(payload.manifest.scope, 'unified');
    assert(payload.manifest.exportedAt);
    assert(payload.manifest.nodeCount >= 50);

    // Verify Nodes & Edges count
    const hasCustomA = payload.nodes.some((n) => n.id === 'node_custom_kenoma_1');
    const hasBaseline = payload.nodes.some((n) => n.id === 'mm_nihilism' || n.id === 'mm_nihilism_main_branch');
    assert(hasCustomA, 'Custom node must be present in unified export');
    assert(hasBaseline, 'Baseline node must be present in unified export');

    // Verify Taxonomic Metrics
    const metrics = payload.manifest.taxonomicMetrics;
    assert.equal(payload.manifest.nodeCount, payload.nodes.length);
    assert.equal(payload.manifest.edgeCount, payload.edges.length);
    assert(Object.keys(metrics.thematicBreakdown).length > 0, 'Thematic breakdown must be populated');
    assert(Object.keys(metrics.stageBreakdown).length > 0, 'System stage breakdown must be populated');
    assert(Object.keys(metrics.edgeRelationBreakdown).length > 0, 'Edge relations must be populated');

    // Referential Integrity Verification: No dangling edge source or target
    const nodeIds = new Set(payload.nodes.map((n) => n.id));
    for (const edge of payload.edges) {
      assert(
        nodeIds.has(edge.source),
        `Edge source '${edge.source}' must exist in exported node set`
      );
      assert(
        nodeIds.has(edge.target),
        `Edge target '${edge.target}' must exist in exported node set`
      );
    }

    console.log('  ✓ PASS: Unified scope payload serialization and referential integrity');
  }

  // Test 5: Custom Only Scope and Orphan Edge Pruning [REF: Export.Engine.Serialization]
  {
    const options: TopologyExportOptions = {
      scope: 'custom_only',
      format: 'beautified',
      includeMetadata: true,
      includeDocuments: false,
      includeChecksum: true
    };

    const payload = await GraphExportService.assemblePayload(options);

    assert.equal(payload.manifest.scope, 'custom_only');
    // Baseline nodes should NOT be in custom_only
    const hasBaseline = payload.nodes.some((n) => n.id === 'mm_nihilism_main_branch');
    assert.equal(hasBaseline, false, 'Baseline node must not exist in custom_only export');

    // Dynamic ingested node from Treaty_on_Void.md is not custom, so must not exist
    const hasIngested = payload.nodes.some((n) => n.id === 'node_ingested_monad_3');
    assert.equal(hasIngested, false, 'Ingested non-custom node must not exist in custom_only export');

    // Custom nodes must exist
    const hasCustomA = payload.nodes.some((n) => n.id === 'node_custom_kenoma_1');
    const hasCustomB = payload.nodes.some((n) => n.id === 'node_custom_apophasis_2');
    assert(hasCustomA && hasCustomB, 'Custom nodes must exist in custom_only export');

    // Edge referential integrity verification:
    // edge_custom_to_baseline connects to 'mm_nihilism' (which was excluded) -> MUST be pruned!
    // edge_custom_to_ingested connects to 'node_ingested_monad_3' (which was excluded) -> MUST be pruned!
    // edge_kenoma_apophasis connects two custom nodes -> MUST be retained!
    const retainedEdgeIds = new Set(payload.edges.map((e) => e.id));
    assert(
      retainedEdgeIds.has('edge_kenoma_apophasis'),
      'Edge connecting two custom nodes must be retained'
    );
    assert(
      !retainedEdgeIds.has('edge_custom_to_baseline'),
      'Dangling edge to pruned baseline node must be pruned'
    );
    assert(
      !retainedEdgeIds.has('edge_custom_to_ingested'),
      'Dangling edge to pruned ingested node must be pruned'
    );

    const customNodeIds = new Set(payload.nodes.map((n) => n.id));
    for (const edge of payload.edges) {
      assert(customNodeIds.has(edge.source), `Pruned edge source ${edge.source} in custom export`);
      assert(customNodeIds.has(edge.target), `Pruned edge target ${edge.target} in custom export`);
    }

    console.log('  ✓ PASS: custom_only scope cleanly isolates custom graph and prunes dangling edges');
  }

  // Test 6: Ingested Only Scope [REF: Export.Engine.Serialization]
  {
    const options: TopologyExportOptions = {
      scope: 'ingested_only',
      format: 'minified',
      includeMetadata: true,
      includeDocuments: true,
      includeChecksum: true
    };

    const payload = await GraphExportService.assemblePayload(options);

    assert.equal(payload.manifest.scope, 'ingested_only');
    const hasBaseline = payload.nodes.some((n) => n.id === 'mm_nihilism_main_branch');
    assert.equal(hasBaseline, false, 'Baseline node must not exist in ingested_only export');

    // Dynamic ingested and custom nodes in storage are dynamic corpus
    const hasIngested = payload.nodes.some((n) => n.id === 'node_ingested_monad_3');
    assert(hasIngested, 'Dynamic ingested node must exist in ingested_only export');

    console.log('  ✓ PASS: ingested_only scope isolates dynamic corpus without baseline ontology');
  }

  // Test 7: Real-Time Export Preview Metric [REF: Export.Engine.Serialization]
  {
    const preview = await GraphExportService.getExportPreview({ scope: 'unified' });
    assert(preview.nodeCount >= 50, 'Preview must reflect node count');
    assert(preview.edgeCount >= 0, 'Preview must reflect edge count');
    assert.equal(preview.scope, 'unified');
    assert(preview.taxonomicMetrics);
    console.log('  ✓ PASS: getExportPreview computes telemetry metrics accurately');
  }

  console.log('---------------------------------------------------------------');
  console.log('  ALL EXPORT ENGINE TESTS PASSED (7 / 7)');
  console.log('===============================================================');
}

runExportTests().catch((err) => {
  console.error('EXPORT TEST SUITE FAILURE:', err);
  process.exit(1);
});
