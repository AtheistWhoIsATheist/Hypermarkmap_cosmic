import './setup';
import { before, after, test } from 'node:test';
import assert from 'node:assert/strict';
import { getDb, closeDb } from '../server/db';
import { seedDatabase } from '../server/seedData';
import { openRouterJson, getOpenRouterStatus, validateBranches, validateResearchCandidate } from '../server/openrouter';
import { ingestDocument, createResearchJob, runResearchLoopStep, densifyHypermapNode, getHypermapStats } from '../server/services';

const env = { OPENROUTER_API_KEY: 'test-token', OPENROUTER_MODEL: 'test/model', OPENROUTER_TIMEOUT_MS: '1000' };
const branches = [
  { title: 'Test claim', node_type: 'claim', warrant: 'W3', payload: 'A generated candidate requiring review.' },
  { title: 'Test objection', node_type: 'objection', warrant: 'W4', payload: 'A generated counterargument requiring review.' },
  { title: 'Test paradox', node_type: 'paradox', warrant: 'W4', payload: 'A proposed tension requiring examination.', paradox: 'proposal' },
];
const completion = (data: unknown, finish_reason = 'stop') => new Response(JSON.stringify({ model: 'test/model', choices: [{ finish_reason, message: { content: JSON.stringify(data) } }], usage: { total_tokens: 42 } }), { headers: { 'content-type': 'application/json' } });
const mockFetch = (fn: (...args: any[]) => Promise<Response>) => fn as typeof fetch;
before(() => seedDatabase(getDb()));
after(() => closeDb());

async function withProvider<T>(fetcher: typeof fetch, fn: () => Promise<T>): Promise<T> {
  const original = globalThis.fetch;
  globalThis.fetch = fetcher;
  process.env.OPENROUTER_API_KEY = 'test-token';
  try { return await fn(); }
  finally { globalThis.fetch = original; delete process.env.OPENROUTER_API_KEY; }
}

test('OpenRouter sends authenticated JSON requests and separates instructions from source data', async () => {
  let calls = 0;
  const result = await openRouterJson('System instructions', 'Untrusted source data', validateBranches, { env, fetch: mockFetch(async (url, options) => {
    calls++;
    assert.equal(url, 'https://openrouter.ai/api/v1/chat/completions');
    assert.equal(options.headers.Authorization, 'Bearer test-token');
    const body = JSON.parse(options.body);
    assert.equal(body.model, 'test/model');
    assert.equal(body.messages[0].role, 'system');
    assert.equal(body.messages[1].content, 'Untrusted source data');
    assert.equal(body.response_format.type, 'json_object');
    return completion({ branches });
  }) });
  assert.equal(calls, 1);
  assert.equal(result.data.length, 3);
  assert.equal(result.totalTokens, 42);
});

test('Missing credentials and oversized prompts cannot send a request', async () => {
  assert.equal(getOpenRouterStatus({ OPENROUTER_API_KEY: 'MY_API_KEY' }).configured, false);
  let calls = 0;
  const fetcher = mockFetch(async () => { calls++; return completion({ branches }); });
  await assert.rejects(openRouterJson('', '', validateBranches, { env: {}, fetch: fetcher }), /Configure OPENROUTER_API_KEY/);
  await assert.rejects(openRouterJson('', 'x'.repeat(60001), validateBranches, { env, fetch: fetcher }), /limit/);
  assert.equal(calls, 0);
});

for (const status of [401, 402, 429, 502]) test(`HTTP ${status} errors never echo credentials or retry paid requests`, async () => {
  let calls = 0;
  await assert.rejects(openRouterJson('', '', validateBranches, { env, fetch: mockFetch(async () => {
    calls++; return new Response('Secret test-token; private source text', { status });
  }) }), (error: Error) => !error.message.includes('test-token') && !error.message.includes('private source'));
  assert.equal(calls, 1);
});

test('Provider errors, malformed JSON, truncated output, and invalid branches are rejected', async () => {
  const responses = [
    new Response(JSON.stringify({ error: { message: 'private detail' } })),
    new Response(JSON.stringify({ choices: [{ message: { content: '{invalid' } }] })),
    completion({ branches }, 'length'),
    completion({ branches: [] }),
    completion({ branches: branches.map(b => ({ ...b, warrant: 'W5' })) }),
    completion({ branches: [branches[0], branches[0], branches[0]] }),
  ];
  for (const response of responses) await assert.rejects(openRouterJson('', '', validateBranches, { env, fetch: mockFetch(async () => response) }));
});

test('A stalled provider request is aborted at the configured timeout', async () => {
  await assert.rejects(openRouterJson('', '', validateBranches, {
    env: { ...env, OPENROUTER_TIMEOUT_MS: '10' },
    fetch: mockFetch(async (_url, options) => new Promise((_resolve, reject) => options.signal.addEventListener('abort', () => reject(new Error('aborted'))))),
  }), /timed out/);
});

test('CRLF and whitespace ingestion preserves exact passage character offsets', async () => {
  const content = '  Synthetic first paragraph.  \r\n\r\n\r\n  Synthetic second paragraph. \r\n\r\nThird paragraph.';
  const result = await ingestDocument({ projectId: 'proj_journal314_canonical', filename: 'offset-test.txt', mediaType: 'text/plain', contentText: content });
  const passages = getDb().prepare('SELECT * FROM passages WHERE source_id = ? ORDER BY passage_index').all(result.source.id) as any[];
  assert.equal(passages.length, 3);
  for (const p of passages) assert.equal(content.slice(p.char_offset_start, p.char_offset_end), p.text);
});

test('Broken PDFs are rejected rather than ingested as raw binary text', async () => {
  const db = getDb(), before = db.prepare('SELECT COUNT(*) AS count FROM sources').get()!.count;
  await assert.rejects(ingestDocument({ projectId: 'proj_journal314_canonical', filename: 'invalid.pdf', mediaType: 'application/pdf', contentBase64: Buffer.from('not a PDF').toString('base64') }));
  assert.equal(db.prepare('SELECT COUNT(*) AS count FROM sources').get()!.count, before);
});

test('Ingestion rolls back the source row when passage insertion fails', async () => {
  const db = getDb(), before = db.prepare('SELECT COUNT(*) AS count FROM sources').get()!.count;
  db.exec("CREATE TEMP TRIGGER fail_passage BEFORE INSERT ON passages BEGIN SELECT RAISE(ABORT, 'synthetic failure'); END");
  try { await assert.rejects(ingestDocument({ projectId: 'proj_journal314_canonical', filename: 'rollback.txt', mediaType: 'text/plain', contentText: 'Rollback fixture.' })); }
  finally { db.exec('DROP TRIGGER fail_passage'); }
  assert.equal(db.prepare('SELECT COUNT(*) AS count FROM sources').get()!.count, before);
});

test('Concurrent research calls share one cycle, use exact source provenance, and leave proposals unreviewed', async () => {
  const db = getDb();
  const passage = db.prepare('SELECT p.* FROM passages p JOIN sources s ON p.source_id = s.id WHERE s.project_id = ? ORDER BY p.source_id,p.passage_index LIMIT 1').get('proj_journal314_canonical') as any;
  const candidate = {
    claim: { text: 'Synthetic research candidate.', claim_type: 'methodological_rule', warrant_category: 'W1', passage_id: passage.id, quoted_snippet: passage.text.slice(0, 25) },
    objection: { title: 'Synthetic critique', counter_argument: 'This remains unverified.', rival_model: 'Test model', severity: 'serious' },
  };
  assert.ok(validateResearchCandidate(candidate));
  const id = await createResearchJob('proj_journal314_canonical', ['all_passages'], 3, 1);
  let calls = 0;
  await withProvider(mockFetch(async () => { calls++; await new Promise(resolve => setTimeout(resolve, 10)); return completion(candidate); }), async () => {
    const first = runResearchLoopStep(id), second = runResearchLoopStep(id);
    assert.equal(first, second);
    const job = await first;
    assert.equal(job.current_cycle, 1); assert.equal(job.status, 'completed'); assert.equal(job.accepted_additions, 0);
    assert.equal(JSON.parse(job.checkpoint_data!).generationMode, 'openrouter');
    assert.equal((await runResearchLoopStep(id)).current_cycle, 1);
  });
  assert.equal(calls, 1);
  const claim = db.prepare('SELECT * FROM claims WHERE text = ?').get(candidate.claim.text) as any;
  assert.equal(claim.fidelity_label, 'PROPOSED'); assert.equal(claim.support_status, 'unreviewed');
  assert.equal(JSON.parse(claim.source_attributions)[0].source_id, passage.source_id);
});

test('Invented citations cannot be accepted as OpenRouter research evidence', async () => {
  const invalid = { claim: { text: 'Rejected invented citation.', claim_type: 'methodological_rule', warrant_category: 'W1', passage_id: 'invented', quoted_snippet: 'invented' }, objection: { title: 'Test', counter_argument: 'Test', rival_model: 'Test', severity: 'serious' } };
  const id = await createResearchJob('proj_journal314_canonical', ['all_passages'], 1, 1);
  const job = await withProvider(mockFetch(async () => completion(invalid)), () => runResearchLoopStep(id));
  assert.equal(JSON.parse(job.checkpoint_data!).generationMode, 'deterministic');
  assert.equal(getDb().prepare('SELECT id FROM claims WHERE text = ?').get(invalid.claim.text), undefined);
});

test('Densification validates provider branches and records their origin and uncertainty', async () => {
  const result = await withProvider(mockFetch(async () => completion({ branches })), () => densifyHypermapNode('hm_d1_givenness'));
  assert.equal(result.generationMode, 'openrouter'); assert.equal(result.newNodes.length, 3);
  for (const node of result.newNodes) { assert.equal(node.fidelity_label, 'PROPOSED'); assert.equal(node.epistemic_status, 'underdetermined'); }
});

test('Densification rolls back synchronized claims if graph insertion fails', async () => {
  const db = getDb(), nodes = getHypermapStats().totalNodes;
  const claims = db.prepare('SELECT COUNT(*) AS count FROM claims').get()!.count;
  db.exec("CREATE TEMP TRIGGER fail_node BEFORE INSERT ON hypermap_nodes BEGIN SELECT RAISE(ABORT, 'synthetic failure'); END");
  try { await assert.rejects(densifyHypermapNode('hm_d1_givenness')); }
  finally { db.exec('DROP TRIGGER fail_node'); }
  assert.equal(getHypermapStats().totalNodes, nodes);
  assert.equal(db.prepare('SELECT COUNT(*) AS count FROM claims').get()!.count, claims);
});

test('Startup preserves a partially populated graph instead of reseeding it', () => {
  const db = getDb();
  db.exec('SAVEPOINT partial_graph');
  try {
    db.exec("DELETE FROM hypermap_nodes WHERE id != 'hm_d1_givenness'");
    seedDatabase(db);
    assert.equal(getHypermapStats().totalNodes, 1);
  } finally { db.exec('ROLLBACK TO partial_graph; RELEASE partial_graph'); }
});


test('The current PDF parser extracts a valid synthetic PDF without treating bytes as prose', async () => {
  const content = 'BT /F1 12 Tf 40 100 Td (Synthetic extraction fixture.) Tj ET';
  const objects = [
    '<< /Type /Catalog /Pages 2 0 R >>',
    '<< /Type /Pages /Kids [3 0 R] /Count 1 >>',
    '<< /Type /Page /Parent 2 0 R /MediaBox [0 0 300 200] /Resources << /Font << /F1 4 0 R >> >> /Contents 5 0 R >>',
    '<< /Type /Font /Subtype /Type1 /BaseFont /Helvetica >>',
    `<< /Length ${content.length} >>\nstream\n${content}\nendstream`,
  ];
  let pdf = '%PDF-1.4\n';
  const offsets = [0];
  objects.forEach((object, i) => { offsets.push(Buffer.byteLength(pdf)); pdf += `${i + 1} 0 obj\n${object}\nendobj\n`; });
  const xref = Buffer.byteLength(pdf);
  pdf += `xref\n0 6\n0000000000 65535 f \n${offsets.slice(1).map(offset => `${String(offset).padStart(10, '0')} 00000 n `).join('\n')}\ntrailer\n<< /Size 6 /Root 1 0 R >>\nstartxref\n${xref}\n%%EOF`;
  const result = await ingestDocument({ projectId: 'proj_journal314_canonical', filename: 'synthetic.pdf', mediaType: 'application/pdf', contentBase64: Buffer.from(pdf).toString('base64') });
  const passage = getDb().prepare('SELECT text, page_number FROM passages WHERE source_id = ? ORDER BY passage_index LIMIT 1').get(result.source.id)!;
  assert.match(String(passage.text), /Synthetic extraction fixture/);
  assert.equal(passage.page_number, null);
  assert.equal(result.source.extraction_method, 'pdf-parse');
});

test('Empty research projects stop cleanly and invalid job bounds are rejected', async () => {
  const db = getDb(), now = new Date().toISOString();
  db.prepare('INSERT INTO projects (id,name,description,created_at,updated_at) VALUES (?,?,?,?,?)').run('empty-test', 'Empty fixture', 'No sources', now, now);
  const id = await createResearchJob('empty-test', ['all_passages'], 1, 1);
  assert.equal((await runResearchLoopStep(id)).status, 'completed');
  await assert.rejects(createResearchJob('empty-test', ['all_passages'], 0, 1), /bounds/);
});
