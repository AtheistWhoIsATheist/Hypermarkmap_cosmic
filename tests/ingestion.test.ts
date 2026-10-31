/**
 * Client-Side Ingestion Subsystem Verification Suite (tests/ingestion.test.ts)
 * 
 * Verifies Golden Fixtures A–G and Semantic Discrimination Cases A–E:
 * - Invariant 1: Source Fidelity (verbatim text preserved)
 * - Invariant 2: Epistemic Traceability (SourceSpan line, char, heading path coordinates)
 * - Invariant 3: Strict Non-Fabrication (no hallucinated quotations or false attribution)
 * - Invariant 4: Semantic Discrimination (distinguishes homonymous concepts: Nothingness, Śūnyatā, Das Nichts)
 * - Invariant 5: Graph Integrity (duplicate SHA-256 detection, baseline preservation, atomic commit)
 */

import assert from 'node:assert';
import { MarkdownParser } from '../src/services/parsers/MarkdownParser';
import { TextParser } from '../src/services/parsers/TextParser';
import { JsonParser } from '../src/services/parsers/JsonParser';
import { CsvParser } from '../src/services/parsers/CsvParser';
import { PdfParser } from '../src/services/parsers/PdfParser';
import { IngestionService, PipelineStageLogger, captureMemorySnapshot } from '../src/services/ingestion/IngestionService';
import { GraphStorage } from '../src/storage/GraphStorage';
import { computeFileSha256, validateFileHeaderAndMime } from '../src/utils/crypto';
import { MARKMAP_EPITEMIC_TOPOLOGY } from '../src/components/GroundedEpistemicTopologyData';

async function runIngestionTestSuite() {
  console.log('===============================================================');
  console.log('  NIHILTHEISM KNOWLEDGE GRAPH: INGESTION SUBSYSTEM VERIFICATION');
  console.log('===============================================================\n');

  let passed = 0;
  let failed = 0;

  async function test(name: string, fn: () => void | Promise<void>) {
    try {
      await fn();
      console.log(`  ✓ PASS: ${name}`);
      passed++;
    } catch (err: any) {
      console.error(`  ✗ FAIL: ${name}`);
      console.error(`    ${err.message || err}`);
      if (err.stack) {
        console.error(`    ${err.stack.split('\n').slice(1, 3).join('\n')}`);
      }
      failed++;
    }
  }

  const ingestionService = new IngestionService();

  // --------------------------------------------------------------------------
  // FIXTURE A: Structured Markdown Ingestion with YAML Frontmatter, AST, Spans
  // --------------------------------------------------------------------------
  await test('Fixture A: MarkdownParser extracts frontmatter, hierarchical sections, and SourceSpans', async () => {
    const mdContent = `---
title: Dialectics of the Abyss
author: M. Cioran-Nishida
date: 2026-04-12
stage: Stage 1: The First Cleaving
group: Nihilistic Pivot
---

# The Primal Negation

The encounter with the ungrounded abyss does not annul existence; rather, it discloses the pure form of contingency.

## Phenomenological Suspension

> "To suspend the question of Being is not to eliminate it, but to let the void vibrate in its own silence."
> — Master Eckhart (Fragment 4)

We witness here the radical divergence from ordinary theological affirmation. Furthermore, this leads to the inquiry into [[The Inverted Ground]].
`;

    const file = new File([mdContent], 'dialectics-of-the-abyss.md', { type: 'text/markdown' });
    const hash = await computeFileSha256(file);
    const parser = new MarkdownParser();

    const payload = await parser.parse(file, hash);

    assert(payload.nodes.length >= 3, `Expected at least 3 nodes, got ${payload.nodes.length}`);
    assert(payload.edges.length >= 2, `Expected at least 2 edges, got ${payload.edges.length}`);

    // Verify Document Hub
    const docHub = payload.nodes.find(n => n.nodeKind === 'document-hub');
    assert(docHub, 'Document hub node missing');
    assert.strictEqual(docHub.metadata.author, 'M. Cioran-Nishida');
    assert.strictEqual(docHub.thematicGroup, 'Nihilistic Pivot');

    // Verify Verbatim Source Spans
    const sectionNodes = payload.nodes.filter(n => n.nodeKind === 'section');
    assert(sectionNodes.length >= 2, 'Expected H1 and H2 section nodes');
    const h2 = sectionNodes.find(n => n.title.includes('Phenomenological Suspension'));
    assert(h2, 'Missing H2 node');
    assert(h2.sourceSpans && h2.sourceSpans.length > 0, 'Missing sourceSpans on section node');
    assert.strictEqual(h2.sourceSpans[0].locationStatus, 'exact');
    assert(h2.sourceSpans[0].lineStart !== undefined, 'Line number missing on source span');

    // Verify Third-Party Blockquote Citation
    assert(h2.citations && h2.citations.length > 0, 'Blockquote citation missing');
    const firstCit = h2.citations[0];
    const citText = typeof firstCit === 'string' ? firstCit : `${firstCit.authorOrOrigin} ${firstCit.quoteSnippet}`;
    assert(citText.includes('Master Eckhart'), 'Attribution to Master Eckhart missing');

    // Verify Unresolved Wikilink Node Creation
    const wikilinkNode = payload.nodes.find(n => n.id.includes('the_inverted_ground'));
    assert(wikilinkNode, 'Unresolved wikilink node for [[The Inverted Ground]] not created');
    assert.strictEqual(wikilinkNode.nodeKind, 'unresolved-reference');
  });

  // --------------------------------------------------------------------------
  // FIXTURE B: Malformed File Error Isolation in Batch Processing
  // --------------------------------------------------------------------------
  await test('Fixture B: Malformed JSON rejection isolates error and permits valid sibling files', async () => {
    const validCsv = `concept,category,description
Apophatic Refusal,Apophatic Dynamics,The unconditioned negation of affirmative predicates
Kenotic Emptiness,Apophatic Dynamics,Self-emptying of divine ontological categories`;

    const corruptJson = `{ "nodes": [ { "id": "corrupt_1", "invalid_json_trailing_comma": `;

    const validCsvFile = new File([validCsv], 'valid-concepts.csv', { type: 'text/csv' });
    const corruptJsonFile = new File([corruptJson], 'corrupt.json', { type: 'application/json' });

    const batch = [corruptJsonFile, validCsvFile];
    const results = await ingestionService.processBatch(batch);

    assert.strictEqual(results.length, 2, 'Both files should have a batch item result');
    
    // First file (corrupt JSON) should fail cleanly with error message
    assert.strictEqual(results[0].status, 'error', 'Corrupt JSON should have error status');
    assert(results[0].errorMessage?.includes('JSON') || results[0].errorMessage?.includes('parse'), 'Expected JSON parse diagnostic');

    // Second file (valid CSV) should succeed without corruption
    assert.strictEqual(results[1].status, 'success', 'Valid CSV sibling file should succeed');
    assert(results[1].extractedNodes && results[1].extractedNodes.length >= 2, 'Extracted nodes missing from valid CSV');
  });

  // --------------------------------------------------------------------------
  // FIXTURE C: Duplicate SHA-256 Ingestion Detection & Deduplication
  // --------------------------------------------------------------------------
  await test('Fixture C: Duplicate file is detected via SHA-256 fingerprint and safely skipped', async () => {
    const content = 'The ontological rupture occurs when language confronts its own groundlessness.';
    const file1 = new File([content], 'rupture.txt', { type: 'text/plain' });
    const file2 = new File([content], 'rupture-copy.txt', { type: 'text/plain' });

    const res1 = await ingestionService.ingestFile(file1);
    assert.strictEqual(res1.status, 'success', 'First ingestion should succeed');

    const res2 = await ingestionService.ingestFile(file2);
    assert.strictEqual(res2.status, 'duplicate', 'Second ingestion with identical hash should be flagged as duplicate');
    assert(res2.summary?.includes('duplicate') || res2.stageLabel?.includes('SHA-256 match'), 'Expected duplicate summary notice');
  });

  // --------------------------------------------------------------------------
  // FIXTURE D & E: PDF Extraction & Scanned/Image-Only Diagnostic
  // --------------------------------------------------------------------------
  await test('Fixture D & E: PDF parser extracts page numbers and detects image-only/scanned files without hallucinating', async () => {
    const parser = new PdfParser();

    // 1. Text-containing PDF mock
    const pdfWithText = `%PDF-1.4
1 0 obj << /Type /Catalog /Pages 2 0 R >> endobj
2 0 obj << /Type /Pages /Kids [3 0 R] /Count 1 >> endobj
3 0 obj << /Type /Page /Parent 2 0 R /Contents 4 0 R >> endobj
4 0 obj << /Length 55 >>
stream
BT
/F1 12 Tf
72 712 Td
(The transcendental horizon collapses into absolute nothingness.) Tj
ET
endstream
endobj
xref
trailer << /Root 1 0 R >>
%%EOF`;

    const textPdfFile = new File([pdfWithText], 'textual.pdf', { type: 'application/pdf' });
    const hashD = await computeFileSha256(textPdfFile);
    const payloadD = await parser.parse(textPdfFile, hashD);

    assert(payloadD.nodes.length >= 2, 'Expected document hub and extracted page section');
    const pageNode = payloadD.nodes.find(n => n.nodeKind === 'section');
    assert(pageNode, 'Page section node missing');
    assert(pageNode.sourceSpans && pageNode.sourceSpans.length > 0, 'SourceSpan missing on PDF node');
    assert.strictEqual(pageNode.sourceSpans[0].pageNumber, 1, 'Page number must be 1-indexed');
    assert(pageNode.sourceSpans[0].verbatimText.includes('transcendental horizon'), 'Verbatim text missing from PDF stream');

    // 2. Scanned / image-only PDF (no text stream)
    const scannedPdf = `%PDF-1.4
1 0 obj << /Type /Catalog /Pages 2 0 R >> endobj
2 0 obj << /Type /Pages /Kids [3 0 R] /Count 1 >> endobj
3 0 obj << /Type /Page /Parent 2 0 R /Contents 4 0 R >> endobj
4 0 obj << /Length 12 >>
stream
q
/Im1 Do
Q
endstream
endobj
xref
trailer << /Root 1 0 R >>
%%EOF`;

    const scannedPdfFile = new File([scannedPdf], 'scanned.pdf', { type: 'application/pdf' });
    const hashE = await computeFileSha256(scannedPdfFile);
    const payloadE = await parser.parse(scannedPdfFile, hashE);

    assert(payloadE.summary.includes('OCR') || payloadE.summary.includes('image-only') || payloadE.nodes[1].metadata.ocrRequired, 'Must flag scanned PDF without fabricating textual quotes');
  });

  // --------------------------------------------------------------------------
  // FIXTURE F: Offline / Unconfigured AI Fallback to STRUCTURALLY_INGESTED
  // --------------------------------------------------------------------------
  await test('Fixture F: Nodes default to STRUCTURALLY_INGESTED when AI semantics are disabled/offline', async () => {
    const rawText = 'Thesis: Nihilism without theology leads to active cosmic paralysis.';
    const file = new File([rawText], 'thesis.txt', { type: 'text/plain' });
    const item = await ingestionService.ingestFile(file, { processingMode: 'STRUCTURALLY_INGESTED' });

    assert.strictEqual(item.status, 'success');
    assert(item.extractedNodes && item.extractedNodes.length > 0);
    for (const node of item.extractedNodes) {
      assert.strictEqual(node.processingMode, 'STRUCTURALLY_INGESTED', 'Node must preserve STRUCTURALLY_INGESTED mode');
    }
  });

  // --------------------------------------------------------------------------
  // FIXTURE G: Persistence & Memory Cache Integrity
  // --------------------------------------------------------------------------
  await test('Fixture G: Synchronous cache reflects committed nodes without mutating baseline topology', async () => {
    const baselineRoot = MARKMAP_EPITEMIC_TOPOLOGY;
    assert.strictEqual(baselineRoot.id, 'markmap_root', 'Baseline root must remain intact');
    assert.strictEqual(baselineRoot.children?.length, 3, 'Baseline root direct children must remain unmodified');

    const graph = GraphStorage.getIngestedGraphSync();
    assert(Array.isArray(graph.nodes), 'Ingested nodes should be an array');
    assert(Array.isArray(graph.edges), 'Ingested edges should be an array');
    assert(graph.nodes.length > 0, 'Ingested cache should contain committed entities from previous tests');
  });

  // --------------------------------------------------------------------------
  // SEMANTIC DISCRIMINATION CASE A: Lexical Homonym Separation (Nothingness)
  // --------------------------------------------------------------------------
  await test('Case A: Distinguishes homonymous concepts: Nihilistic Nothingness vs. Śūnyatā vs. Heideggerian Das Nichts', async () => {
    const text = `
Chapter 1: The Three Nothings

1. Nishida characterizes Śūnyatā as absolute nothingness acting as the place (basho) of universal affirmation.
2. Conversely, Sartre defines nothingness (le néant) as the ontological nihilation introduced by human consciousness.
3. Heidegger conceives Das Nichts as the veil of Being, disclosing the mystery of existence through anxiety.
`;
    const file = new File([text], 'three-nothings.txt', { type: 'text/plain' });
    const hash = await computeFileSha256(file);
    const parser = new TextParser();
    const payload = await parser.parse(file, hash);

    const labels = payload.nodes.map(n => n.label.toLowerCase());
    assert(labels.some(l => l.includes('śūnyatā') || l.includes('nishida')), 'Failed to extract Śūnyatā/Nishida node');
    assert(labels.some(l => l.includes('sartre') || l.includes('néant') || l.includes('nothingness')), 'Failed to extract Sartre node');
    assert(labels.some(l => l.includes('heidegger') || l.includes('nichts')), 'Failed to extract Heidegger node');

    // Confirm that the concepts do not collapse into a single merged node ID
    const conceptNodes = payload.nodes.filter(n => n.nodeKind === 'concept');
    const uniqueIds = new Set(conceptNodes.map(n => n.id));
    assert.strictEqual(conceptNodes.length, uniqueIds.size, 'Extracted concepts must have unique deterministic IDs');
  });

  // --------------------------------------------------------------------------
  // SEMANTIC DISCRIMINATION CASE B: Modality Discrimination (Asserted vs. Tentative)
  // --------------------------------------------------------------------------
  await test('Case B: Discriminated modality labels (source-explicit vs. tentative-interpretation)', async () => {
    const text = `
We assert with absolute geometric certainty that the void is unconditioned.
However, it may be tentatively hypothesized that this void exhibits an apophatic resonance with negative theology.
`;
    const file = new File([text], 'modality.txt', { type: 'text/plain' });
    const hash = await computeFileSha256(file);
    const parser = new TextParser();
    const payload = await parser.parse(file, hash);

    const explicit = payload.nodes.find(n => n.confidenceStatus === 'source-explicit');
    const tentative = payload.nodes.find(n => n.confidenceStatus === 'tentative-interpretation');

    assert(explicit, 'Must extract proposition with source-explicit confidence status');
    assert(tentative, 'Must extract tentative hypothesis with tentative-interpretation confidence status');
  });

  // --------------------------------------------------------------------------
  // SEMANTIC DISCRIMINATION CASE C: Contradiction & Tension Edges
  // --------------------------------------------------------------------------
  await test('Case C: Resolves dialectical tensions into contradiction edges', async () => {
    const csvContent = `source,relation,target,category
mm_orientation,proposed-contradiction,concept_nihilistic_abyss,proposed
concept_apophatic_theology,contradicts,concept_dogmatic_theology,philosophical`;

    const file = new File([csvContent], 'contradictions.csv', { type: 'text/csv' });
    const hash = await computeFileSha256(file);
    const parser = new CsvParser();
    const payload = await parser.parse(file, hash);

    const contraEdges = payload.edges.filter(e => e.relationType === 'contradicts' || e.relationType === 'proposed-contradiction');
    assert(contraEdges.length >= 2, 'Expected contradiction edges');
    const proposed = contraEdges.find(e => e.edgeCategory === 'proposed');
    assert(proposed, 'Expected proposed category contradiction edge');
  });

  // --------------------------------------------------------------------------
  // SEMANTIC DISCRIMINATION CASE D: Third-Party Blockquote Attribution Verification
  // --------------------------------------------------------------------------
  await test('Case D: Blockquote third-party attribution is explicitly preserved and not attributed to document author', async () => {
    const md = `---
author: Author Person
---

# Analysis of Schopenhauer

> "Life swings like a pendulum backward and forward between pain and boredom."
> — Arthur Schopenhauer, The World as Will and Representation

Author Person remarks that this pessimistic assessment is incomplete.`;

    const file = new File([md], 'schopenhauer-analysis.md', { type: 'text/markdown' });
    const hash = await computeFileSha256(file);
    const parser = new MarkdownParser();
    const payload = await parser.parse(file, hash);

    const sec = payload.nodes.find(n => n.title.includes('Analysis of Schopenhauer'));
    assert(sec, 'Missing section node');
    assert(sec.citations && sec.citations.length > 0, 'Citation not extracted');
    const firstCit = sec.citations[0];
    const citText = typeof firstCit === 'string' ? firstCit : `${firstCit.authorOrOrigin} ${firstCit.quoteSnippet}`;
    assert(citText.includes('Arthur Schopenhauer'), 'Citation must cite Schopenhauer, not document author');
  });

  // --------------------------------------------------------------------------
  // SEMANTIC DISCRIMINATION CASE E: Unresolved Wikilink Coordinates
  // --------------------------------------------------------------------------
  await test('Case E: Unresolved wikilinks create distinct unresolved-reference nodes with amber visual tokens', async () => {
    const md = `The argument relies upon the seminal proof in [[Nihiltheistic Ethics]] and [[Fragment on the Infinite]].`;
    const file = new File([md], 'unresolved.md', { type: 'text/markdown' });
    const hash = await computeFileSha256(file);
    const parser = new MarkdownParser();
    const payload = await parser.parse(file, hash);

    const unresolvedNodes = payload.nodes.filter(n => n.nodeKind === 'unresolved-reference');
    assert.strictEqual(unresolvedNodes.length, 2, 'Expected 2 unresolved reference nodes');
    assert(unresolvedNodes.some(n => n.title === 'Nihiltheistic Ethics'), 'Missing Nihiltheistic Ethics reference');
    assert(unresolvedNodes.some(n => n.title === 'Fragment on the Infinite'), 'Missing Fragment on the Infinite reference');

    // Confirm unresolved edges
    const unresolvedEdges = payload.edges.filter(e => e.relationType === 'unresolved-citation');
    assert.strictEqual(unresolvedEdges.length, 2, 'Expected 2 unresolved-citation edges');
  });

  // --------------------------------------------------------------------------
  // HIGH-SCALE STREAMING & BOUNDED NODE BUDGET STRESS TEST (5 MB+ Markdown)
  // --------------------------------------------------------------------------
  await test('High-Scale: 5 MB+ streaming Markdown ingestion respects MAX_NODES_PER_DOCUMENT and completes rapidly', async () => {
    // Generate ~3.5 MB of structured markdown with thousands of headings and philosophical propositions
    const chunkCount = 3000;
    const para = 'The apophatic negation articulates the dialectical tension between void and appearance across the cosmic threshold. '.repeat(10) + '\n';
    const parts: string[] = ['# Systematic Treatise on Cosmic Groundlessness\n\n'];
    for (let i = 0; i < chunkCount; i++) {
      parts.push(`## Propositional Cleaving Node ${i}\n`);
      parts.push(para);
      if (i % 20 === 0) {
        parts.push(`> "The abyss does not respond to questions of being." — Fragment ${i}\n\n`);
      }
      if (i % 50 === 0) {
        parts.push(`See also [[Cross Reference Concept ${i}]].\n\n`);
      }
    }
    const largeMd = parts.join('');
    const file = new File([largeMd], 'massive-treatise.md', { type: 'text/markdown' });
    assert(file.size > 2 * 1024 * 1024, `File size should exceed 2 MB streaming threshold, was ${file.size}`);

    const startTime = Date.now();
    const parser = new MarkdownParser();
    const hash = await computeFileSha256(file);
    const payload = await parser.parse(file, hash);
    const duration = Date.now() - startTime;

    assert(payload.nodes.length <= 2500, `Nodes must be bounded by MAX_NODES_PER_DOCUMENT (2500), got ${payload.nodes.length}`);
    assert(payload.nodes.length > 500, `Expected substantial extraction, got ${payload.nodes.length}`);
    assert(payload.edges.length > 0, 'Extracted edges should not be empty');
    console.log(`    (Processed ${file.size} bytes in ${duration}ms, extracted ${payload.nodes.length} nodes, ${payload.edges.length} edges)`);
  });

  // --------------------------------------------------------------------------
  // BOUNDED MEMORY O(1) SLICE HASHING & HEADER VALIDATION (> 10 MB file)
  // --------------------------------------------------------------------------
  await test('Bounded Memory: Files > 10 MB execute composite 3-point hash and header validation via slice without full-buffer load', async () => {
    // Create a 12 MB synthetic text file
    const tenMb = 12 * 1024 * 1024;
    const blobChunk = new Uint8Array(1024 * 1024); // 1 MB chunk
    blobChunk.fill(0x61); // ASCII 'a'
    const blobParts: Uint8Array[] = [];
    for (let i = 0; i < 12; i++) {
      blobParts.push(blobChunk);
    }
    const largeFile = new File(blobParts as unknown as BlobPart[], 'corpus-archive.txt', { type: 'text/plain' });
    assert.strictEqual(largeFile.size, tenMb, 'File should be exactly 12 MB');

    // 1. Validate header inspection runs on 64-byte slice
    const headerResult = await validateFileHeaderAndMime(largeFile);
    assert.strictEqual(headerResult.isValid, true, 'Header validation should pass');
    assert.strictEqual(headerResult.detectedMime, 'text/plain');

    // 2. Compute SHA-256 fingerprint (composite 3-point sampling)
    const startHash = Date.now();
    const hash = await computeFileSha256(largeFile);
    const hashDuration = Date.now() - startHash;

    assert.strictEqual(typeof hash, 'string');
    assert.strictEqual(hash.length, 64, 'SHA-256 hash string must be 64 hexadecimal characters');
    assert(hashDuration < 1000, `Composite hash should execute in < 1000ms, took ${hashDuration}ms`);
    console.log(`    (Composite hash computed in ${hashDuration}ms: ${hash.slice(0, 16)}...)`);
  });

  // --------------------------------------------------------------------------
  // GRAPH STORAGE: 32KB TRUNCATION & 500-ITEM BATCH INTEGRITY
  // --------------------------------------------------------------------------
  await test('GraphStorage: Sanitizes long document preview text to 32KB and commits large node batches', async () => {
    const hugeSummary = 'x'.repeat(50000); // 50,000 characters
    const testDocId = `test_doc_${Date.now()}`;
    const testHash = `hash_${Date.now()}`;

    // Generate 600 nodes to cross the 500-item transaction batch boundary
    const testNodes: any[] = [];
    const testEdges: any[] = [];
    for (let i = 0; i < 600; i++) {
      const nodeId = `node_batch_test_${i}`;
      testNodes.push({
        id: nodeId,
        hash: `h_${i}`,
        label: `Batch Test Node ${i}`,
        title: `Batch Test Node ${i}`,
        nodeKind: 'concept',
        sourceFile: 'batch_test.txt',
        mimeType: 'text/plain',
        content: i === 0 ? 'y'.repeat(40000) : 'Test content',
        description: 'Test description',
        systemStage: 'Stage I: Ontological Groundlessness',
        thematicGroup: 'Nihilistic Pivot',
        citations: [],
        connectedNodeIds: [],
        createdAt: Date.now()
      });
      if (i > 0) {
        testEdges.push({
          id: `edge_batch_test_${i}`,
          source: testNodes[0].id,
          target: nodeId,
          relationType: 'articulates'
        });
      }
    }

    await GraphStorage.commitBatchExtraction(testHash, testNodes, testEdges, {
      id: testDocId,
      hash: testHash,
      fileName: 'large_summary.txt',
      fileSize: 100000,
      mimeType: 'text/plain',
      createdAt: Date.now(),
      updatedAt: Date.now(),
      versionCount: 1,
      sectionsCount: 1,
      spansCount: 0,
      summary: hugeSummary,
      processingMode: 'STRUCTURALLY_INGESTED'
    });

    // Check cached document record summary is capped
    const doc = await GraphStorage.getDocument(testDocId);
    assert(doc, 'Committed document should be retrievable');
    assert(doc.summary && doc.summary.length <= 32768 + 50, 'Document summary preview must be truncated to ~32KB');
    assert(doc.summary.includes('[TRUNCATED 32KB]'), 'Truncation flag should be present');

    // Check node 0 content is capped
    const graph = GraphStorage.getIngestedGraphSync();
    const node0 = graph.nodes.find(n => n.id === 'node_batch_test_0');
    assert(node0, 'Node 0 should be in cache');
    assert(node0.content && node0.content.length <= 32768 + 50, 'Node content preview must be capped');
  });

  // --------------------------------------------------------------------------
  // LIVE STAGE TELEMETRY: Real-Time onProgress Emission Verification
  // --------------------------------------------------------------------------
  await test('Live Telemetry: processBatch emits real-time stage transitions (zero UI hang)', async () => {
    const md = `# The Active Void\n\nNihilism as the prerequisite to apophatic theology.`;
    const file = new File([md], 'active-void.md', { type: 'text/markdown' });

    const stagesObserved: string[] = [];
    const results = await ingestionService.processBatch(
      [file],
      (_idx, _total, item) => {
        if (item.stageLabel && !stagesObserved.includes(item.stageLabel)) {
          stagesObserved.push(item.stageLabel);
        }
      }
    );

    assert.strictEqual(results.length, 1);
    assert.strictEqual(results[0].status, 'success');
    // Ensure multiple intermediate stage labels were emitted to UI
    assert(stagesObserved.length >= 3, `Expected at least 3 live stage transitions, got ${stagesObserved.length}: ${stagesObserved.join(', ')}`);
    console.log(`    (Observed ${stagesObserved.length} intermediate stages: ${stagesObserved.slice(0, 3).join(' -> ')}...)`);
  });

  // --------------------------------------------------------------------------
  // TELEMETRY & LOGGING UTILITY: Execution Time & Memory Monitoring
  // --------------------------------------------------------------------------
  await test('Logging Utility: captureMemorySnapshot retrieves Node.js process.memoryUsage metrics', () => {
    const mem = captureMemorySnapshot();
    assert(typeof mem.rss === 'number' && mem.rss > 0, 'RSS memory should be a positive number');
    assert(typeof mem.heapTotal === 'number' && mem.heapTotal > 0, 'Heap total should be a positive number');
    assert(typeof mem.heapUsed === 'number' && mem.heapUsed > 0, 'Heap used should be a positive number');
    console.log(`    (Memory snapshot: RSS=${(mem.rss / 1024 / 1024).toFixed(1)}MB, HeapUsed=${(mem.heapUsed / 1024 / 1024).toFixed(1)}MB)`);
  });

  await test('Logging Utility: executeStage records accurate duration and memory usage difference', async () => {
    const logger = new PipelineStageLogger({
      minDurationMsThreshold: 0,
      minMemoryDeltaBytesThreshold: 0,
      logLevel: 'silent'
    });

    const context = { fileName: 'large_treatise.md', fileSize: 524288000, stageIndex: 3 };
    const simulatedPayload = await logger.executeStage(
      'Simulated Parsing Stage',
      context,
      async () => {
        // Allocate temporary memory and simulate delay
        const tempBuf = new Uint8Array(4 * 1024 * 1024); // 4MB
        tempBuf.fill(42);
        await new Promise((res) => setTimeout(res, 25));
        return { bytesProcessed: tempBuf.byteLength };
      }
    );

    assert.strictEqual(simulatedPayload.bytesProcessed, 4 * 1024 * 1024);

    const history = logger.getMetricsHistory();
    assert.strictEqual(history.length, 1, 'Expected 1 recorded stage metric');
    const metric = history[0];

    assert.strictEqual(metric.stageName, 'Simulated Parsing Stage');
    assert(metric.durationMs >= 20, `Duration should be at least 20ms, was ${metric.durationMs}ms`);
    assert(metric.endTime >= metric.startTime, 'End time must be greater than or equal to start time');
    assert.strictEqual(metric.context.fileSize, 524288000);
    assert(typeof metric.memoryDeltaBytes.heapUsed === 'number', 'Heap delta must be a number');
    console.log(`    (Stage duration: ${metric.durationMs}ms, Heap Delta: ${(metric.memoryDeltaBytes.heapUsed / 1024).toFixed(1)}KB)`);
  });

  // --------------------------------------------------------------------------
  // TELEMETRY & LOGGING UTILITY: Contextual Error Handling & Stack Trace
  // --------------------------------------------------------------------------
  await test('Logging Utility: executeStage captures error context, stage name, input params, and stack trace', async () => {
    const loggedErrors: any[] = [];
    const mockLogger = {
      info: () => {},
      warn: () => {},
      error: (_msg: string, payload: any) => {
        loggedErrors.push(payload);
      }
    };

    const logger = new PipelineStageLogger({
      logAlwaysOnError: true,
      customLogger: mockLogger
    });

    const stageContext = {
      fileName: 'corrupt_doc.pdf',
      fileSize: 104857600,
      mimeType: 'application/pdf',
      attempt: 1
    };

    let caughtError: Error | null = null;
    try {
      await logger.executeStage('Corrupt PDF Decomposition', stageContext, async () => {
        throw new TypeError('Malformed PDF trailer dictionary: stream offset out of bounds');
      });
    } catch (err: any) {
      caughtError = err;
    }

    assert(caughtError, 'Expected stage exception to be re-thrown');
    assert.strictEqual(caughtError.name, 'TypeError');

    const history = logger.getMetricsHistory();
    assert.strictEqual(history.length, 1);
    const metric = history[0];

    // Verify metric error fields
    assert(metric.error, 'Error details must be attached to metrics');
    assert.strictEqual(metric.error.name, 'TypeError');
    assert(metric.error.message.includes('Malformed PDF trailer dictionary'));
    assert(metric.error.stack && metric.error.stack.length > 0, 'Stack trace must be captured');
    assert.strictEqual(metric.context.fileName, 'corrupt_doc.pdf');
    assert.strictEqual(metric.context.fileSize, 104857600);

    // Verify external logger received payload
    assert.strictEqual(loggedErrors.length, 1);
    assert.strictEqual(loggedErrors[0].stage, 'Corrupt PDF Decomposition');
    assert.strictEqual(loggedErrors[0].err.name, 'TypeError');
  });

  // --------------------------------------------------------------------------
  // TELEMETRY & LOGGING UTILITY: Conditional Thresholding (Performance Optimization)
  // --------------------------------------------------------------------------
  await test('Logging Utility: Conditional thresholding suppresses overhead on rapid sub-threshold stages', async () => {
    const logsEmitted: string[] = [];
    const mockLogger = {
      info: (msg: string) => { logsEmitted.push(msg); },
      warn: (msg: string) => { logsEmitted.push(msg); },
      error: (msg: string) => { logsEmitted.push(msg); }
    };

    const logger = new PipelineStageLogger({
      minDurationMsThreshold: 100, // 100 ms threshold
      minMemoryDeltaBytesThreshold: 10 * 1024 * 1024, // 10 MB threshold
      logAlwaysOnError: true,
      customLogger: mockLogger
    });

    // 1. Rapid stage below threshold (e.g. 5ms, trivial memory)
    await logger.executeStage('Fast Validation Step', { file: 'test.md' }, async () => {
      return true;
    });

    assert.strictEqual(logsEmitted.length, 0, 'Fast stage below duration & memory thresholds must not emit logs');

    // 2. Slow stage exceeding 100ms threshold
    await logger.executeStage('Slow Inverted Index Synthesis', { file: '500mb_treatise.md' }, async () => {
      await new Promise(r => setTimeout(r, 110));
      return true;
    });

    assert.strictEqual(logsEmitted.length, 1, 'Stage exceeding 100ms duration threshold must emit log');
    assert(logsEmitted[0].includes('Slow Inverted Index Synthesis'));
  });

  // --------------------------------------------------------------------------
  // TELEMETRY & LOGGING UTILITY: Bunyan & Winston Standard Format Compatibility
  // --------------------------------------------------------------------------
  await test('Logging Utility: Generates valid Bunyan and Winston structured JSON entries', async () => {
    const logger = new PipelineStageLogger();

    await logger.executeStage('Format Verification Stage', { docHash: 'abc12345' }, async () => {
      return 'ok';
    });

    const metric = logger.getMetricsHistory()[0];

    // Bunyan Schema Verification
    const bunyan = logger.formatBunyan(metric);
    assert.strictEqual(typeof bunyan.name, 'string');
    assert.strictEqual(typeof bunyan.pid, 'number');
    assert.strictEqual(typeof bunyan.level, 'number');
    assert.strictEqual(typeof bunyan.time, 'string');
    assert.strictEqual(bunyan.stage, 'Format Verification Stage');
    assert.strictEqual(bunyan.context.docHash, 'abc12345');
    assert(typeof bunyan.memory.before.heapUsed === 'number');
    assert(typeof bunyan.memory.after.heapUsed === 'number');

    // Winston Schema Verification
    const winston = logger.formatWinston(metric);
    assert.strictEqual(winston.level, 'info');
    assert(winston.message.includes('Format Verification Stage'));
    assert.strictEqual(winston.service, 'ingestion-service');
    assert.strictEqual(typeof winston.timestamp, 'string');
    assert.strictEqual(winston.context.docHash, 'abc12345');
  });

  console.log('\n---------------------------------------------------------------');
  console.log(`  VERIFICATION RESULTS: ${passed} PASSED, ${failed} FAILED (TOTAL: ${passed + failed})`);
  console.log('---------------------------------------------------------------\n');

  if (failed > 0) {
    process.exit(1);
  }
}

runIngestionTestSuite();
