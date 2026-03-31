import { chromium } from 'playwright';
import { readFileSync } from 'fs';
import { createServer } from 'http';

const bundleCode = readFileSync('/tmp/cubify-twisty-bundle.js');
const html = `<!DOCTYPE html>
<html><head>
<style>html,body{margin:0;padding:0;width:500px;height:500px;background:lightyellow;}
twisty-player{display:block;width:400px;height:400px;border:2px solid red;}</style>
</head><body>
<p id="status">loading...</p>
<script src="/bundle.js"></script>
<script>
  const s = document.getElementById('status');

  // Check registration
  const registered = customElements.get('twisty-player');
  s.textContent = 'registered: ' + (registered ? 'YES' : 'NO') + ', TwistyPlayer: ' + typeof window.TwistyPlayer;
  console.log('registered:', !!registered, 'same class:', registered === window.TwistyPlayer);

  // Try TWO approaches
  // 1. new TwistyPlayer and append
  const p1 = new window.TwistyPlayer({
    puzzle:'3x3x3', visualization:'PG3D', alg:"R U R' U'", background:'none',
  });
  document.body.appendChild(p1);
  console.log('p1 connected, sr:', !!p1.shadowRoot);

  // 2. document.createElement
  const p2 = document.createElement('twisty-player');
  document.body.appendChild(p2);
  p2.alg = "R U R' U'";
  p2.background = 'none';
  console.log('p2 created via createElement, sr:', !!p2.shadowRoot);

  setTimeout(() => {
    console.log('4s: p1 sr:', !!p1.shadowRoot, 'p1 canvas:', !!p1.querySelector('canvas'));
    console.log('4s: p2 sr:', !!p2.shadowRoot, 'p2 canvas:', !!p2.querySelector('canvas'));
    window.__done = true;
  }, 4000);
</script>
</body></html>`;

const server = await new Promise(res => {
  const s = createServer((req, res2) => {
    if (req.url === '/bundle.js') { res2.writeHead(200,{'Content-Type':'application/javascript'}); res2.end(bundleCode); }
    else { res2.writeHead(200,{'Content-Type':'text/html'}); res2.end(html); }
  });
  s.listen(0, '127.0.0.1', () => res(s));
});
const {port} = server.address();

const browser = await chromium.launch({ headless: false, args: ['--no-sandbox'] });
const page = await browser.newPage({ viewport:{width:500,height:500} });
const msgs = [];
page.on('console', m => msgs.push(m.text().slice(0,300)));
page.on('pageerror', e => msgs.push('ERR:'+e.message.slice(0,100)));

await page.goto(`http://127.0.0.1:${port}/`);
try { await page.waitForFunction(() => window.__done, {timeout:8000}); } catch {}

msgs.forEach(m => console.log(m));
await page.screenshot({path:'/tmp/cubify-ce.png'});
await browser.close();
server.close();
