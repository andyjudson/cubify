import { spawn } from 'node:child_process';
import { writeFileSync } from 'node:fs';
import { dirname, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';
import { chromium } from 'playwright';

const __dirname = dirname(fileURLToPath(import.meta.url));
const HARNESS_DIR  = resolve(__dirname, '../../cubify-harness');
const VITE_PORT    = 5175;
const VITE_URL     = `http://localhost:${VITE_PORT}`;
const RENDERER_URL = `${VITE_URL}/renderer.html`;

async function waitForServer(url, timeout = 10000) {
  const start = Date.now();
  while (Date.now() - start < timeout) {
    try { await fetch(url); return; } catch {}
    await new Promise(r => setTimeout(r, 200));
  }
  throw new Error(`Vite dev server did not respond at ${url} within ${timeout}ms`);
}

export async function render(alg, { output, style = '3d', stickering = null, setupAlg = null, size = 288 } = {}) {
  const vite = spawn('npx', ['vite', '--port', String(VITE_PORT)], { cwd: HARNESS_DIR, stdio: 'pipe' });

  try {
    await waitForServer(VITE_URL);

    const browser = await chromium.launch({ headless: false, args: ['--no-sandbox'] });
    try {
      const context = await browser.newContext({ viewport: { width: size, height: size } });
      const page = await context.newPage();
      await page.goto(RENDERER_URL);
      await page.waitForFunction(() => typeof window.cubifyRender === 'function', { timeout: 5000 });

      const dataUrl = await page.evaluate(
        ({ alg, opts }) => window.cubifyRender(alg, opts),
        { alg, opts: { style, stickering, setupAlg, size } }
      );

      writeFileSync(output, Buffer.from(dataUrl.split(',')[1], 'base64'));
    } finally {
      await browser.close();
    }
  } finally {
    vite.kill();
  }
}
