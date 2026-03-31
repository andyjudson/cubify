import { mkdirSync, existsSync } from 'fs';
import { resolve } from 'path';
import { homedir } from 'os';

const OUTPUT_DIR = resolve(homedir(), '.claude', 'tmp', 'cubify');

export function ensureOutputDir() {
  if (!existsSync(OUTPUT_DIR)) {
    mkdirSync(OUTPUT_DIR, { recursive: true });
  }
  return OUTPUT_DIR;
}
