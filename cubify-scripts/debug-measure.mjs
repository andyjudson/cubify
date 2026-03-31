// Measure where the control panel starts in TwistyPlayer
import { chromium } from 'playwright';
import { readFileSync } from 'fs';
import { createServer } from 'http';

const bundleCode = readFileSync('/tmp/cubify-twisty-bundle.js');
// Give the player plenty of height so we can see the full layout
const PLAYER_H = 500;

const html = `<!DOCTYPE html>
<html><head>
<style>
  html,body { margin:0;padding:0;width:288px;height:${PLAYER_H}px;background:white; }
  twisty-player { display:block;width:288px;height:${PLAYER_H}px; }
</style>
</head><body>
<script src="/bundle.js"></script>
<script>
  const p = new window.TwistyPlayer({ puzzle:'3x3x3', visualization:'PG3D', alg:"R U R' U'", background:'none' });
  document.body.appendChild(p);
  setTimeout(() => { window.__done = true; }, 3000);
</script>
</body></html>`;

const server = await new Promise(res => {
  const s = createServer((req, res2) => {
    if (req.url==='/bundle.js') { res2.writeHead(200,{'Content-Type':'application/javascript'}); res2.end(bundleCode); }
    else { res2.writeHead(200,{'Content-Type':'text/html'}); res2.end(html); }
  });
  s.listen(0, '127.0.0.1', () => res(s));
});
const {port} = server.address();

const browser = await chromium.launch({ headless: false, args: ['--no-sandbox'] });
const page = await browser.newPage({ viewport: {width: 288, height: PLAYER_H} });
await page.goto(`http://127.0.0.1:${port}/`);
try { await page.waitForFunction(() => window.__done, {timeout:8000}); } catch {}

// Take a full screenshot at full height to see layout
await page.screenshot({ path: '/tmp/cubify-measure.png' });
console.log(`Screenshot: 288×${PLAYER_H}`);

await browser.close();
server.close();
