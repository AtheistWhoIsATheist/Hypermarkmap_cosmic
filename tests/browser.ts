/** Browser acceptance checks against a disposable production instance. No live AI generation or Google sign-in. */
import assert from 'node:assert/strict';
import { spawn } from 'node:child_process';
import { existsSync, mkdirSync, mkdtempSync, readFileSync, rmSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import path from 'node:path';
import { chromium } from 'playwright-core';
import JSZip from 'jszip';
import type { TopologyExportPayload } from '../src/types/export';
import { getTestPort } from './ports';

const dataDir = mkdtempSync(path.join(tmpdir(), 'cosmic-browser-'));
const artifacts = path.resolve('artifacts');
mkdirSync(artifacts, { recursive: true });
const port = await getTestPort();
const base = `http://127.0.0.1:${port}`;
const server = spawn('bun', ['run', 'start'], {
  env: { ...process.env, PORT: String(port), HOST: '127.0.0.1', DATA_DIR: dataDir,
    OPENROUTER_API_KEY: '', WRITE_API_KEY: '', ADMIN_API_KEY: '' },
  stdio: ['ignore', 'pipe', 'pipe'], detached: process.platform !== 'win32'
});
let serverOutput = '';
server.stdout.on('data', chunk => { serverOutput += chunk.toString(); });
server.stderr.on('data', chunk => { serverOutput += chunk.toString(); });
const serverExited = new Promise<void>(resolve => server.once('exit', () => resolve()));
const delay = (ms: number) => new Promise(resolve => setTimeout(resolve, ms));
const checks: string[] = [];
let browser: Awaited<ReturnType<typeof chromium.launch>> | undefined;

try {
  let ready = false;
  for (let attempt = 0; attempt < 100; attempt++) {
    if (server.exitCode !== null) throw new Error(`Production startup failed: ${serverOutput}`);
    let health: { status: string; ai: { configured: boolean } } | undefined;
    try {
      health = await (await fetch(`${base}/api/health`, { signal: AbortSignal.timeout(1000) })).json() as typeof health;
    } catch {}
    if (health) {
      ready = health.status === 'ok';
      assert.equal(health.ai.configured, false, 'Browser checks must never use a live AI credential');
    }
    if (ready) break;
    await delay(200);
  }
  assert(ready, `Production server did not become ready: ${serverOutput}`);
  browser = await chromium.launch({
    executablePath: process.env.BROWSER_EXECUTABLE_PATH || (existsSync('/usr/bin/chromium') ? '/usr/bin/chromium' : undefined),
    headless: true, args: ['--disable-dev-shm-usage']
  });
  const context = await browser.newContext({ viewport: { width: 1440, height: 1000 }, reducedMotion: 'no-preference', acceptDownloads: true });
  const page = await context.newPage();
  page.setDefaultTimeout(12000);
  const pageErrors: string[] = [];
  const apiErrors: string[] = [];
  page.on('pageerror', error => pageErrors.push(error.message));
  page.on('response', response => {
    if (response.url().startsWith(`${base}/api/`) && response.status() >= 400) {
      apiErrors.push(`${response.status()} ${new URL(response.url()).pathname}`);
    }
  });
  // Observe real canvas draws, independently of the animation implementation.
  await page.addInitScript({ content: `
    window.__graphQA = { cores: [], edges: [] };
    const p = CanvasRenderingContext2D.prototype;
    const original = { clear:p.clearRect, begin:p.beginPath, arc:p.arc, stroke:p.stroke, move:p.moveTo, curve:p.bezierCurveTo };
    const main = ctx => ctx.canvas.getAttribute('aria-label')?.startsWith('Interactive topology graph.');
    p.clearRect = function(...args) { if(main(this)) window.__graphQA = {cores:[],edges:[]}; return original.clear.apply(this,args); };
    p.beginPath = function() { this.__qaArc = null; this.__qaStart = null; return original.begin.call(this); };
    p.arc = function(x,y,r,...rest) { this.__qaArc={x,y,r}; return original.arc.call(this,x,y,r,...rest); };
    p.stroke = function(...args) {
      if(main(this) && this.__qaArc?.r >= 2 && this.__qaArc.r < 80) {
        const a=this.__qaArc,m=this.getTransform();
        window.__graphQA.cores.push({x:a.x,y:a.y,sx:m.a*a.x+m.c*a.y+m.e,sy:m.b*a.x+m.d*a.y+m.f});
      }
      return original.stroke.apply(this,args);
    };
    p.moveTo = function(x,y) { this.__qaStart={x,y}; return original.move.call(this,x,y); };
    p.bezierCurveTo = function(a,b,c,d,x,y) {
      if(main(this)) window.__graphQA.edges.push({start:this.__qaStart,end:{x,y}});
      return original.curve.call(this,a,b,c,d,x,y);
    };
  ` });
  type Frame = { cores: { x: number; y: number; sx: number; sy: number }[]; edges: { start: { x: number; y: number }; end: { x: number; y: number } }[] };
  const frame = () => page.evaluate(() => (window as any).__graphQA as Frame);
  await page.goto(base, { waitUntil: 'networkidle' });
  await page.locator('canvas[aria-label^="Interactive topology graph"]').waitFor();
  const first = await frame();
  assert(first.cores.length >= 50, 'The baseline graph should render its nodes');
  await delay(2200);
  const later = await frame();
  assert.equal(later.cores.length, first.cores.length);
  const movement = later.cores.map((node, i) => Math.hypot(node.sx - first.cores[i].sx, node.sy - first.cores[i].sy));
  assert(Math.max(...movement) > 0.1 && Math.max(...movement) < 6.4, 'Node motion must be visible but subtle');
  for (const edge of later.edges) for (const end of [edge.start, edge.end]) {
    assert(later.cores.some(node => Math.hypot(node.x - end.x, node.y - end.y) < 1e-6), 'Connecting lines follow the moving nodes');
  }
  const canvasBox = await page.locator('canvas[aria-label^="Interactive topology graph"]').boundingBox();
  assert(canvasBox);
  const root = later.cores[0];
  await page.mouse.click(canvasBox.x + root.sx, canvasBox.y + root.sy);
  await page.getByRole('dialog').waitFor();
  await page.getByRole('button', { name: 'Close inspector', exact: true }).click();
  await page.getByRole('dialog').waitFor({ state: 'hidden' });
  await page.emulateMedia({ reducedMotion: 'reduce' });
  await delay(100);
  const stationary = (await frame()).cores.map(node => [node.x, node.y]);
  await delay(300);
  assert.deepEqual((await frame()).cores.map(node => [node.x, node.y]), stationary, 'Reduced-motion mode stops node bobbing');
  await page.emulateMedia({ reducedMotion: 'no-preference' });
  checks.push('Graph renders, nodes float subtly, links follow, moving nodes remain clickable, and reduced motion is respected');

  await page.getByRole('button', { name: 'Add Concept Node', exact: true }).click();
  await page.getByPlaceholder('e.g. Apophatic Horizon of Consciousness').fill('Browser QA Concept');
  await page.getByPlaceholder('Detailed thesis or philosophical warrant...').fill('Synthetic browser acceptance fixture.');
  await page.getByRole('dialog').locator('select').selectOption('markmap_root');
  await page.getByRole('button', { name: 'Create Node', exact: true }).click();
  await page.getByRole('button', { name: 'Rename concept node (F2)', exact: true }).click();
  await page.getByRole('textbox', { name: 'Edit node title' }).fill('Browser QA Renamed Concept');
  await page.getByRole('button', { name: 'Save title', exact: true }).click();
  await page.getByRole('button', { name: 'Close inspector', exact: true }).click();
  await page.reload({ waitUntil: 'networkidle' });

  const exportTopology = async (filename: string): Promise<TopologyExportPayload> => {
    await page.getByRole('button', { name: 'Export Topology JSON', exact: true }).click();
    const [download] = await Promise.all([
      page.waitForEvent('download'),
      page.getByRole('button', { name: 'Download Topology JSON', exact: true }).click()
    ]);
    const target = path.join(artifacts, filename);
    await download.saveAs(target);
    const payload = JSON.parse(readFileSync(target, 'utf8')) as TopologyExportPayload;
    assert(Array.isArray(payload.nodes) && Array.isArray(payload.edges));
    const ids = new Set(payload.nodes.map(node => node.id));
    assert(payload.edges.every(edge => ids.has(edge.source) && ids.has(edge.target)), 'Exported edges have valid endpoints');
    await page.getByRole('button', { name: 'Dismiss export modal', exact: true }).click();
    return payload;
  };
  const renamed = await exportTopology('browser-topology-renamed.json');
  assert(renamed.nodes.some(node => node.title === 'Browser QA Renamed Concept'), 'Node creation and rename persist after reload');
  checks.push('Create, link, rename, reload, and export a custom node with intact edges');

  await page.getByRole('button', { name: /^Ingest Documents/ }).click();
  await page.locator('input[type="file"]').first().setInputFiles({ name: 'browser-qa.md', mimeType: 'text/markdown',
    buffer: Buffer.from('# Browser QA Document\n\nSynthetic source text preserved by local import.\n\n## Section Two\n\nAnother synthetic paragraph.') });
  await page.getByRole('button', { name: /^Ingest 1 File/ }).click();
  await page.getByText(/Batch Ingestion Complete: Committed 1 document/).waitFor();
  await page.getByRole('button', { name: 'Close', exact: true }).click();
  await page.reload({ waitUntil: 'networkidle' });
  const ingested = await exportTopology('browser-topology-ingested.json');
  assert(ingested.documents.some(document => document.fileName === 'browser-qa.md'));
  assert(ingested.nodes.filter(node => node.sourceFile === 'browser-qa.md').every(node => node.processingMode === 'STRUCTURALLY_INGESTED'));
  await page.screenshot({ path: path.join(artifacts, 'graph-desktop.png') });
  checks.push('Import Markdown, persist it in browser storage, reload, and export source provenance');
  await page.getByRole('button', { name: /^Drive & Docs Hub/ }).click();
  await page.getByRole('dialog', { name: 'Google Workspace Hub: Drive and Docs' }).waitFor();
  await page.getByRole('button', { name: 'Close modal', exact: true }).click();
  checks.push('Google Drive/Docs hub opens (live Google sign-in is not exercised)');

  await Promise.all([page.waitForURL('**/architect'), page.getByRole('button', { name: /^Architect Workbench/ }).click()]);
  await page.waitForLoadState('networkidle');
  const tabs = ['Overview', '1,808-Node Hypermap', '17-Ch Reference Edition', 'Corpus & Search', 'Dialectic & Warrants', '12 Mandatory CRs', 'Autonomous Loop', 'Constitutional Audit'];
  const headings: Record<string, RegExp> = {
    'Overview': /Nihiltheism Research Workbench & Reference Edition/,
    '1,808-Node Hypermap': /Dynamic Epistemic Hypermap/,
    '17-Ch Reference Edition': /Reference Edition/,
    'Corpus & Search': /Corpus Explorer & FTS5 Semantic Search/,
    'Dialectic & Warrants': /Philosophical Dialectic & Warrant Engine/,
    '12 Mandatory CRs': /Mandatory Critical Revisions Registry/,
    'Autonomous Loop': /Autonomous Research Pipeline & Loop Console/,
    'Constitutional Audit': /Constitutional Compliance & Reference Integrity Report/
  };
  const nav = page.getByRole('navigation', { name: 'Research tools' });
  const selectTab = async (tab: string) => {
    await nav.getByRole('button', { name: tab, exact: true }).click();
    await page.waitForFunction(name => document.querySelector('nav[aria-label="Research tools"] [aria-current="page"]')?.textContent?.trim() === name, tab);
    await page.getByRole('heading', { name: headings[tab] }).first().waitFor();
    await page.waitForLoadState('networkidle');
    await page.waitForFunction(() => {
      const panes = document.querySelectorAll('main');
      return ((panes[panes.length - 1] as HTMLElement)?.innerText.length || 0) > 100;
    });
    assert((await page.locator('main').last().innerText()).length > 100, `${tab} renders content`);
  };
  for (const tab of tabs) {
    await selectTab(tab);
    checks.push(`Workbench: ${tab}`);
  }
  await selectTab('Corpus & Search');
  await page.getByRole('button', { name: 'Ingest Source Document', exact: true }).click();
  await page.locator('form input[type="text"]').fill('browser-qa-corpus.txt');
  await page.locator('form textarea').fill('cosmicqaverification synthetic first paragraph.\n\nSynthetic second paragraph preserves source context.');
  const [ingestionResponse] = await Promise.all([
    page.waitForResponse(response => response.url().endsWith('/api/sources/ingest') && response.request().method() === 'POST'),
    page.locator('form button[type="submit"]').click()
  ]);
  assert.equal(ingestionResponse.status(), 201);
  await page.locator('form').waitFor({ state: 'hidden' });
  await page.getByRole('textbox').first().fill('cosmicqaverification');
  // Search is debounced: select the new result, rather than a still-visible result from the previous query.
  await page.getByText('cosmicqaverification synthetic first paragraph.', { exact: false }).click();
  await page.getByText('PASSAGE CONTEXT VIEWER', { exact: true }).waitFor();
  await page.getByText('Synthetic second paragraph preserves source context.', { exact: false }).waitFor();
  await page.keyboard.press('Escape');
  checks.push('SQLite document ingestion, FTS5 search, and passage context work through the UI');

  await selectTab('Autonomous Loop');
  await page.locator('form input[type="text"]').fill('void');
  await page.locator('form input[type="number"]').fill('1');
  const [loopResponse] = await Promise.all([
    page.waitForResponse(response => response.url().endsWith('/api/jobs/run')),
    page.getByRole('button', { name: 'Start Research Cycle', exact: true }).click()
  ]);
  assert.equal(loopResponse.status(), 200);
  const loop = await loopResponse.json();
  assert(loop.newClaimsCount > 0 && loop.newObjectionsCount > 0);
  checks.push('Bounded offline research cycle produces claims and objections');

  await selectTab('Overview');
  await page.screenshot({ path: path.join(artifacts, 'workbench-desktop.png') });
  await page.getByRole('button', { name: 'Export', exact: true }).click();
  for (const [href, filename] of [['/api/export/bundle', 'browser-corpus.json'], ['/api/export/zip', 'browser-release.zip']]) {
    const [download] = await Promise.all([page.waitForEvent('download'), page.locator(`a[href="${href}"]`).click()]);
    await download.saveAs(path.join(artifacts, filename));
  }
  assert(readFileSync(path.join(artifacts, 'browser-corpus.json'), 'utf8').includes('browser-qa-corpus.txt'));
  const archive = await JSZip.loadAsync(readFileSync(path.join(artifacts, 'browser-release.zip')));
  const manuscript = await archive.file('manuscript.md')!.async('string');
  const chapters = [...manuscript.matchAll(/^# Chapter (\d+):/gm)].map(match => Number(match[1]));
  assert.deepEqual(chapters, Array.from({ length: 17 }, (_, i) => i + 1));
  const database = JSON.parse(await archive.file('database.json')!.async('string'));
  assert(database.hypermapNodes.length >= 1808 && database.researchJobs.length >= 1);
  assert(database.passages.some((passage: { text: string }) => passage.text.includes('cosmicqaverification')));
  await page.getByRole('button', { name: 'Close', exact: true }).click();
  checks.push('Database JSON and ZIP exports include the imported source and reference chapters');

  await page.setViewportSize({ width: 390, height: 844 });
  await page.screenshot({ path: path.join(artifacts, 'workbench-mobile.png') });
  assert(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth));
  for (const tab of tabs) {
    await selectTab(tab);
  }
  await page.goto(base, { waitUntil: 'networkidle' });
  const sidebarToggle = page.getByRole('button', { name: 'Collapse sidebar', exact: true });
  if (await sidebarToggle.isVisible()) await sidebarToggle.click();
  await delay(350); // Capture after the mobile sidebar's 300 ms transition.
  await page.screenshot({ path: path.join(artifacts, 'graph-mobile.png') });
  assert(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth));
  checks.push('Graph and every workbench section remain usable at a 390px mobile viewport');
  assert.deepEqual(pageErrors, [], 'No uncaught browser errors');
  assert.deepEqual(apiErrors, [], 'Valid browser workflows must not fail API requests');
  writeFileSync(path.join(artifacts, 'browser-verification.json'), JSON.stringify({ checks, pageErrors, apiErrors, externalServices: 'Live AI and Google account access not tested' }, null, 2));
  console.log(`Browser verification passed: ${checks.length} checks, desktop and mobile, no page/API errors.`);
} catch (error) {
  const page = browser?.contexts()[0]?.pages()[0];
  if (page && !page.isClosed()) {
    await page.screenshot({ path: path.join(artifacts, 'browser-failure.png'), fullPage: true });
    console.error('Browser failure context:', (await page.locator('body').innerText()).slice(-2200));
  }
  throw error;
} finally {
  if (browser) await browser.close();
  if (server.exitCode === null && server.pid) {
    if (process.platform === 'win32') server.kill();
    else process.kill(-server.pid, 'SIGTERM');
    await serverExited;
  }
  rmSync(dataDir, { recursive: true, force: true });
}
