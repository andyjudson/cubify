import { chromium } from 'playwright';
import { readFileSync, writeFileSync, existsSync } from 'fs';
import { execSync } from 'child_process';
import { resolve, dirname } from 'path';
import { fileURLToPath } from 'url';

const __dirname = dirname(fileURLToPath(import.meta.url));
const CFOP_APP_DIR = resolve(__dirname, '../cfop-app');
const ESBUILD = resolve(CFOP_APP_DIR, 'node_modules/.bin/esbuild');
const BUNDLE_PATH = '/tmp/cubify-twisty-bundle.js';

if (!existsSync(BUNDLE_PATH)) {
  const entry = resolve(CFOP_APP_DIR, '__cubify-entry.mjs');
  writeFileSync(entry, `import { TwistyPlayer } from 'cubing/twisty';\nwindow.TwistyPlayer = TwistyPlayer;\n`);
  execSync(`"${ESBUILD}" "${entry}" --bundle --format=iife --outfile="${BUNDLE_PATH}" --platform=browser --log-level=error`, { cwd: CFOP_APP_DIR });
  execSync(`rm -f "${entry}"`);
  console.log('Bundle created');
}

const bundleCode = readFileSync(BUNDLE_PATH, 'utf8');
const html = `<!DOCTYPE html>
<html><head>
<style>html,body{margin:0;padding:0;width:288px;height:288px;background:white;} twisty-player{display:block;width:288px;height:288px;}</style>
</head><body>
<script>${bundleCode}</script>
<script>
  console.log('TwistyPlayer:', typeof window.TwistyPlayer);
  try {
    const player = new window.TwistyPlayer({
      puzzle: '3x3x3',
      visualization: 'PG3D',
      alg: "R U R' U'",
      background: 'none', hintFacelets: 'none', controlPanel: 'none',
    });
    document.body.appendChild(player);
    console.log('player tag:', player.tagName);
    setTimeout(() => { window.__ready = true; }, 3000);
  } catch(e) { console.error('error:', e.message, e.stack); }
</script>
</body></html>`;

const browser = await chromium.launch({ args: ['--no-sandbox', '--disable-gpu'] });
const page = await browser.newPage({ viewport: { width: 288, height: 288 } });
const msgs = [];
page.on('console', m => msgs.push(`[${m.type()}] ${m.text()}`));
page.on('pageerror', e => msgs.push(`[error] ${e.message}`));

await page.setContent(html);
await page.waitForTimeout(4000);

console.log('Console messages:');
msgs.forEach(m => console.log(' ', m));

const domInfo = await page.evaluate(() => {
  const p = document.querySelector('twisty-player');
  if (!p) return 'no twisty-player in DOM';
  return `tag: ${p.tagName}, sr: ${!!p.shadowRoot}, canvas: ${!!p.querySelector('canvas')}, innerHTML len: ${p.innerHTML.length}`;
});
console.log('DOM:', domInfo);

await page.screenshot({ path: '/tmp/cubify-debug-final.png' });
console.log('Screenshot taken');
await browser.close();
