/**
 * @vitest-environment node
 */
import { readdirSync, readFileSync, statSync } from 'node:fs';
import { join, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';
import { describe, expect, it } from 'vitest';

const frontendRoot = resolve(fileURLToPath(import.meta.url), '../../..');

/** Names of variables that must never be referenced from frontend code. */
const SECRET_ENV_NAMES = ['GEMINI_API_KEY', 'OPENAI_API_KEY', 'ANTHROPIC_API_KEY'];

function sourceFiles(dir: string): string[] {
  const out: string[] = [];
  for (const entry of readdirSync(dir)) {
    const full = join(dir, entry);
    if (statSync(full).isDirectory()) {
      out.push(...sourceFiles(full));
    } else if (/\.(ts|tsx|js|jsx|mjs|css)$/.test(entry)) {
      out.push(full);
    }
  }
  return out;
}

describe('frontend secret exposure', () => {
  const files = sourceFiles(join(frontendRoot, 'src'));

  it('has frontend sources to scan', () => {
    expect(files.length).toBeGreaterThan(0);
  });

  it.each(SECRET_ENV_NAMES)('never references %s', (name) => {
    const offenders = files.filter((f) => readFileSync(f, 'utf8').includes(name));
    expect(offenders).toEqual([]);
  });

  it('exposes no NEXT_PUBLIC_ variable whose name looks like a secret', () => {
    const suspicious = /NEXT_PUBLIC_[A-Z0-9_]*(KEY|SECRET|TOKEN|PASSWORD|CREDENTIAL)/;
    const offenders = files.filter((f) => suspicious.test(readFileSync(f, 'utf8')));
    expect(offenders).toEqual([]);
  });
});
