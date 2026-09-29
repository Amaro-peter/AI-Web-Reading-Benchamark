#!/usr/bin/env node
/**
 * Dependency + secret audit.
 *  - `npm audit` fails the build on high/critical advisories.
 *  - Gitleaks runs when available; when it is not installed the script reports
 *    NOT RUN with the reason instead of pretending the scan happened.
 */
import { spawnSync } from 'node:child_process';
import { fileURLToPath } from 'node:url';
import { dirname, resolve } from 'node:path';

const root = resolve(dirname(fileURLToPath(import.meta.url)), '..');

function run(cmd, args, opts = {}) {
  return spawnSync(cmd, args, { cwd: root, encoding: 'utf8', shell: false, ...opts });
}

let failed = false;

console.log('security:audit: running `npm audit --audit-level=high`');
const audit = run('npm', ['audit', '--audit-level=high', '--omit=dev']);
process.stdout.write(audit.stdout ?? '');
if (audit.status !== 0) {
  process.stderr.write(audit.stderr ?? '');
  console.error('security:audit: FAIL npm audit reported high/critical advisories');
  failed = true;
} else {
  console.log('security:audit: OK npm audit clean at high/critical level');
}

const gitleaksProbe = run('gitleaks', ['version']);
if (gitleaksProbe.error) {
  console.log('security:audit: NOT RUN — gitleaks is not installed on this machine.');
  console.log('security:audit: install it with `brew install gitleaks` or see');
  console.log('security:audit: https://github.com/gitleaks/gitleaks#installing');
} else {
  console.log(`security:audit: running gitleaks ${String(gitleaksProbe.stdout).trim()}`);
  const leaks = run('gitleaks', ['detect', '--no-banner', '--redact', '--source', '.']);
  process.stdout.write(leaks.stdout ?? '');
  if (leaks.status !== 0) {
    process.stderr.write(leaks.stderr ?? '');
    console.error('security:audit: FAIL gitleaks found potential secrets');
    failed = true;
  } else {
    console.log('security:audit: OK gitleaks found no secrets');
  }
}

process.exit(failed ? 1 : 0);
