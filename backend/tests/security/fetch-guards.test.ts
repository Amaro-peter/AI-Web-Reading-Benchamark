import { describe, expect, it, vi } from 'vitest';
import { fetchPage } from '../../src/scraper/fetch-page.js';
import { parseTargetUrl } from '../../src/scraper/url-validation.js';
import type { LookupFn } from '../../src/scraper/ssrf.js';

const publicLookup: LookupFn = async () => [{ address: '93.184.216.34', family: 4 }];

function htmlResponse(body: string, init: ResponseInit = {}) {
  return new Response(body, {
    status: 200,
    headers: { 'content-type': 'text/html; charset=utf-8' },
    ...init,
  });
}

function redirectResponse(location: string, status = 302) {
  return new Response(null, { status, headers: { location } });
}

const options = { timeoutMs: 5000, maxBytes: 100_000, maxRedirects: 5 };

describe('redirect handling', () => {
  it('follows a redirect to another public host', async () => {
    const fetchImpl = vi
      .fn<typeof fetch>()
      .mockResolvedValueOnce(redirectResponse('https://elsewhere.example/final'))
      .mockResolvedValueOnce(htmlResponse('<html><body><p>done</p></body></html>'));

    const result = await fetchPage(parseTargetUrl('https://example.com/start'), options, {
      fetchImpl,
      lookup: publicLookup,
    });

    expect(result.finalUrl).toBe('https://elsewhere.example/final');
    expect(result.html).toContain('done');
    expect(fetchImpl).toHaveBeenCalledTimes(2);
  });

  it('never sends a request to a redirect target that resolves privately', async () => {
    const fetchImpl = vi
      .fn<typeof fetch>()
      .mockResolvedValueOnce(redirectResponse('http://127.0.0.1:8080/admin'));

    await expect(
      fetchPage(parseTargetUrl('https://example.com/start'), options, {
        fetchImpl,
        lookup: publicLookup,
      }),
    ).rejects.toMatchObject({ code: 'BLOCKED_HOST' });

    // The redirect was read, but the blocked destination was never requested.
    expect(fetchImpl).toHaveBeenCalledTimes(1);
  });

  it.each([
    'http://169.254.169.254/latest/meta-data/',
    'http://[::1]/',
    'http://10.0.0.5/',
    'http://localhost/',
  ])('refuses to follow a redirect to %s', async (location) => {
    const fetchImpl = vi.fn<typeof fetch>().mockResolvedValueOnce(redirectResponse(location));

    await expect(
      fetchPage(parseTargetUrl('https://example.com/start'), options, {
        fetchImpl,
        lookup: publicLookup,
      }),
    ).rejects.toMatchObject({ code: 'BLOCKED_HOST' });
    expect(fetchImpl).toHaveBeenCalledTimes(1);
  });

  it('refuses to follow a redirect that changes scheme to file:', async () => {
    const fetchImpl = vi
      .fn<typeof fetch>()
      .mockResolvedValueOnce(redirectResponse('file:///etc/passwd'));

    await expect(
      fetchPage(parseTargetUrl('https://example.com/start'), options, {
        fetchImpl,
        lookup: publicLookup,
      }),
    ).rejects.toMatchObject({ code: 'UNSUPPORTED_SCHEME' });
  });

  it('stops after the redirect limit instead of looping forever', async () => {
    const fetchImpl = vi
      .fn<typeof fetch>()
      .mockImplementation(async () => redirectResponse('https://example.com/loop'));

    await expect(
      fetchPage(parseTargetUrl('https://example.com/loop'), options, {
        fetchImpl,
        lookup: publicLookup,
      }),
    ).rejects.toMatchObject({ code: 'TOO_MANY_REDIRECTS' });

    expect(fetchImpl.mock.calls.length).toBeLessThanOrEqual(options.maxRedirects + 1);
  });

  it('fails when a redirect response carries no location header', async () => {
    const fetchImpl = vi
      .fn<typeof fetch>()
      .mockResolvedValueOnce(new Response(null, { status: 302 }));

    await expect(
      fetchPage(parseTargetUrl('https://example.com/start'), options, {
        fetchImpl,
        lookup: publicLookup,
      }),
    ).rejects.toMatchObject({ code: 'HTTP_ERROR' });
  });
});

describe('response limits', () => {
  it('rejects a body larger than the byte budget', async () => {
    const big = '<html><body>' + 'x'.repeat(50_000) + '</body></html>';
    const fetchImpl = vi.fn<typeof fetch>().mockResolvedValue(htmlResponse(big));

    await expect(
      fetchPage(
        parseTargetUrl('https://example.com/big'),
        { ...options, maxBytes: 1000 },
        {
          fetchImpl,
          lookup: publicLookup,
        },
      ),
    ).rejects.toMatchObject({ code: 'RESPONSE_TOO_LARGE' });
  });

  it('rejects early when content-length already exceeds the budget', async () => {
    const fetchImpl = vi.fn<typeof fetch>().mockResolvedValue(
      new Response('<html></html>', {
        status: 200,
        headers: { 'content-type': 'text/html', 'content-length': '999999999' },
      }),
    );

    await expect(
      fetchPage(
        parseTargetUrl('https://example.com/big'),
        { ...options, maxBytes: 1000 },
        {
          fetchImpl,
          lookup: publicLookup,
        },
      ),
    ).rejects.toMatchObject({ code: 'RESPONSE_TOO_LARGE' });
  });

  it.each(['application/json', 'application/pdf', 'image/png', 'text/plain'])(
    'rejects content-type %s',
    async (contentType) => {
      const fetchImpl = vi
        .fn<typeof fetch>()
        .mockResolvedValue(
          new Response('{}', { status: 200, headers: { 'content-type': contentType } }),
        );

      await expect(
        fetchPage(parseTargetUrl('https://example.com/data'), options, {
          fetchImpl,
          lookup: publicLookup,
        }),
      ).rejects.toMatchObject({ code: 'UNSUPPORTED_CONTENT_TYPE' });
    },
  );

  it.each(['text/html', 'text/html; charset=utf-8', 'application/xhtml+xml'])(
    'accepts content-type %s',
    async (contentType) => {
      const fetchImpl = vi.fn<typeof fetch>().mockResolvedValue(
        new Response('<html><body><p>ok</p></body></html>', {
          status: 200,
          headers: { 'content-type': contentType },
        }),
      );

      const result = await fetchPage(parseTargetUrl('https://example.com/page'), options, {
        fetchImpl,
        lookup: publicLookup,
      });
      expect(result.html).toContain('ok');
    },
  );

  it('rejects a response with no content-type at all', async () => {
    const fetchImpl = vi
      .fn<typeof fetch>()
      .mockResolvedValue(new Response('<html></html>', { status: 200 }));

    await expect(
      fetchPage(parseTargetUrl('https://example.com/page'), options, {
        fetchImpl,
        lookup: publicLookup,
      }),
    ).rejects.toMatchObject({ code: 'UNSUPPORTED_CONTENT_TYPE' });
  });
});

describe('transport failures', () => {
  it('maps a non-2xx status to HTTP_ERROR', async () => {
    const fetchImpl = vi
      .fn<typeof fetch>()
      .mockResolvedValue(
        new Response('nope', { status: 404, headers: { 'content-type': 'text/html' } }),
      );

    await expect(
      fetchPage(parseTargetUrl('https://example.com/missing'), options, {
        fetchImpl,
        lookup: publicLookup,
      }),
    ).rejects.toMatchObject({ code: 'HTTP_ERROR' });
  });

  it('maps an aborted request to TIMEOUT', async () => {
    const fetchImpl = vi
      .fn<typeof fetch>()
      .mockRejectedValue(
        Object.assign(new Error('The operation was aborted'), { name: 'AbortError' }),
      );

    await expect(
      fetchPage(parseTargetUrl('https://example.com/slow'), options, {
        fetchImpl,
        lookup: publicLookup,
      }),
    ).rejects.toMatchObject({ code: 'TIMEOUT' });
  });

  it('maps a network error to FETCH_FAILED', async () => {
    const fetchImpl = vi.fn<typeof fetch>().mockRejectedValue(new TypeError('fetch failed'));

    await expect(
      fetchPage(parseTargetUrl('https://example.com/down'), options, {
        fetchImpl,
        lookup: publicLookup,
      }),
    ).rejects.toMatchObject({ code: 'FETCH_FAILED' });
  });

  it('validates the origin host before issuing any request', async () => {
    const fetchImpl = vi.fn<typeof fetch>();
    const privateLookup: LookupFn = async () => [{ address: '192.168.0.10', family: 4 }];

    await expect(
      fetchPage(parseTargetUrl('https://intranet.example.com/'), options, {
        fetchImpl,
        lookup: privateLookup,
      }),
    ).rejects.toMatchObject({ code: 'BLOCKED_HOST' });

    expect(fetchImpl).not.toHaveBeenCalled();
  });
});
