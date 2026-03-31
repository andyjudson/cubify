import { chromium } from 'playwright';
import { readFileSync } from 'fs';
import { createServer } from 'http';

const bundleCode = readFileSync('/tmp/cubify-twisty-bundle.js', 'utf8');
const html = `<!DOCTYPE html>
<html><head>
<style>html,body{margin:0;padding:0;width:288px;height:288px;background:white;} twisty-player{display:block;width:288px;height:288px;}</style>
</head><body>
<script>${bundleCode}</script>
<script>
  const p = new window.TwistyPlayer({ puzzle:'3x3x3', visualization:'PG3D', alg:"R U R' U'", background:'none', hintFacelets:'none', controlPanel:'none' });
  document.body.appendChild(p);
  setTimeout(() => { window.__ready = true; }, 3000);
</script>
</body></html>`;

const server = await new Promise(res => {
  const s = createServer((req, resp) => { resp.writeHead(200,{'Content-Type':'text/html'}); resp.end(html); });
  s.listen(0, '127.0.0.1', () => res(s));
});
const port = server.address().port;

const browser = await chromium.launch({
  executablePath: '/Applications/Google Chrome.app/Contents/MacOS/Google Chrome',
  args: ['--no-sandbox'],
});
const page = await browser.newPage({ viewport: { width: 288, height: 288 } });
const msgs = [];
page.on('console', m => msgs.push(`[${m.type()}] ${m.text().slice(0,120)}`));
page.on('pageerror', e => msgs.push(`[err] ${e.message.slice(0,120)}`));

await page.goto(`http://127.0.0.1:${port}/`);
await page.waitForTimeout(4000);

console.log('Messages:', msgs.slice(0,5).join('\n'));
const info = await page.evaluate(() => {
  const p = document.querySelector('twisty-player');
  return p ? `sr:${!!p.shadowRoot} canvas:${!!p.querySelector('canvas')}` : 'no player';
});
console.log('DOM:', info);
await page.screenshot({ path: '/tmp/cubify-chrome.png' });
await browser.close();
server.close();
console.log('done');
