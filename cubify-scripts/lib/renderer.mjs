import { chromium } from 'playwright';
import { writeFileSync, existsSync } from 'fs';
import { readFileSync } from 'fs';
import { execSync } from 'child_process';
import { resolve, dirname } from 'path';
import { fileURLToPath } from 'url';
import { createServer } from 'http';

const __dirname = dirname(fileURLToPath(import.meta.url));
const CFOP_APP_DIR = resolve(__dirname, '../../cfop-app');
const ESBUILD = resolve(CFOP_APP_DIR, 'node_modules/.bin/esbuild');
const BUNDLE_PATH = '/tmp/cubify-twisty-bundle.js';

const PLAYER_W = 288;
const PLAYER_VIZ_H = 288; // viewport and output image size
// Control panel is ~52px tall at the bottom of the player.
// clip-path: inset(0 0 52px 0) removes it visually from a 288px-tall player.
// Player and viewport are both 288px; the bottom 52px of the player is the control panel.
const CONTROL_PANEL_H = 64;
const PLAYER_H = PLAYER_VIZ_H;
const VIEWPORT_H = PLAYER_VIZ_H;

function ensureBundle() {
  if (existsSync(BUNDLE_PATH)) return;
  const entry = resolve(CFOP_APP_DIR, '__cubify-entry.mjs');
  writeFileSync(entry, `import { TwistyPlayer } from 'cubing/twisty';\nwindow.TwistyPlayer = TwistyPlayer;\n`);
  try {
    execSync(
      `"${ESBUILD}" "${entry}" --bundle --format=iife --outfile="${BUNDLE_PATH}" --platform=browser --log-level=error`,
      { stdio: 'pipe', cwd: CFOP_APP_DIR }
    );
  } catch (err) {
    throw new Error(`Failed to bundle cubing.js: ${err.stderr?.toString() || err.message}`);
  } finally {
    try { execSync(`rm -f "${entry}"`); } catch { /* ignore */ }
  }
}

function buildHtml(config) {
  const { alg, setupAlg, visualization, mask } = config;

  // Pass ALL config in the constructor — setting properties post-append breaks WebGL
  const constructorArgs = {
    puzzle: '3x3x3',
    visualization,
    alg,
    ...(setupAlg ? { experimentalSetupAlg: setupAlg, experimentalSetupAnchor: 'start' } : {}),
    background: 'none',
  };

  const maskLine = mask
    ? `player.experimentalStickeringMaskOrbits = ${JSON.stringify(mask)};`
    : '';

  return `<!DOCTYPE html>
<html>
<head>
<style>
  html, body { margin: 0; padding: 0; width: ${PLAYER_W}px; height: ${VIEWPORT_H}px; background: white; overflow: hidden; }
  twisty-player { display: block; width: ${PLAYER_W}px; height: ${PLAYER_H}px; clip-path: inset(0 0 ${CONTROL_PANEL_H}px 0); }
</style>
</head>
<body>
<script src="/bundle.js"></script>
<script>
  const player = new window.TwistyPlayer(${JSON.stringify(constructorArgs)});
  document.body.appendChild(player);
  ${maskLine}
  setTimeout(() => { window.__playerReady = true; }, 3000);
</script>
</body>
</html>`;
}

function createRenderServer(html) {
  const bundleCode = readFileSync(BUNDLE_PATH);
  return new Promise((resolveServer) => {
    const server = createServer((req, res) => {
      if (req.url === '/bundle.js') {
        res.writeHead(200, { 'Content-Type': 'application/javascript' });
        res.end(bundleCode);
      } else {
        res.writeHead(200, { 'Content-Type': 'text/html' });
        res.end(html);
      }
    });
    server.listen(0, '127.0.0.1', () => {
      resolveServer({ port: server.address().port, server });
    });
  });
}

export async function renderCube(config) {
  const { outputFormat, outputPath } = config;

  ensureBundle();
  const html = buildHtml(config);
  const { port, server } = await createRenderServer(html);

  let browser;
  try {
    // headless: false required — headless Chromium blocks WebGL on macOS
    browser = await chromium.launch({ headless: false, args: ['--no-sandbox'] });
    const context = await browser.newContext({
      viewport: { width: PLAYER_W, height: VIEWPORT_H },
    });
    const page = await context.newPage();

    await page.goto(`http://127.0.0.1:${port}/`);
    try {
      await page.waitForFunction(() => window.__playerReady === true, { timeout: 10000 });
    } catch { /* proceed anyway */ }

    // Hide hint facelets post-render — setting in constructor breaks WebGL
    await page.evaluate(() => {
      const p = document.querySelector('twisty-player');
      if (p) p.hintFacelets = 'none';
    });

    if (outputFormat === 'svg') {
      await captureSvg(page, outputPath);
    } else {
      await capturePng(page, outputPath);
    }
  } catch (err) {
    if (err.message.includes("Executable doesn't exist") || err.message.includes('chromium')) {
      throw new Error('Chromium not found. Run: cd cfop-app && npx playwright install chromium');
    }
    throw err;
  } finally {
    if (browser) await browser.close();
    server.close();
  }
}

async function capturePng(page, outputPath) {
  // clip-path: inset(0 0 CONTROL_PANEL_H 0) on the player element hides the control panel
  // at the compositor level — no shadow DOM access needed. Viewport is PLAYER_VIZ_H so the
  // screenshot is already the right size.
  await page.screenshot({ path: outputPath });
}

async function captureSvg(page, outputPath) {
  // 2D visualization — take PNG and save with .svg path for now
  // TwistyPlayer shadow DOM is closed; true SVG extraction requires browser download API
  // Render as PNG using same approach, write to outputPath
  await capturePng(page, outputPath);
}
