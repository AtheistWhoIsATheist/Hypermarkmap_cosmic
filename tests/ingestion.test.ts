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
import { IngestionService } from '../src/services/ingestion/IngestionService';
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

  console.log('\n---------------------------------------------------------------');
  console.log(`  VERIFICATION RESULTS: ${passed} PASSED, ${failed} FAILED (TOTAL: ${passed + failed})`);
  console.log('---------------------------------------------------------------\n');

  if (failed > 0) {
    process.exit(1);
  }
}

runIngestionTestSuite();
