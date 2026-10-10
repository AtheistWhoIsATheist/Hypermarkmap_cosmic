import { chromium, expect } from '@playwright/test';
import assert from 'node:assert/strict';
import path from 'node:path';

const browser = await chromium.launch({ channel: 'msedge', headless: true });
const summary: unknown[] = [];
try {
  for (const [name, url] of [['root', 'http://127.0.0.1:3000'], ['standalone', 'http://127.0.0.1:3001']]) {
    const context = await browser.newContext({ viewport: { width: 1440, height: 900 }, deviceScaleFactor: 2 });
    const page = await context.newPage();
    const errors: string[] = [];
    page.on('response', response => { if (response.status() >= 400) errors.push(`HTTP ${response.status()} ${response.url()}`); });
    page.on('pageerror', error => errors.push(error.message));
    page.on('console', msg => { if (msg.type() === 'error') errors.push(msg.text()); });
    await page.goto(url, { waitUntil: 'networkidle' });
    await page.locator('canvas').waitFor();
    await page.waitForTimeout(600);
    const drawing = await page.locator('canvas').evaluate((canvas: HTMLCanvasElement) => {
      const pixels = canvas.getContext('2d')!.getImageData(0, 0, canvas.width, canvas.height).data;
      let colored = 0;
      for (let i = 0; i < pixels.length; i += 400) if (pixels[i + 1] > 30 || pixels[i + 2] > 30) colored++;
      return { width: canvas.width, height: canvas.height, cssWidth: canvas.clientWidth, cssHeight: canvas.clientHeight, colored };
    });
    assert.equal(drawing.width, drawing.cssWidth * 2);
    assert.ok(drawing.colored > 20, 'Canvas must render nonblank topology pixels');
    await page.screenshot({ path: path.resolve(`artifacts/${name}-desktop.png`) });
    await page.mouse.move(900, 650);
    await page.mouse.wheel(0, -200);
    await page.locator('canvas').focus();
    await page.keyboard.press('ArrowRight');
    await page.keyboard.press('+');
    await page.keyboard.press('Home');
    const search = page.getByRole('textbox');
    await search.fill('void');
    await search.fill('');
    const collapse = page.getByRole('button', { name: /collapse all/i });
    if (await collapse.count()) { await collapse.click(); const small = Number(await page.locator('canvas').getAttribute('data-node-count')); await page.getByRole('button', { name: /expand all/i }).click(); assert.ok(Number(await page.locator('canvas').getAttribute('data-node-count')) > small); }
    await page.mouse.move(1100, 650);
    await page.mouse.down(); await page.mouse.move(1020, 610, { steps: 5 }); await page.mouse.up();
    assert.equal(await page.locator('aside').count(), 0, 'Dragging must not open the inspector');
    if (name === 'root') {
      await page.getByRole('button', { name: /\[-\] JOURNAL314/ }).click();
      assert.equal(await page.locator('aside').count(), 1);
      await page.getByRole('button', { name: 'Close inspector' }).click();
      const cosmos = page.getByRole('button', { name: /canonical.*matrix/i });
      await cosmos.click();
      await page.waitForTimeout(500);
      await page.screenshot({ path: path.resolve('artifacts/root-canonical.png') });
    }
    await page.locator('canvas').focus();
    await page.keyboard.press('Enter');
    assert.equal(await page.locator('aside').count(), 1);
    if (name === 'root') {
      // Mock only the mutation response; never modify the user's saved graph.
      let calls = 0;
      await page.route('**/api/hypermap/densify', async route => {
        calls++;
        assert.ok(route.request().postDataJSON().nodeId);
        await route.fulfill({ json: { parentNode: {}, newNodes: [], totalTreeNodes: 1808, generationMode: 'deterministic', warning: 'Synthetic browser proposals created.' } });
      });
      await page.locator('aside button.w-full.text-left').first().click();
      await page.getByRole('button', { name: 'Generate offline proposals' }).click();
      await expect(page.getByRole('status')).toHaveText('Synthetic browser proposals created.');
      assert.equal(calls, 1);
      await page.unroute('**/api/hypermap/densify');
    }
    await page.keyboard.press('Escape');
    assert.equal(await page.locator('aside').count(), 0);
    if (name === 'root') await page.reload({ waitUntil: 'networkidle' });
    await page.setViewportSize({ width: 390, height: 844 });
    await page.locator('canvas').focus();
    await page.keyboard.press('Home');
    await page.waitForTimeout(500);
    await page.screenshot({ path: path.resolve(`artifacts/${name}-mobile.png`) });
    assert.equal(await page.evaluate(() => document.documentElement.scrollWidth <= window.innerWidth), true, 'No mobile horizontal overflow');
    assert.deepEqual(errors, [], `${name}: no browser errors`);
    summary.push({ name, drawing, errors });
    await context.close();
  }
  console.log(JSON.stringify(summary, null, 2));
} finally { await browser.close(); }
