#!/usr/bin/env node
/**
 * Runs SonarQube analysis when a local server and scanner are reachable.
 * When they are not, it prints setup instructions and exits 0 with an explicit
 * NOT RUN message — the pipeline must never claim an analysis that did not happen.
 */
import { spawnSync } from 'node:child_process';
import { fileURLToPath } from 'node:url';
import { dirname, resolve } from 'node:path';

const root = resolve(dirname(fileURLToPath(import.meta.url)), '..');
const hostUrl = process.env.SONAR_HOST_URL ?? 'http://localhost:9000';
const token = process.env.SONAR_TOKEN;

function instructions(reason) {
  console.log(`quality:sonar: NOT RUN — ${reason}`);
  console.log('');
  console.log('To enable SonarQube analysis locally:');
  console.log('  1. Start a server:');
  console.log('       docker run -d --name sonarqube -p 9000:9000 sonarqube:community');
  console.log('  2. Open http://localhost:9000 (default login admin/admin) and create a token.');
  console.log('  3. Export the credentials:');
  console.log('       export SONAR_HOST_URL=http://localhost:9000');
  console.log('       export SONAR_TOKEN=<your-token>');
  console.log('  4. Generate coverage first:  npm run coverage');
  console.log('  5. Re-run:                   npm run quality:sonar');
  console.log('');
  console.log('Analysis settings live in sonar-project.properties.');
}

async function reachable(url) {
  try {
    const controller = new AbortController();
    const timer = setTimeout(() => controller.abort(), 3000);
    const res = await fetch(`${url}/api/system/status`, { signal: controller.signal });
    clearTimeout(timer);
    return res.ok;
  } catch {
    return false;
  }
}

if (!(await reachable(hostUrl))) {
  instructions(`no SonarQube server responding at ${hostUrl}`);
  process.exit(0);
}

if (!token) {
  instructions('SonarQube server is up but SONAR_TOKEN is not set');
  process.exit(0);
}

const probe = spawnSync('sonar-scanner', ['--version'], { encoding: 'utf8' });
if (probe.error) {
  instructions('sonar-scanner CLI is not installed (npm i -g sonarqube-scanner)');
  process.exit(0);
}

console.log(`quality:sonar: running sonar-scanner against ${hostUrl}`);
const result = spawnSync(
  'sonar-scanner',
  [`-Dsonar.host.url=${hostUrl}`, `-Dsonar.token=${token}`],
  { cwd: root, stdio: 'inherit' },
);

process.exit(result.status ?? 1);
