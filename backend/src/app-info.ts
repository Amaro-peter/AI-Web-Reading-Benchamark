/**
 * Static identity of the service, surfaced by /api/health and by the UI
 * disclaimer. Kept in one place so the version is not duplicated.
 */
export const APP_NAME = 'AI Web Reading Benchmark';

export const APP_VERSION = '0.1.0';

/**
 * The benchmark is experimental. This text is returned by the API and shown in
 * the UI so a result is never read as an authoritative model ranking.
 */
export const BENCHMARK_DISCLAIMER =
  'Experimental benchmark. Results depend on the page, the questions, the models ' +
  'and the evaluation method, and must not be read as a definitive model ranking.';
