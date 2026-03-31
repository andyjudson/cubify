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
const PLAYER_VIZ_H = 288; // output image size
// TwistyPlayer allocates: cube_height = total_height - control_panel_height.
// Viewport and player are set taller so cube fills exactly PLAYER_VIZ_H px.
// Playwright clip crops the screenshot back to PLAYER_VIZ_H, excluding the panel.
const PLAYER_H = 288;
const VIEWPORT_H = 288;

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
  html, body { margin: 0; padding: 0; width: ${PLAYER_W}px; height: ${VIEWPORT_H}px; background: white; }
  twisty-player { display: block; width: ${PLAYER_W}px; height: ${PLAYER_H}px; }
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

    // Inject intercepts before any page scripts run
    await page.addInitScript(() => {
      // Intercept attachShadow to force open mode and capture the shadow root
      const _orig = Element.prototype.attachShadow;
      Element.prototype.attachShadow = function(opts) {
        const sr = _orig.call(this, { ...opts, mode: 'open' });
        if (!window.__playerShadowRoot) window.__playerShadowRoot = sr;
        return sr;
      };
      // Intercept getContext to capture WebGL canvas
      const _origCtx = HTMLCanvasElement.prototype.getContext;
      HTMLCanvasElement.prototype.getContext = function(type, opts) {
        const ctx = _origCtx.call(this, type, opts);
        if ((type === 'webgl' || type === 'webgl2') && !window.__renderCanvas) {
          window.__renderCanvas = this;
        }
        return ctx;
      };
    });

    await page.goto(`http://127.0.0.1:${port}/`);
    try {
      await page.waitForFunction(() => window.__playerReady === true, { timeout: 10000 });
    } catch { /* proceed anyway */ }


    // Post-render: hide hint facelets (safe post-render; controlPanel property breaks WebGL)
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
  // Get the visualization element bounding rect via intercepted shadow root references.
  // 3D (PG3D): clip to WebGL canvas rect — excludes control panel entirely.
  // 2D (experimental-2D-LL): clip to twisty-2d-scene-wrapper rect in the player shadow root.
  const rect = await page.evaluate(() => {
    // 3D path
    const canvas = window.__renderCanvas;
    if (canvas) {
      const r = canvas.getBoundingClientRect();
      return { x: r.x, y: r.y, width: r.width, height: r.height };
    }
    // 2D path — scene wrapper is a direct child of the player shadow root's inner div
    const sr = window.__playerShadowRoot;
    if (sr) {
      const scene = sr.querySelector('twisty-2d-scene-wrapper');
      if (scene) {
        const r = scene.getBoundingClientRect();
        return { x: r.x, y: r.y, width: r.width, height: r.height };
      }
    }
    return null;
  });

  if (rect && rect.width > 0 && rect.height > 0) {
    await page.screenshot({ path: outputPath, clip: rect });
    execSync(`sips -Z ${PLAYER_VIZ_H} "${outputPath}"`, { stdio: 'pipe' });
    execSync(`sips --padColor FFFFFF --padToHeightWidth ${PLAYER_VIZ_H} ${PLAYER_VIZ_H} "${outputPath}"`, { stdio: 'pipe' });
  } else {
    await page.screenshot({ path: outputPath });
  }
}


async function captureSvg(page, outputPath) {
  await capturePng(page, outputPath);
}
