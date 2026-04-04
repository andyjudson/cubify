import { resolve, basename } from 'path';
import { readFileSync } from 'fs';
import { ensureOutputDir } from './lib/output.mjs';
import { renderCube } from './lib/renderer.mjs';
import { lookupCase } from './lib/lookup.mjs';
import { maskForCase } from './lib/masks.mjs';

// --- Setup derivation ---
// For OLL/PLL: experimentalSetupAnchor='end' means the player shows the START of the alg
// by default (i.e. setup + inv(alg)), giving the recognition pattern.
// We only need z2 to orient yellow on top — cubing.js handles the inversion.
// An explicit --setup flag always overrides this.

async function getAlg() {
  const mod = await import('../cfop-app/node_modules/cubing/dist/lib/cubing/alg/index.js');
  return mod.Alg;
}

function deriveSetupAlg(method, alg, explicitSetup) {
  if (explicitSetup) return explicitSetup;
  if (method === 'oll' || method === 'pll') return 'z2';
  if (method === 'f2l') {
    // y-prefixed algs target the FL slot; compensate in setup to normalise display to FR slot
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
  console.error('Optional flags: --2d, --3d, --setup <alg>');
  process.exit(1);
}

let mode = null;
let caseId = null;
let filePath = null;
let rawAlgTokens = [];
let force2d = false;
let force3d = false;
let setupAlg = '';

for (let i = 0; i < args.length; i++) {
  const arg = args[i];
  if (arg === '--case') {
    mode = 'case';
    caseId = args[++i];
  } else if (arg === '--file') {
    mode = 'file';
    filePath = args[++i];
  } else if (arg === '--2d') {
    force2d = true;
  } else if (arg === '--3d') {
    force3d = true;
  } else if (arg === '--setup') {
    setupAlg = args[++i] || '';
  } else if (!arg.startsWith('--')) {
    rawAlgTokens.push(arg);
  }
}

if (!mode && rawAlgTokens.length > 0) mode = 'alg';

if (!mode) {
  console.error('Error: No input provided. Pass an algorithm, --case <id>, or --file <path>.');
  process.exit(1);
}

// --- Type-to-config mapping ---

// maskField: the 'mask' field value from JSON ('edge' | 'corner' | undefined)
function typeToConfig(method, maskField) {
  // All output formats are PNG — Playwright screenshot only supports PNG.
  // OLL/PLL use 2D top-layer visualization; others use 3D perspective.
  const orbits = maskForCase(method, maskField);
  switch (method) {
    case 'oll':   return { visualization: 'experimental-2D-LL', mask: orbits, outputFormat: 'png' };
    case 'pll':   return { visualization: 'experimental-2D-LL', mask: orbits, outputFormat: 'png' };
    case 'f2l':   return { visualization: 'PG3D',               mask: orbits, outputFormat: 'png' };
    case 'cross': return { visualization: 'PG3D',               mask: orbits, outputFormat: 'png' };
    default:      return { visualization: 'PG3D',               mask: orbits, outputFormat: 'png' };
  }
}

function applyForceFlags(config) {
  if (force2d) { config.visualization = 'experimental-2D-LL'; config.outputFormat = 'png'; }
  if (force3d) { config.visualization = 'PG3D';               config.outputFormat = 'png'; }
  return config;
}

// --- Run ---

const outputDir = ensureOutputDir();

if (mode === 'alg') {
  const alg = rawAlgTokens.join(' ');

  // Validate via cubing.js Alg parser
  try {
    const Alg = await getAlg();
    Alg.fromString(alg);
  } catch (err) {
    console.error(`Error: Invalid algorithm "${alg}" — ${err.message}`);
    process.exit(1);
  }

  const timestamp = Date.now();
  const config = applyForceFlags(typeToConfig('default', undefined));
  const ext = config.outputFormat;
  const outputPath = resolve(outputDir, `cubify-${timestamp}.${ext}`);
  const resolvedSetup = deriveSetupAlg('default', alg, setupAlg);

  await renderCube({ ...config, alg, setupAlg: resolvedSetup, outputPath });
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
  const config = applyForceFlags(typeToConfig(caseType, caseEntry.mask));
  const ext = config.outputFormat;
  const outputPath = resolve(outputDir, `${caseId}.${ext}`);

  const resolvedSetup = deriveSetupAlg(caseType, caseEntry.notation, setupAlg || caseEntry.setup || '');

  await renderCube({
    ...config,
    alg: caseEntry.notation,
    setupAlg: resolvedSetup,
    outputPath,
  });
  console.log(outputPath);

} else if (mode === 'file') {
  // Resolve path — bare filenames default to cfop-app/public/data/; paths with slashes resolve from cwd
  const resolvedPath = (filePath.startsWith('/') || filePath.includes('/'))
    ? resolve(filePath)
    : resolve('cfop-app/public/data', filePath);

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
    const config = applyForceFlags(typeToConfig(caseType, c.mask));
    const ext = config.outputFormat;
    const outputPath = resolve(outputDir, `${c.id}.${ext}`);
    try {
      const resolvedSetup = deriveSetupAlg(caseType, c.notation, setupAlg || c.setup || '');
      await renderCube({
        ...config,
        alg: c.notation,
        setupAlg: resolvedSetup,
        outputPath,
      });
      results.push({ ok: true, outputPath, id: c.id });
    } catch (err) {
      results.push({ ok: false, id: c.id, error: err.message });
    }
  }

  const ok = results.filter(r => r.ok);
  const fail = results.filter(r => !r.ok);
  console.log(`✓ Batch complete: ${ok.length}/${cases.length} images written to ${outputDir}/`);
  ok.forEach(r => console.log(`  ${basename(r.outputPath)}`));
  if (fail.length > 0) {
    console.error(`✗ ${fail.length} failed:`);
    fail.forEach(r => console.error(`  ${r.id}: ${r.error}`));
  }
}
