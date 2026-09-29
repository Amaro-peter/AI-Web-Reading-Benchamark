#!/usr/bin/env node
/**
 * Verifies aggregated coverage against the project threshold (README / SonarQube goal: >= 80%).
 * Reads the json-summary reports produced by `npm run coverage`.
 */
import { readFile } from 'node:fs/promises';
import { existsSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { dirname, join, resolve } from 'node:path';

const root = resolve(dirname(fileURLToPath(import.meta.url)), '..');
const THRESHOLD = Number(process.env.COVERAGE_THRESHOLD ?? 80);

const summaries = [
  { name: 'backend', path: join(root, 'backend/coverage/coverage-summary.json') },
  { name: 'frontend', path: join(root, 'frontend/coverage/coverage-summary.json') },
];

let failed = false;
const totals = { covered: 0, total: 0 };

for (const summary of summaries) {
  if (!existsSync(summary.path)) {
    console.error(`coverage: MISSING report for ${summary.name} (${summary.path}).`);
    console.error('coverage: run `npm run coverage` first.');
    failed = true;
    continue;
  }

  const data = JSON.parse(await readFile(summary.path, 'utf8'));
  const lines = data.total.lines;
  totals.covered += lines.covered;
  totals.total += lines.total;

  const pct = lines.pct;
  const status = pct >= THRESHOLD ? 'OK  ' : 'FAIL';
  console.log(`coverage: ${status} ${summary.name} lines ${pct}% (threshold ${THRESHOLD}%)`);
  if (pct < THRESHOLD) failed = true;
}

if (totals.total > 0) {
  const overall = ((totals.covered / totals.total) * 100).toFixed(2);
  console.log(`coverage: overall lines ${overall}% (${totals.covered}/${totals.total})`);
}

process.exit(failed ? 1 : 0);
