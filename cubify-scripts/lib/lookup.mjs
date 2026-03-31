import { readFileSync } from 'fs';
import { resolve, dirname } from 'path';
import { fileURLToPath } from 'url';

const __dirname = dirname(fileURLToPath(import.meta.url));
const DATA_DIR = resolve(__dirname, '../../cfop-app/public/data');

const DATA_FILES = [
  'algs-cfop-oll.json',
  'algs-cfop-pll.json',
  'algs-cfop-f2l.json',
  'algs-cfop-bgr.json',
];

function loadAllCases() {
  const cases = [];
  for (const file of DATA_FILES) {
    try {
      const raw = readFileSync(resolve(DATA_DIR, file), 'utf8');
      const data = JSON.parse(raw);
      // Each file is either an array of cases or an object with a cases array
      const entries = Array.isArray(data) ? data : (data.cases ?? []);
      cases.push(...entries);
    } catch {
      // Skip unreadable files silently
    }
  }
  return cases;
}

export function lookupCase(caseId) {
  const all = loadAllCases();
  const found = all.find(c => c.id === caseId);
  if (!found) {
    const available = all.map(c => c.id).filter(Boolean).join(', ');
    throw new Error(`Unknown case ID "${caseId}".\nAvailable: ${available}`);
  }
  return found;
}

export function loadFile(filePath) {
  const raw = readFileSync(filePath, 'utf8');
  const data = JSON.parse(raw);
  return Array.isArray(data) ? data : (data.cases ?? []);
}
