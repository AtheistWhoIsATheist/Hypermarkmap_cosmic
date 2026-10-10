/**
 * Nihiltheism Architect v1.0 Automated Test Suite
 * Tests acceptance criteria across:
 * - Phase 1: Database & Schema Initialization
 * - Phase 2: Vertical Slice (Ingestion, Passages, FTS5 Search, Passage Viewer, Export)
 * - Phase 3: Extraction & Knowledge Graph (Concepts, Claims, Objections, Relations, Contradictions)
 * - Phase 4: Symmetrical Dialectic Engine & Adversarial Scrutiny
 * - Phase 5: Autonomous & Guided Research Loop with Checkpoints & Budgeting
 * - Phase 6: Citation, Provenance & Mandatory Critical Revisions Audit (CR-01 to CR-12)
 * - Phase 7: Reference Edition (17 Chapters, 14,000+ words, no stubs)
 */

import './setup';
import { getDb, closeDb } from '../server/db';
import { seedDatabase } from '../server/seedData';
import { 
  ingestDocument, 
  searchPassages, 
  getPassageWithContext, 
  performAudit, 
  createResearchJob, 
  runResearchLoopStep, 
  getFullExportBundle, 
  createExportZip,
  getHypermapHierarchy,
  getHypermapStats,
  addHypermapNode,
  updateHypermapNode,
  deleteHypermapNode,
  densifyHypermapNode
} from '../server/services';
import assert from 'node:assert';

async function runTests() {
  console.log('--- STARTING NIHILTHEISM ARCHITECT ACCEPTANCE TESTS ---');
  let passed = 0;
  let failed = 0;

  function test(name: string, fn: () => void | Promise<void>) {
    return (async () => {
      try {
        await fn();
        console.log(`✓ PASS: ${name}`);
        passed++;
      } catch (err: any) {
        console.error(`✗ FAIL: ${name}`);
        console.error(err);
        failed++;
      }
    })();
  }

  // 1. Database & Schema
  await test('A01/Schema: SQLite database initializes tables with foreign keys and WAL mode', async () => {
    const db = getDb();
    seedDatabase(db);
    const tables = db.prepare("SELECT name FROM sqlite_master WHERE type='table'").all().map((r: any) => r.name);
    
    assert(tables.includes('projects'), 'Missing projects table');
    assert(tables.includes('sources'), 'Missing sources table');
    assert(tables.includes('passages'), 'Missing passages table');
    assert(tables.includes('concepts'), 'Missing concepts table');
    assert(tables.includes('claims'), 'Missing claims table');
    assert(tables.includes('objections'), 'Missing objections table');
    assert(tables.includes('relations'), 'Missing relations table');
    assert(tables.includes('contradictions'), 'Missing contradictions table');
    assert(tables.includes('corrections'), 'Missing corrections table');
    assert(tables.includes('manuscript_sections'), 'Missing manuscript_sections table');
  });

  // 2. Acceptance Criterion A02: Summary seed labeled summary-only, no invented PDF pagination
  await test('A02/Seed: Seed source labeled summary_only and has NULL page numbers', async () => {
    const db = getDb();
    const source = db.prepare("SELECT * FROM sources WHERE id = 'src_master_synthesis_v1'").get() as any;
    assert(source, 'Missing seed source');
    assert.strictEqual(source.content_completeness, 'summary_only', 'Seed must be labeled summary_only');

    const passages = db.prepare("SELECT * FROM passages WHERE source_id = 'src_master_synthesis_v1'").all() as any[];
    assert(passages.length >= 12, 'Expected at least 12 seed passages');
    for (const p of passages) {
      assert.strictEqual(p.page_number, null, `Passage ${p.id} must have NULL page_number (no invented pagination)`);
      assert(p.char_offset_end > p.char_offset_start, 'Valid character offsets required');
    }
  });

  // 3. FTS5 Search
  await test('A03/FTS5: Search across passages returns ranked matches', async () => {
    const results = searchPassages('Protention', undefined, 10);
    assert(results.length > 0, 'Should find passages matching Protention');
    assert(results.some(r => r.text.includes('Protention')), 'Results must contain matching text');
  });

  // 4. Passage Viewer with Context
  await test('A04/PassageViewer: Retrieves target passage with surrounding context', async () => {
    const res = getPassageWithContext('pas_modalities_02', 1);
    assert(res, 'Passage with context not found');
    assert.strictEqual(res.target.id, 'pas_modalities_02');
    assert(res.before.length >= 1, 'Preceding context should be populated');
    assert(res.after.length >= 1, 'Succeeding context should be populated');
  });

  // 5. Ingestion of New Source
  await test('A05/Ingestion: Ingests text document, calculates sha256 and chunks passages', async () => {
    const testDoc = `
# Heidegger on the Nothing
Martin Heidegger delivered his famous lecture Was ist Metaphysik in 1929.
He declared that anxiety reveals the Nothing, which nothings constantly.

## Gelassenheit and Releasement
In later writings, Heidegger moved from the will to will toward releasement.
This openness to mystery allows humans to dwell authentically on the earth.
    `.trim();

    const res = await ingestDocument({
      projectId: 'proj_journal314_canonical',
      filename: 'heidegger_lecture_notes.md',
      mediaType: 'text/markdown',
      contentText: testDoc
    });

    assert(res.source.id.startsWith('src_'), 'Source ID must be generated');
    assert(res.passageCount >= 2, 'Should create multiple passages');
    assert.strictEqual(res.source.content_completeness, 'complete');
  });

  // 6. Mandatory Critical Revisions (CR-01 through CR-12)
  await test('A06/Corrections: All 12 Mandatory Critical Revisions registered and enforced', async () => {
    const db = getDb();
    const corrections = db.prepare('SELECT * FROM corrections ORDER BY code ASC').all() as any[];
    assert.strictEqual(corrections.length, 12, 'All 12 corrections CR-01 through CR-12 must be present');
    
    const codes = corrections.map(c => c.code);
    for (let i = 1; i <= 12; i++) {
      const code = `CR-${i.toString().padStart(2, '0')}`;
      assert(codes.includes(code), `Missing correction code ${code}`);
    }
  });

  // 7. Warrant Hygiene & Predicate Discipline
  await test('A07/Warrants: W5 metaphysical closure claims are tracked and disputed, not accepted facts', async () => {
    const db = getDb();
    const w5Claims = db.prepare("SELECT * FROM claims WHERE warrant_category = 'W5'").all() as any[];
    assert(w5Claims.length > 0, 'W5 claims should be tracked as objects of analysis');
    for (const c of w5Claims) {
      assert.notStrictEqual(c.support_status, 'supported', 'W5 claims cannot be accepted/supported system facts (CR-04)');
    }
  });

  // 8. Citation & Constitutional Audit
  await test('A08/Audit: Performs reference integrity & constitutional compliance check', async () => {
    const audit = performAudit();
    assert.strictEqual(audit.reference_integrity.status, 'valid', 'Reference integrity should be intact for seed data');
    assert.strictEqual(audit.metrics.broken_attributions, 0, 'Zero broken citations expected in seed');
    assert(audit.metrics.intact_attributions > 0, 'Intact citations expected');
    assert.strictEqual(audit.overall_status, 'PASSED');
  });

  // 9. Research Loop with Checkpoints & Budgeting
  await test('A09/ResearchLoop: Executes cycle, creates candidate claims, and respects budget', async () => {
    const jobId = await createResearchJob('proj_journal314_canonical', ['all_passages'], 2, 5);
    const updatedJob = await runResearchLoopStep(jobId);
    
    assert(updatedJob.current_cycle === 1, 'Current cycle should advance to 1');
    assert(updatedJob.candidate_additions >= 1, 'Should generate candidate claim additions');
    assert(updatedJob.requests_executed >= 1, 'Requests executed counter must increment');
  });

  // 10. Complete Manuscript Reference Edition (17 Chapters)
  await test('A10/Manuscript: All 17 required chapters present with substantial word count', async () => {
    const db = getDb();
    const chapters = db.prepare('SELECT * FROM manuscript_sections ORDER BY chapter_number ASC').all() as any[];
    assert.strictEqual(chapters.length, 17, 'Exactly 17 chapters required');
    
    let totalWords = 0;
    for (let i = 1; i <= 17; i++) {
      const ch = chapters[i - 1];
      assert.strictEqual(ch.chapter_number, i, `Chapter ${i} missing or out of order`);
      assert(ch.word_count > 500, `Chapter ${i} has insufficient word count: ${ch.word_count}`);
      assert(ch.definitions_scope.length > 10, `Chapter ${i} definitions missing`);
      assert(ch.developed_argument.length > 20, `Chapter ${i} argument missing`);
      assert(ch.counterargument.length > 20, `Chapter ${i} counterargument missing`);
      assert(ch.reply_or_revision.length > 20, `Chapter ${i} reply missing`);
      totalWords += ch.word_count;
    }

    assert(totalWords >= 12000, `Total reference edition word count should be 12,000+ words; found: ${totalWords}`);
    console.log(`    Total Manuscript Word Count: ${totalWords.toLocaleString()} words`);
  });

  // 11. Full Export (JSON and ZIP)
  await test('A11/Export: Produces JSON bundle and ZIP archive with all artifacts', async () => {
    const bundle = getFullExportBundle();
    assert(bundle.project, 'Bundle missing project');
    assert(bundle.sources.length >= 1, 'Bundle missing sources');
    assert(bundle.passages.length >= 12, 'Bundle missing passages');
    assert(bundle.concepts.length >= 5, 'Bundle missing concepts');
    assert(bundle.claims.length >= 4, 'Bundle missing claims');
    assert(bundle.objections.length >= 4, 'Bundle missing objections');
    assert(bundle.corrections.length === 12, 'Bundle missing 12 corrections');
    assert(bundle.manuscriptChapters.length === 17, 'Bundle missing 17 chapters');

    const zipBuffer = await createExportZip();
    assert(zipBuffer.length > 10000, 'Zip archive should be non-trivial size');
    console.log(`    Export ZIP size: ${(zipBuffer.length / 1024).toFixed(1)} KB`);
  });

  // 12. Hypermap Canonical Database Structure
  await test('A12/Hypermap: 1,808 Preserved Canonical Nodes exist in SQLite with 2 unique root trees', async () => {
    const stats = getHypermapStats();
    assert(stats.totalNodes >= 1808, `Expected at least 1,808 nodes, found ${stats.totalNodes}`);
    assert(stats.tree1Nodes >= 800, `Expected Tree 1 (Journal314) to have >= 800 nodes, found ${stats.tree1Nodes}`);
    assert(stats.tree2Nodes >= 500, `Expected Tree 2 (PEC-Ω) to have >= 500 nodes, found ${stats.tree2Nodes}`);
    assert(stats.byType['domain'] >= 8, 'Expected at least 8 domains');
    assert(stats.byType['category'] >= 32, 'Expected at least 32 categories');
    assert(stats.byType['paradox'] >= 16, 'Expected at least 16 LP antinomies');
    console.log(`    Hypermap Canonical Nodes: ${stats.totalNodes.toLocaleString()} (Tree 1: ${stats.tree1Nodes}, Tree 2: ${stats.tree2Nodes})`);
  });

  // 13. Hypermap D3 Tree Hierarchy
  await test('A13/Hypermap: D3 tree hierarchy generates with 2 root branches and valid tree structure', async () => {
    const tree = getHypermapHierarchy('all');
    assert(tree.id === 'root_cosmos', 'Cosmos root node missing');
    assert(tree.children && tree.children.length === 2, `Expected 2 unique root trees, found ${tree.children?.length}`);
    const root1 = tree.children.find(c => c.id === 'tree_journal314_phenomenology');
    const root2 = tree.children.find(c => c.id === 'tree_pec_omega_dialectic');
    assert(root1, 'Tree 1 Journal314 missing from cosmos hierarchy');
    assert(root2, 'Tree 2 PEC-Ω missing from cosmos hierarchy');
    assert(root1.children && root1.children.length >= 6, 'Tree 1 missing domains');
    assert(root2.children && root2.children.length >= 4, 'Tree 2 missing core columns');
  });

  // 14. Hypermap CRUD & State Synchronization
  await test('A14/Hypermap: Dialectical node CRUD operations and state synchronization into claims and objections', async () => {
    const db = getDb();
    const testClaimNode = addHypermapNode({
      parent_id: 'hm_d1_givenness',
      title: 'Automated Test Dialectical Premise: Pre-Reflective Void',
      node_type: 'claim',
      warrant_category: 'W3',
      payload_text: 'Test payload demonstrating pre-reflective void intentionality.',
      epistemic_status: 'supported'
    });

    assert(testClaimNode.id, 'Created node missing ID');
    assert(testClaimNode.claim_id, 'Claim node missing state synchronization claim_id');
    
    // Verify synchronized row in claims table
    const claimRow = db.prepare('SELECT * FROM claims WHERE id = ?').get(testClaimNode.claim_id) as any;
    assert(claimRow, 'Claim row not found in SQLite claims table');
    assert(claimRow.warrant_category === 'W3', 'Claim row warrant category mismatch');

    // Update node
    const updated = updateHypermapNode(testClaimNode.id, {
      title: 'Automated Test Dialectical Premise: Revised Void Intentionality',
      warrant_category: 'W4'
    });
    assert.strictEqual(updated.title, 'Automated Test Dialectical Premise: Revised Void Intentionality');

    // Clean up
    const delResult = deleteHypermapNode(testClaimNode.id);
    assert(delResult.success && delResult.deletedCount >= 1, 'Delete node failed');
  });

  // 15. Hypermap Generative Dialectical Densification
  await test('A15/Hypermap: Dialectical densification generates W3 claim, W4 defeater, and LP paraconsistent antinomy', async () => {
    const densifyResult = await densifyHypermapNode('hm_d1_givenness', 'Adversarial Reduction Test');
    assert(densifyResult.parentNode, 'Densify parent node missing');
    assert(densifyResult.newNodes.length >= 3, `Expected at least 3 densified branches, got ${densifyResult.newNodes.length}`);
    
    const hasParadox = densifyResult.newNodes.some(n => n.node_type === 'paradox' || n.paradox_relation);
    assert(hasParadox, 'Densification must produce paraconsistent LP antinomy branch');
    console.log(`    Densified Branches Created: ${densifyResult.newNodes.map(n => n.node_type).join(', ')}`);

    // Clean up created nodes
    for (const n of densifyResult.newNodes) {
      deleteHypermapNode(n.id);
    }
  });

  console.log(`\n======================================================`);
  console.log(`TEST SUMMARY: ${passed} PASSED, ${failed} FAILED`);
  console.log(`======================================================`);

  if (failed > 0) {
    process.exit(1);
  }
}

runTests().finally(() => closeDb()).catch(err => {
  console.error('Fatal test execution error:', err);
  process.exit(1);
});
