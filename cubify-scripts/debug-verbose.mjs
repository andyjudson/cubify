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
  console.log('after bundle load, TwistyPlayer type:', typeof window.TwistyPlayer);
  if (typeof window.TwistyPlayer === 'function') {
    const p = new window.TwistyPlayer({
      puzzle:'3x3x3', visualization:'PG3D', alg:"R U R' U'",
      background:'none', hintFacelets:'none', controlPanel:'none',
    });
    document.body.appendChild(p);
    console.log('player appended, tag:', p.tagName, 'sr:', !!p.shadowRoot);
    setTimeout(() => {
      console.log('3s later, sr:', !!p.shadowRoot, 'canvas:', !!p.querySelector('canvas'));
      window.__done = true;
    }, 3000);
  } else {
    window.__done = true;
  }
</script>
</body></html>`;

const server = await new Promise(res => {
  const s = createServer((req, res2) => {
    if (req.url === '/bundle.js') {
      res2.writeHead(200, {'Content-Type':'application/javascript'});
      res2.end(bundleCode);
    } else {
      res2.writeHead(200, {'Content-Type':'text/html'});
      res2.end(html);
    }
  });
  s.listen(0, '127.0.0.1', () => res(s));
});
const port = server.address().port;
console.log('Server on port', port);

const browser = await chromium.launch({ args: ['--no-sandbox'] });
const page = await browser.newPage({ viewport:{width:288,height:288} });
const msgs = [];
page.on('console', m => { msgs.push(`[${m.type()}] ${m.text().slice(0,200)}`); });
page.on('pageerror', e => { msgs.push(`[pageerror] ${e.message.slice(0,200)}`); });
page.on('requestfailed', r => { msgs.push(`[reqfail] ${r.url()} - ${r.failure()?.errorText}`); });

await page.goto(`http://127.0.0.1:${port}/`);
try { await page.waitForFunction(() => window.__done, {timeout: 8000}); } catch { console.log('timeout'); }

console.log('Console output:');
msgs.forEach(m => console.log(' ', m));

const info = await page.evaluate(() => {
  const p = document.querySelector('twisty-player');
  if (!p) return 'no player';
  return `sr:${!!p.shadowRoot} canvas:${!!p.querySelector('canvas')} innerHTML:${p.innerHTML.length}`;
});
console.log('DOM info:', info);
await page.screenshot({path: '/tmp/cubify-verbose.png'});
await browser.close();
server.close();
