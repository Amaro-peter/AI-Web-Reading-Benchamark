import { lookup as dnsLookup } from 'node:dns/promises';
import ipaddr from 'ipaddr.js';
import { ScrapeError } from '../domain/errors.js';

/**
 * SSRF protection.
 *
 * The caller chooses the URL, so the fetcher must assume the URL is hostile.
 * Two checks run before any socket is opened, and again on every redirect hop:
 *
 *   1. hostname denylist — names that address the local machine or a private
 *      naming zone, which may never resolve through public DNS at all;
 *   2. address classification — every address the name resolves to must be a
 *      public unicast address.
 *
 * Known limitation: between our DNS answer and the connection, a hostile
 * resolver could return a different address (DNS rebinding). Closing that gap
 * requires pinning the connection to the validated IP with a custom dispatcher;
 * it is documented in the README under Limitations.
 */

/** Exact hostnames that always point at the local machine or its metadata. */
const BLOCKED_HOSTNAMES = new Set([
  'localhost',
  'ip6-localhost',
  'ip6-loopback',
  'metadata.google.internal',
  'metadata',
]);

/** Private naming zones. A name ending in one of these is never public. */
const BLOCKED_SUFFIXES = ['.localhost', '.local', '.internal', '.home.arpa', '.localdomain'];

/**
 * ipaddr.js range names that are not routable on the public internet.
 * Anything not in this list is treated as unsafe by default, so a new range
 * added upstream fails closed rather than open.
 */
const PUBLIC_RANGES = new Set(['unicast']);

export interface DnsAnswer {
  address: string;
  family: number;
}

export type LookupFn = (hostname: string) => Promise<DnsAnswer[]>;

/** Strips the trailing root dot and IPv6 brackets, and lowercases. */
export function normalizeHostname(hostname: string): string {
  let host = hostname.trim().toLowerCase();
  if (host.startsWith('[') && host.endsWith(']')) {
    host = host.slice(1, -1);
  }
  while (host.endsWith('.')) {
    host = host.slice(0, -1);
  }
  return host;
}

/** True when the hostname itself is denied, before any DNS resolution. */
export function isBlockedHostname(hostname: string): boolean {
  const host = normalizeHostname(hostname);

  if (host.length === 0) {
    return true;
  }

  if (BLOCKED_HOSTNAMES.has(host)) {
    return true;
  }

  return BLOCKED_SUFFIXES.some((suffix) => host.endsWith(suffix));
}

/**
 * True only for addresses that are public unicast.
 * An address that cannot be parsed is reported as not public.
 */
export function isPublicIpAddress(address: string): boolean {
  const host = normalizeHostname(address);

  if (!ipaddr.isValid(host)) {
    return false;
  }

  let parsed = ipaddr.parse(host);

  // `::ffff:10.0.0.1` is a private IPv4 address wearing an IPv6 costume.
  if (parsed.kind() === 'ipv6') {
    const v6 = parsed as ipaddr.IPv6;
    if (v6.isIPv4MappedAddress()) {
      parsed = v6.toIPv4Address();
    }
  }

  return PUBLIC_RANGES.has(parsed.range());
}

/** Throws BLOCKED_HOST unless `address` is public unicast. */
export function assertPublicAddress(address: string): void {
  if (!isPublicIpAddress(address)) {
    throw new ScrapeError(
      'BLOCKED_HOST',
      'That URL points at an address this service cannot fetch.',
    );
  }
}

const defaultLookup: LookupFn = async (hostname) => {
  const answers = await dnsLookup(hostname, { all: true, verbatim: true });
  return answers.map((a) => ({ address: a.address, family: a.family }));
};

/**
 * Resolves `hostname` and throws unless every answer is a public address.
 *
 * A hostname that is already an IP literal is checked directly and never sent
 * to the resolver.
 */
export async function assertResolvesToPublicAddress(
  hostname: string,
  lookup: LookupFn = defaultLookup,
): Promise<void> {
  const host = normalizeHostname(hostname);

  if (isBlockedHostname(host)) {
    throw new ScrapeError('BLOCKED_HOST', 'That host is not allowed.');
  }

  if (ipaddr.isValid(host)) {
    assertPublicAddress(host);
    return;
  }

  let answers: DnsAnswer[];
  try {
    answers = await lookup(host);
  } catch {
    throw new ScrapeError('DNS_FAILURE', 'That host could not be resolved.');
  }

  if (answers.length === 0) {
    throw new ScrapeError('DNS_FAILURE', 'That host could not be resolved.');
  }

  for (const answer of answers) {
    assertPublicAddress(answer.address);
  }
}

/** Full pre-flight guard for a parsed URL: hostname denylist plus DNS check. */
export async function assertSafeUrl(url: URL, lookup: LookupFn = defaultLookup): Promise<void> {
  await assertResolvesToPublicAddress(url.hostname, lookup);
}
