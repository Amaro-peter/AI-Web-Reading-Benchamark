#!/usr/bin/env node
import { rm } from 'node:fs/promises';
import { fileURLToPath } from 'node:url';
import { dirname, join, resolve } from 'node:path';

const root = resolve(dirname(fileURLToPath(import.meta.url)), '..');

const targets = [
  'backend/dist',
  'backend/coverage',
  'backend/reports',
  'backend/.stryker-tmp',
  'frontend/.next',
  'frontend/coverage',
  'frontend/tsconfig.tsbuildinfo',
  'playwright-report',
  'test-results',
  'blob-report',
  '.scannerwork',
];

await Promise.all(targets.map((t) => rm(join(root, t), { recursive: true, force: true })));

console.log(`clean: removed ${targets.length} build/report target(s)`);
