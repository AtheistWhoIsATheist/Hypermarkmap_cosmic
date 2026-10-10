/** Smoke-test the production bundle using a disposable database. */
import { spawn } from 'node:child_process';
import { mkdtempSync } from 'node:fs';
import { tmpdir } from 'node:os';
import path from 'node:path';
import assert from 'node:assert/strict';

const cwd = process.cwd();
const port = 3002;
const base = `http://127.0.0.1:${port}`;
const child = spawn(process.execPath, ['dist/server.cjs'], {
  cwd, env: { ...process.env, NODE_ENV: 'production', PORT: String(port), HOST: '127.0.0.1', DATA_DIR: mkdtempSync(path.join(tmpdir(), 'hypermark-production-')), OPENROUTER_API_KEY: '' },
  stdio: ['ignore', 'pipe', 'pipe'],
});
let stderr = '';
child.stderr.on('data', chunk => { stderr += chunk.toString(); });
async function json(url: string, init?: RequestInit) {
  const response = await fetch(base + url, { ...init, signal: AbortSignal.timeout(5000) });
  const data = await response.json();
  return { response, data };
}
try {
  let ready = false;
  for (let i = 0; i < 80; i++) {
    if (child.exitCode !== null) throw new Error('Production server exited before becoming ready.');
    try { ready = (await json('/api/health')).data.status === 'ok'; } catch {}
    if (ready) break;
    await new Promise(resolve => setTimeout(resolve, 100));
  }
  assert.ok(ready, 'Production server should start');
  assert.match(await (await fetch(base)).text(), /<div id="root"><\/div>/);
  assert.equal((await json('/api/health')).data.ai.provider, 'openrouter');
  assert.equal((await json('/api/hypermap/stats')).data.totalNodes, 1808);
  assert.equal((await json('/api/missing')).response.status, 404);
  assert.equal((await json('/api/passages/search?limit=-1')).response.status, 400);
  assert.equal((await json('/api/hypermap/densify', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: '{}' })).response.status, 400);
  assert.equal((await json('/api/sources/ingest', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: '{invalid' })).response.status, 400);
  const ingested = await json('/api/sources/ingest', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ filename: 'runtime-fixture.txt', contentText: 'Synthetic runtime first paragraph.\n\nSynthetic runtime second paragraph.' }) });
  assert.equal(ingested.response.status, 201); assert.equal(ingested.data.passageCount, 2);
  const passages = (await json('/api/passages/search?q=Synthetic')).data;
  const context = (await json(`/api/passages/${passages[0].id}`)).data;
  assert.equal(context.source.filename, 'runtime-fixture.txt');
  assert.ok(context.target && Array.isArray(context.before) && Array.isArray(context.after));
  const generated = await json('/api/hypermap/densify', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ nodeId: 'hm_d1_givenness' }) });
  assert.equal(generated.response.status, 200); assert.equal(generated.data.generationMode, 'deterministic'); assert.equal(generated.data.newNodes.length, 4);
  assert.equal((await json('/api/hypermap/node', { method: 'POST', headers: { 'Content-Type': 'application/json', Origin: 'https://unrelated.example' }, body: '{}' })).response.status, 403);
  console.log('Production startup, static assets, health, graph, ingestion/context, generation, errors, and origin checks passed.');
} catch (error) {
  console.error(stderr.replace(/ExperimentalWarning[^\n]*/g, 'SQLite runtime warning'));
  throw error;
} finally {
  child.kill();
}
