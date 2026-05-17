import { readFileSync, writeFileSync, readdirSync, statSync } from 'fs';
import { join } from 'path';
import { fileURLToPath } from 'url';

const distDir = fileURLToPath(new URL('../dist', import.meta.url));

function fix(dir) {
  for (const name of readdirSync(dir)) {
    const fp = join(dir, name);
    if (statSync(fp).isDirectory()) {
      fix(fp);
    } else if (fp.endsWith('.js')) {
      const src = readFileSync(fp, 'utf8');
      const out = src.replace(/\.worker\.ts/g, '.worker.js');
      if (src !== out) writeFileSync(fp, out);
    }
  }
}

fix(distDir);
