import { describe, expect, it } from 'vitest';
import { APP_NAME, APP_VERSION, BENCHMARK_DISCLAIMER } from '../../src/app-info.js';

describe('app-info', () => {
  it('exposes the product name', () => {
    expect(APP_NAME).toBe('AI Web Reading Benchmark');
  });

  it('exposes a semver version', () => {
    expect(APP_VERSION).toMatch(/^\d+\.\d+\.\d+$/);
  });

  it('states that the benchmark is experimental and result-dependent', () => {
    expect(BENCHMARK_DISCLAIMER).toContain('Experimental');
    for (const dependency of ['page', 'questions', 'models', 'evaluation method']) {
      expect(BENCHMARK_DISCLAIMER).toContain(dependency);
    }
  });
});
