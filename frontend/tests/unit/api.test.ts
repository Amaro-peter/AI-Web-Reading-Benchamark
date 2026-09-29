/**
 * @vitest-environment node
 */
import { describe, expect, it, vi } from 'vitest';
import { API_BASE_URL, BenchmarkRequestError, runBenchmark } from '@/lib/api';
import { benchmarkResultFixture } from '../helpers/fixture';

function jsonResponse(body: unknown, status = 200) {
  return new Response(JSON.stringify(body), {
    status,
    headers: { 'content-type': 'application/json' },
  });
}

describe('runBenchmark', () => {
  it('posts JSON to the benchmark endpoint', async () => {
    const fetchImpl = vi.fn(async () => jsonResponse(benchmarkResultFixture()));
    await runBenchmark('https://example.com/a', {
      fetchImpl: fetchImpl as unknown as typeof fetch,
    });

    const [url, init] = fetchImpl.mock.calls[0] as unknown as [string, RequestInit];
    expect(url).toBe(`${API_BASE_URL}/api/benchmark`);
    expect(init.method).toBe('POST');
    expect(init.headers).toEqual({ 'content-type': 'application/json' });
    expect(JSON.parse(String(init.body))).toEqual({ url: 'https://example.com/a' });
  });

  it('returns the parsed result on success', async () => {
    const fetchImpl = vi.fn(async () => jsonResponse(benchmarkResultFixture()));
    const result = await runBenchmark('https://example.com/a', {
      fetchImpl: fetchImpl as unknown as typeof fetch,
    });
    expect(result.page.title).toBe("Lisbon's tram network turns 150");
  });

  it('surfaces the backend error code and message', async () => {
    const fetchImpl = vi.fn(async () =>
      jsonResponse({ error: { code: 'BLOCKED_HOST', message: 'That host is not allowed.' } }, 400),
    );

    await expect(
      runBenchmark('http://127.0.0.1/', { fetchImpl: fetchImpl as unknown as typeof fetch }),
    ).rejects.toMatchObject({ code: 'BLOCKED_HOST', message: 'That host is not allowed.' });
  });

  it('falls back to a status-based message when the error body is not the usual shape', async () => {
    const fetchImpl = vi.fn(async () => jsonResponse({ oops: true }, 503));
    await expect(
      runBenchmark('https://example.com/a', { fetchImpl: fetchImpl as unknown as typeof fetch }),
    ).rejects.toMatchObject({ code: 'UNKNOWN_ERROR' });
  });

  it('reports an unreachable backend', async () => {
    const fetchImpl = vi.fn(() => Promise.reject(new TypeError('fetch failed')));
    await expect(
      runBenchmark('https://example.com/a', { fetchImpl: fetchImpl as unknown as typeof fetch }),
    ).rejects.toBeInstanceOf(BenchmarkRequestError);
  });

  it('reports a response that is not valid JSON', async () => {
    const fetchImpl = vi.fn(async () => new Response('<html>', { status: 200 }));
    await expect(
      runBenchmark('https://example.com/a', { fetchImpl: fetchImpl as unknown as typeof fetch }),
    ).rejects.toMatchObject({ code: 'BAD_RESPONSE' });
  });

  it('lets an abort propagate untouched so a cancelled run is not shown as an error', async () => {
    const abort = new DOMException('aborted', 'AbortError');
    const fetchImpl = vi.fn(() => Promise.reject(abort));
    await expect(
      runBenchmark('https://example.com/a', { fetchImpl: fetchImpl as unknown as typeof fetch }),
    ).rejects.toBe(abort);
  });

  it('points at a backend URL and never carries a credential', () => {
    expect(API_BASE_URL).toMatch(/^https?:\/\//);
    expect(API_BASE_URL).not.toMatch(/key|secret|token/i);
  });
});
