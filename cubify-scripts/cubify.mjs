import { resolve, basename, dirname } from 'node:path';
import { readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { ensureOutputDir } from './lib/output.mjs';
import { render } from './lib/renderer.mjs';
import { lookupCase } from './lib/lookup.mjs';
import { getMask } from './lib/masks.mjs';

const __dirname = dirname(fileURLToPath(import.meta.url));
const CFOP_APP_DIR = process.env.CFOP_APP_DIR || resolve(__dirname, '../../cfop/cfop-app');

function cleanAlg(notation) {
  return (notation ?? '').replace(/[()[\]]/g, '').replace(/\s+/g, ' ').trim();
}

function deriveSetupAlg(method, alg, explicitSetup) {
  if (explicitSetup) return explicitSetup;
  if (method === 'oll' || method === 'pll') return 'z2';
  if (method === 'f2l') {
    const leadingY = alg && alg.match(/^(y'?)\s/);
    return leadingY ? `z2 ${leadingY[1]}` : 'z2';
  }
  return '';
}

// --- Arg parsing ---

const args = process.argv.slice(2);

if (args.length === 0) {
  console.error('Usage:');
  console.error('  node cubify.mjs <alg>');
  console.error('  node cubify.mjs --case <case-id>');
  console.error('  node cubify.mjs --file <path-to-json>');
  console.error('');
  console.error('Flags: --2d, --3d, --setup <alg>, --stickering <label|orbitstring>, --masked, --dim');
  process.exit(1);
}

let mode = null;
let caseId = null;
let filePath = null;
let rawAlgTokens = [];
let style = '3d';
let setupAlg = '';
let stickeringFlag = null;
let masked = false;
let dim = false;

for (let i = 0; i < args.length; i++) {
  const arg = args[i];
  if (arg === '--case') {
    mode = 'case'; caseId = args[++i];
  } else if (arg === '--file') {
    mode = 'file'; filePath = args[++i];
  } else if (arg === '--2d') {
    style = '2d';
  } else if (arg === '--3d') {
    style = '3d';
  } else if (arg === '--setup') {
    setupAlg = args[++i] || '';
  } else if (arg === '--stickering') {
    stickeringFlag = args[++i];
  } else if (arg === '--masked') {
    masked = true;
  } else if (arg === '--dim') {
    dim = true;
  } else if (!arg.startsWith('--')) {
    rawAlgTokens.push(arg);
  }
}

if (!mode && rawAlgTokens.length > 0) mode = 'alg';

if (!mode) {
  console.error('Error: No input provided. Pass an algorithm, --case <id>, or --file <path>.');
  process.exit(1);
}

function resolveExplicitStickering() {
  if (!stickeringFlag) return null;
  return dim ? stickeringFlag + '-dim' : stickeringFlag;
}

function resolveCaseStickering(caseEntry) {
  if (stickeringFlag) return resolveExplicitStickering();
  if (masked) return getMask(caseEntry.method ?? 'default', caseEntry.group ?? '', caseEntry.mask ?? null);
  return null;
}

// --- Run ---

const outputDir = ensureOutputDir();

if (mode === 'alg') {
  const alg = cleanAlg(rawAlgTokens.join(' '));
  const timestamp = Date.now();
  const outputPath = resolve(outputDir, `cubify-${timestamp}.png`);
  const resolvedSetup = deriveSetupAlg('default', alg, setupAlg) || null;

  await render(alg, { style, output: outputPath, stickering: resolveExplicitStickering(), setupAlg: resolvedSetup });
  console.log(outputPath);

} else if (mode === 'case') {
  let caseEntry;
  try {
    caseEntry = await lookupCase(caseId);
  } catch (err) {
    console.error(`Error: ${err.message}`);
    process.exit(1);
  }

  const caseType = caseEntry.method ?? 'default';
  const outputPath = resolve(outputDir, `${caseId}.png`);
  const resolvedSetup = deriveSetupAlg(caseType, caseEntry.notation, setupAlg || caseEntry.setup || '') || null;

  await render(cleanAlg(caseEntry.notation), {
    style,
    output: outputPath,
    stickering: resolveCaseStickering(caseEntry),
    setupAlg: resolvedSetup,
  });
  console.log(outputPath);

} else if (mode === 'file') {
  const resolvedPath = (filePath.startsWith('/') || filePath.includes('/'))
    ? resolve(filePath)
    : resolve(CFOP_APP_DIR, 'public/data', filePath);

  let cases;
  try {
    const raw = readFileSync(resolvedPath, 'utf8');
    cases = JSON.parse(raw);
    if (!Array.isArray(cases)) throw new Error('Expected a JSON array');
  } catch (err) {
    console.error(`Error: Cannot read "${filePath}" — ${err.message}`);
    process.exit(1);
  }

  const results = [];
  for (const c of cases) {
    const caseType = c.method ?? 'default';
    const outputPath = resolve(outputDir, `${c.id}.png`);
    try {
      const resolvedSetup = deriveSetupAlg(caseType, c.notation, setupAlg || c.setup || '', style) || null;
      await render(cleanAlg(c.notation), {
        style,
        output: outputPath,
        stickering: resolveCaseStickering(c),
        setupAlg: resolvedSetup,
      });
      results.push({ ok: true, outputPath, id: c.id });
    } catch (err) {
      results.push({ ok: false, id: c.id, error: err.message });
    }
  }

  const ok   = results.filter(r => r.ok);
  const fail = results.filter(r => !r.ok);
  console.log(`✓ Batch complete: ${ok.length}/${cases.length} images written to ${outputDir}/`);
  ok.forEach(r => console.log(`  ${basename(r.outputPath)}`));
  if (fail.length > 0) {
    console.error(`✗ ${fail.length} failed:`);
    fail.forEach(r => console.error(`  ${r.id}: ${r.error}`));
  }
}
