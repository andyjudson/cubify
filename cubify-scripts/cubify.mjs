import { resolve, basename, extname } from 'path';
import { readFileSync } from 'fs';
import { ensureOutputDir } from './lib/output.mjs';
import { renderCube } from './lib/renderer.mjs';
import { lookupCase } from './lib/lookup.mjs';
import { maskForType } from './lib/masks.mjs';

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

function typeToConfig(type) {
  // All output formats are PNG — Playwright screenshot only supports PNG.
  // OLL/PLL use 2D top-layer visualization; others use 3D perspective.
  switch (type) {
    case 'oll':   return { visualization: 'experimental-2D-LL', mask: maskForType('oll'),     outputFormat: 'png' };
    case 'pll':   return { visualization: 'experimental-2D-LL', mask: maskForType('pll'),     outputFormat: 'png' };
    case 'f2l':   return { visualization: 'PG3D',               mask: maskForType('f2l'),     outputFormat: 'png' };
    case 'cross': return { visualization: 'PG3D',               mask: maskForType('cross'),   outputFormat: 'png' };
    default:      return { visualization: 'PG3D',               mask: maskForType('default'), outputFormat: 'png' };
  }
}

function applyForceFlags(config) {
  if (force2d) { config.visualization = 'experimental-2D-LL'; config.outputFormat = 'svg'; }
  if (force3d) { config.visualization = 'PG3D';               config.outputFormat = 'png'; }
  return config;
}

// --- Run ---

const outputDir = ensureOutputDir();

if (mode === 'alg') {
  const alg = rawAlgTokens.join(' ');

  // Validate via cubing.js Alg parser (dynamic import from cfop-app)
  try {
    const { Alg } = await import('../cfop-app/node_modules/cubing/dist/lib/cubing/alg/index.js');
    Alg.fromString(alg);
  } catch (err) {
    console.error(`Error: Invalid algorithm "${alg}" — ${err.message}`);
    process.exit(1);
  }

  const timestamp = Date.now();
  const config = applyForceFlags(typeToConfig('default'));
  const ext = config.outputFormat;
  const outputPath = resolve(outputDir, `cubify-${timestamp}.${ext}`);

  await renderCube({ ...config, alg, setupAlg, outputPath });
  console.log(outputPath);

} else if (mode === 'case') {
  let caseEntry;
  try {
    caseEntry = await lookupCase(caseId);
  } catch (err) {
    console.error(`Error: ${err.message}`);
    process.exit(1);
  }

  const caseType = caseEntry.method || caseEntry.type || 'default';
  const config = applyForceFlags(typeToConfig(caseType));
  const ext = config.outputFormat;
  const outputPath = resolve(outputDir, `${caseId}.${ext}`);

  await renderCube({
    ...config,
    alg: caseEntry.notation || caseEntry.alg,
    setupAlg: setupAlg || caseEntry.setup || '',
    outputPath,
  });
  console.log(outputPath);

} else if (mode === 'file') {
  // Resolve path — relative paths default to cfop-app/public/data/
  const resolvedPath = filePath.startsWith('/')
    ? filePath
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
    const caseType = c.method || c.type || 'default';
    const config = applyForceFlags(typeToConfig(caseType));
    const ext = config.outputFormat;
    const outputPath = resolve(outputDir, `${c.id}.${ext}`);
    try {
      await renderCube({
        ...config,
        alg: c.notation || c.alg,
        setupAlg: setupAlg || c.setup || '',
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
