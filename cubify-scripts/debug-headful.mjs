import { chromium } from 'playwright';
import { readFileSync } from 'fs';
import { createServer } from 'http';

const bundleCode = readFileSync('/tmp/cubify-twisty-bundle.js');
const html = `<!DOCTYPE html>
<html><head>
<style>html,body{margin:0;padding:0;width:288px;height:288px;background:white;} twisty-player{display:block;width:288px;height:288px;}</style>
</head><body>
<script src="/bundle.js"></script>
<script>
  console.log('TwistyPlayer:', typeof window.TwistyPlayer);
  const p = new window.TwistyPlayer({
    puzzle:'3x3x3', visualization:'PG3D', alg:"R U R' U'",
    background:'none', hintFacelets:'none', controlPanel:'none',
  });
  document.body.appendChild(p);
  setTimeout(() => { window.__done = true; }, 3000);
</script>
</body></html>`;

const server = await new Promise(res => {
  const s = createServer((req, res2) => {
    if (req.url === '/bundle.js') { res2.writeHead(200,{'Content-Type':'application/javascript'}); res2.end(bundleCode); }
    else { res2.writeHead(200,{'Content-Type':'text/html'}); res2.end(html); }
  });
  s.listen(0, '127.0.0.1', () => res(s));
});
const port = server.address().port;

const browser = await chromium.launch({ headless: false, args: ['--no-sandbox'] });
const page = await browser.newPage({ viewport:{width:288,height:288} });
const msgs = [];
page.on('console', m => msgs.push(`[${m.type()}] ${m.text().slice(0,150)}`));
page.on('pageerror', e => msgs.push(`[err] ${e.message.slice(0,100)}`));

await page.goto(`http://127.0.0.1:${port}/`);
try { await page.waitForFunction(() => window.__done, {timeout:8000}); } catch {}

console.log('Messages:');
msgs.forEach(m => console.log(' ', m));
await page.screenshot({path:'/tmp/cubify-headful.png'});
await browser.close();
server.close();
console.log('done');
