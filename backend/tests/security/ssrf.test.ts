import { describe, expect, it } from 'vitest';
import { ScrapeError } from '../../src/domain/errors.js';
import { parseTargetUrl } from '../../src/scraper/url-validation.js';
import {
  assertPublicAddress,
  assertResolvesToPublicAddress,
  isBlockedHostname,
  isPublicIpAddress,
} from '../../src/scraper/ssrf.js';

function expectScrapeError(fn: () => unknown, code: string) {
  try {
    fn();
  } catch (error) {
    expect(error).toBeInstanceOf(ScrapeError);
    expect((error as ScrapeError).code).toBe(code);
    return;
  }
  throw new Error(`expected a ScrapeError(${code}) but nothing was thrown`);
}

describe('scheme blocking', () => {
  it.each([
    'file:///etc/passwd',
    'file://localhost/etc/shadow',
    'javascript:alert(1)',
    'data:text/html;base64,PHNjcmlwdD4=',
    'ftp://example.com/file.txt',
    'gopher://example.com/',
    'ws://example.com/socket',
    'chrome://settings',
  ])('rejects %s', (input) => {
    expectScrapeError(() => parseTargetUrl(input), 'UNSUPPORTED_SCHEME');
  });

  it.each(['http://example.com/article', 'https://example.com/article'])('accepts %s', (input) => {
    expect(parseTargetUrl(input).protocol).toMatch(/^https?:$/);
  });
});

describe('malformed input', () => {
  it.each(['', '   ', 'not a url', 'http://', 'https://', '://example.com', 'http:// ex.com'])(
    'rejects %j',
    (input) => {
      expectScrapeError(() => parseTargetUrl(input), 'INVALID_URL');
    },
  );

  it('rejects a URL longer than the allowed maximum', () => {
    const long = `https://example.com/${'a'.repeat(5000)}`;
    expectScrapeError(() => parseTargetUrl(long), 'INVALID_URL');
  });

  it('rejects embedded credentials, which can be used to confuse the host parser', () => {
    expectScrapeError(() => parseTargetUrl('https://user:pass@example.com/'), 'INVALID_URL');
    expectScrapeError(() => parseTargetUrl('https://evil.com@127.0.0.1/'), 'INVALID_URL');
  });
});

describe('blocked hostnames', () => {
  it.each([
    'localhost',
    'LOCALHOST',
    'localhost.',
    'api.localhost',
    'db.local',
    'service.internal',
    'router.home.arpa',
    'ip6-localhost',
    'ip6-loopback',
    'metadata.google.internal',
  ])('blocks %s', (hostname) => {
    expect(isBlockedHostname(hostname)).toBe(true);
  });

  it.each(['example.com', 'sub.example.com', 'localhost.example.com', 'internallife.org'])(
    'allows %s',
    (hostname) => {
      expect(isBlockedHostname(hostname)).toBe(false);
    },
  );
});

describe('blocked IP addresses', () => {
  it.each([
    ['127.0.0.1', 'loopback'],
    ['127.1.2.3', 'loopback'],
    ['0.0.0.0', 'unspecified'],
    ['10.0.0.1', 'private class A'],
    ['172.16.0.1', 'private class B'],
    ['172.31.255.254', 'private class B upper bound'],
    ['192.168.1.1', 'private class C'],
    ['169.254.169.254', 'cloud metadata / link local'],
    ['100.64.0.1', 'carrier grade NAT'],
    ['224.0.0.1', 'multicast'],
    ['255.255.255.255', 'broadcast'],
    ['::1', 'IPv6 loopback'],
    ['::', 'IPv6 unspecified'],
    ['fc00::1', 'IPv6 unique local'],
    ['fd12:3456::1', 'IPv6 unique local'],
    ['fe80::1', 'IPv6 link local'],
    ['::ffff:127.0.0.1', 'IPv4-mapped loopback'],
    ['::ffff:10.0.0.1', 'IPv4-mapped private'],
    ['::ffff:169.254.169.254', 'IPv4-mapped metadata'],
  ])('blocks %s (%s)', (ip) => {
    expect(isPublicIpAddress(ip)).toBe(false);
    expectScrapeError(() => assertPublicAddress(ip), 'BLOCKED_HOST');
  });

  it.each(['8.8.8.8', '1.1.1.1', '93.184.216.34', '2606:2800:220:1:248:1893:25c8:1946'])(
    'allows public address %s',
    (ip) => {
      expect(isPublicIpAddress(ip)).toBe(true);
      expect(() => assertPublicAddress(ip)).not.toThrow();
    },
  );

  it('treats an unparseable address as unsafe', () => {
    expect(isPublicIpAddress('not-an-ip')).toBe(false);
    expect(isPublicIpAddress('999.999.999.999')).toBe(false);
  });

  it.each([
    '172.15.255.255',
    '172.32.0.1',
    '11.0.0.1',
    '192.169.0.1',
    '100.128.0.1',
    '9.255.255.255',
  ])('does not over-block the address next to a private range: %s', (ip) => {
    expect(isPublicIpAddress(ip)).toBe(true);
  });
});

describe('DNS resolution guard', () => {
  it('rejects a public-looking hostname that resolves to a private address', async () => {
    const lookup = async () => [{ address: '10.1.2.3', family: 4 }];
    await expect(assertResolvesToPublicAddress('rebind.example.com', lookup)).rejects.toMatchObject(
      { code: 'BLOCKED_HOST' },
    );
  });

  it('rejects when any one of several answers is private', async () => {
    const lookup = async () => [
      { address: '93.184.216.34', family: 4 },
      { address: '127.0.0.1', family: 4 },
    ];
    await expect(assertResolvesToPublicAddress('mixed.example.com', lookup)).rejects.toMatchObject({
      code: 'BLOCKED_HOST',
    });
  });

  it('accepts a hostname whose answers are all public', async () => {
    const lookup = async () => [
      { address: '93.184.216.34', family: 4 },
      { address: '2606:2800:220:1:248:1893:25c8:1946', family: 6 },
    ];
    await expect(assertResolvesToPublicAddress('example.com', lookup)).resolves.toBeUndefined();
  });

  it('reports DNS_FAILURE when the name does not resolve', async () => {
    const lookup = async () => {
      throw new Error('ENOTFOUND');
    };
    await expect(assertResolvesToPublicAddress('nope.invalid', lookup)).rejects.toMatchObject({
      code: 'DNS_FAILURE',
    });
  });

  it('reports DNS_FAILURE when the resolver returns no answers', async () => {
    const lookup = async () => [];
    await expect(assertResolvesToPublicAddress('empty.invalid', lookup)).rejects.toMatchObject({
      code: 'DNS_FAILURE',
    });
  });

  it('skips DNS when the host is already a literal public IP', async () => {
    let called = false;
    const lookup = async () => {
      called = true;
      return [{ address: '10.0.0.1', family: 4 }];
    };
    await assertResolvesToPublicAddress('8.8.8.8', lookup);
    expect(called).toBe(false);
  });

  it('rejects a literal private IP host without consulting DNS', async () => {
    let called = false;
    const lookup = async () => {
      called = true;
      return [{ address: '8.8.8.8', family: 4 }];
    };
    await expect(assertResolvesToPublicAddress('127.0.0.1', lookup)).rejects.toMatchObject({
      code: 'BLOCKED_HOST',
    });
    expect(called).toBe(false);
  });

  it('handles a bracketed IPv6 literal host', async () => {
    const lookup = async () => {
      throw new Error('should not be called');
    };
    await expect(assertResolvesToPublicAddress('[::1]', lookup)).rejects.toMatchObject({
      code: 'BLOCKED_HOST',
    });
  });
});
