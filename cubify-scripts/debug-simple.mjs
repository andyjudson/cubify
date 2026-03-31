import { chromium } from 'playwright';
import { createServer } from 'http';
import { readFileSync } from 'fs';

// Test 1: Simple script (no bundle)
// Test 2: Bundle load check

const bundleCode = readFileSync('/tmp/cubify-twisty-bundle.js', 'utf8');
const bundleSize = bundleCode.length;

const html = `<!DOCTYPE html>
<html><body>
<script>console.log('script running, bundle size was: ${bundleSize}');</script>
<script>
  // Inline a tiny portion of bundle check
  try {
    ${bundleCode.slice(0, 100)} // just the first 100 chars to test parsing
  } catch(e) { console.log('bundle parse err (expected for slice):', e.message); }
</script>
<script>
// Load full bundle separately
</script>
</body></html>`;

// Test with just a console.log
const simpleHtml = `<!DOCTYPE html><html><body>
<script>
  console.log('hello from page');
  window.__done = true;
</script>
</body></html>`;

const server = await new Promise(res => {
  let i = 0;
  const pages = [simpleHtml, html];
  const s = createServer((req, resp) => {
    resp.writeHead(200, {'Content-Type':'text/html'});
    resp.end(pages[i++ % 2]);
  });
  s.listen(0, '127.0.0.1', () => res(s));
});
const port = server.address().port;

console.log('--- Test with Playwright Chromium ---');
{
  const browser = await chromium.launch({ args: ['--no-sandbox'] });
  const page = await browser.newPage({ viewport: { width: 288, height: 288 } });
  const msgs = [];
  page.on('console', m => msgs.push(m.text()));
  page.on('pageerror', e => msgs.push('ERR:' + e.message.slice(0,80)));
  await page.goto(`http://127.0.0.1:${port}/`);
  await page.waitForTimeout(1000);
  console.log('Simple msgs:', msgs);
  await browser.close();
}

server.close();
