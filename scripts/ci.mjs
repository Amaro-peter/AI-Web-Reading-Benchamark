#!/usr/bin/env node
/**
 * Local CI pipeline (README §"CI local").
 *
 * Runs every quality gate in order, stops at the first failure of a required
 * stage, and exits non-zero. Optional stages (SonarQube) may report NOT RUN
 * without failing the build, but they never report success they did not earn.
 */
import { spawnSync } from 'node:child_process';
import { fileURLToPath } from 'node:url';
import { dirname, resolve } from 'node:path';

const root = resolve(dirname(fileURLToPath(import.meta.url)), '..');

/** @type {{name: string, script: string, required?: boolean}[]} */
const STAGES = [
  { name: 'clean', script: 'clean' },
  { name: 'dependencies', script: null, command: ['npm', ['ci', '--no-audit', '--no-fund']] },
  { name: 'typecheck', script: 'typecheck' },
  { name: 'lint', script: 'lint' },
  { name: 'format check', script: 'format:check' },
  { name: 'dead code', script: 'dead-code' },
  { name: 'unit tests', script: 'test:unit' },
  { name: 'integration tests', script: 'test:integration' },
  { name: 'regression tests', script: 'test:regression' },
  { name: 'specification tests', script: 'test:spec' },
  { name: 'security tests', script: 'test:security' },
  { name: 'dependency & secret audit', script: 'security:audit' },
  { name: 'smoke tests', script: 'test:smoke' },
  { name: 'mutation tests', script: 'test:mutation' },
  { name: 'build', script: 'build' },
  { name: 'system / e2e tests', script: 'test:e2e' },
  { name: 'coverage', script: 'coverage' },
  { name: 'coverage verification', script: 'coverage:verify' },
  { name: 'sonarqube', script: 'quality:sonar', required: false },
];

const skip = new Set(
  (process.env.CI_SKIP ?? '')
    .split(',')
    .map((s) => s.trim())
    .filter(Boolean),
);

if (skip.size > 0) {
  console.warn(`\n!! CI_SKIP is set: skipping ${[...skip].join(', ')}.`);
  console.warn('!! A run with CI_SKIP is NOT a green pipeline. Do not report it as one.\n');
}

const line = (char = '-') => char.repeat(72);
const results = [];
let failed = null;

const started = Date.now();

for (const [index, stage] of STAGES.entries()) {
  const label = `${String(index + 1).padStart(2, '0')}/${STAGES.length} ${stage.name}`;

  if (skip.has(stage.script) || skip.has(stage.name)) {
    results.push({ name: stage.name, status: 'SKIPPED (CI_SKIP)', ms: 0 });
    console.log(`\n${line('=')}\n== ${label}: SKIPPED via CI_SKIP\n${line('=')}`);
    continue;
  }

  console.log(`\n${line('=')}\n== ${label}\n${line('=')}`);

  const [cmd, args] = stage.command ?? ['npm', ['run', stage.script]];
  const stageStart = Date.now();
  const proc = spawnSync(cmd, args, { cwd: root, stdio: 'inherit', shell: false });
  const ms = Date.now() - stageStart;

  const ok = proc.status === 0;
  results.push({
    name: stage.name,
    status: ok ? 'PASS' : stage.required === false ? 'FAIL (optional)' : 'FAIL',
    ms,
  });

  if (!ok && stage.required !== false) {
    failed = stage.name;
    break;
  }
}

console.log(`\n${line('=')}\n== PIPELINE SUMMARY\n${line('=')}`);
for (const r of results) {
  console.log(`${r.status.padEnd(18)} ${r.name.padEnd(32)} ${(r.ms / 1000).toFixed(1)}s`);
}
const notRun = STAGES.length - results.length;
if (notRun > 0) {
  console.log(`\n${notRun} later stage(s) NOT RUN — pipeline stopped at "${failed}".`);
}
console.log(`\ntotal ${((Date.now() - started) / 1000).toFixed(1)}s`);

if (failed) {
  console.error(`\nCI FAILED at stage: ${failed}`);
  process.exit(1);
}

if (skip.size > 0) {
  console.warn('\nCI finished, but stages were skipped via CI_SKIP — this is not a green run.');
  process.exit(0);
}

console.log('\nCI PASSED');
