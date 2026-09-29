import { readFileSync } from 'node:fs';
import { dirname, join, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';

const fixturesDir = resolve(dirname(fileURLToPath(import.meta.url)), '..', 'fixtures');

export type FixtureName = 'article' | 'empty' | 'malicious';

/** Reads a deterministic HTML fixture used by regression and security tests. */
export function loadFixture(name: FixtureName): string {
  return readFileSync(join(fixturesDir, `${name}.html`), 'utf8');
}

export const FIXTURE_URL = 'https://fixtures.test/article';
