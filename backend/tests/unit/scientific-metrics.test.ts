import { describe, expect, it } from 'vitest';
import {
  calculateScientificMetrics,
  computeAccessibilityAffordance,
  computeHeadingPathConsistency,
  computeSemanticInformationDensity,
} from '../../src/recommendations/metrics.js';
import type { ScrapedPage } from '../../src/scraper/index.js';

function fakePage(overrides: Partial<ScrapedPage> = {}): ScrapedPage {
  return {
    requestedUrl: 'https://example.com/research',
    finalUrl: 'https://example.com/research',
    title: 'Autonomous Web Agents and DOM Representation',
    byline: 'Dr. Jane Smith',
    siteName: 'AI Science Press',
    description: 'Empirical study on LLM readability and affordance grounding.',
    lang: 'en',
    publishedTime: '2025-02-01T00:00:00Z',
    headings: ['Introduction', 'Methodology', 'Evaluation'],
    text: 'A detailed research paper discussing language models navigating web documents with semantic HTML.',
    wordCount: 800,
    charCount: 4800,
    bytes: 12000,
    truncated: false,
    strategy: 'readability',
    ...overrides,
  };
}

describe('computeSemanticInformationDensity (SID)', () => {
  it('awards high density score to pages with high text-to-bytes ratio', () => {
    const page = fakePage({ charCount: 4000, bytes: 10000, wordCount: 600 });
    const sid = computeSemanticInformationDensity(page);
    expect(sid).toBeGreaterThanOrEqual(80);
  });

  it('penalizes pages whose content was truncated', () => {
    const normal = fakePage({ truncated: false });
    const truncated = fakePage({ truncated: true });

    expect(computeSemanticInformationDensity(truncated)).toBeLessThan(
      computeSemanticInformationDensity(normal),
    );
  });

  it('penalizes thin content pages (<120 words)', () => {
    const thin = fakePage({ wordCount: 45, charCount: 280, bytes: 15000 });
    const sid = computeSemanticInformationDensity(thin);
    expect(sid).toBeLessThan(60);
  });

  it('returns 0 when charCount or bytes are zero', () => {
    const empty = fakePage({ charCount: 0, bytes: 0 });
    expect(computeSemanticInformationDensity(empty)).toBe(0);
  });
});

describe('computeHeadingPathConsistency (HPCI)', () => {
  it('gives 100 for a perfectly monotonic heading tree', () => {
    const html = `
      <h1>Main Paper Title</h1>
      <h2>Introduction</h2>
      <h3>Background</h3>
      <h2>Experiments</h2>
      <h3>Results</h3>
    `;
    const result = computeHeadingPathConsistency(['Introduction', 'Experiments'], html);
    expect(result.score).toBe(100);
    expect(result.violations).toHaveLength(0);
  });

  it('penalizes missing H1', () => {
    const html = `
      <h2>Section One</h2>
      <p>Body text</p>
    `;
    const result = computeHeadingPathConsistency(['Section One'], html);
    expect(result.score).toBeLessThanOrEqual(75);
    expect(result.violations).toContain('Missing top-level <h1> heading for main document topic');
  });

  it('penalizes skipped heading levels (e.g. H1 to H3)', () => {
    const html = `
      <h1>Main Document</h1>
      <h3>Subsection Without H2</h3>
    `;
    const result = computeHeadingPathConsistency(['Subsection Without H2'], html);
    expect(result.score).toBeLessThan(100);
    expect(
      result.violations.some((v) => v.includes('Skipped heading level from <h1> to <h3>')),
    ).toBe(true);
  });

  it('handles fallback when no rawHtml is provided', () => {
    expect(computeHeadingPathConsistency([]).score).toBe(10);
    expect(computeHeadingPathConsistency(['Heading 1']).score).toBe(55);
    expect(computeHeadingPathConsistency(['H1', 'H2', 'H3']).score).toBe(100);
  });
});

describe('computeAccessibilityAffordance (AAC)', () => {
  it('gives 100 when elements use native tags and explicit labels', () => {
    const html = `
      <main>
        <button type="button" aria-label="Submit search">Search</button>
        <a href="/login" aria-label="Sign in to your account">Sign in</a>
        <label for="query">Search</label>
        <input id="query" type="text" name="q" />
      </main>
    `;
    const result = computeAccessibilityAffordance(html);
    expect(result.score).toBe(100);
    expect(result.issues).toHaveLength(0);
  });

  it('penalizes pseudo-buttons (div/span clickables)', () => {
    const html = `
      <div onclick="doSomething()">Click Me</div>
      <span role="button">Fake Button</span>
    `;
    const result = computeAccessibilityAffordance(html);
    expect(result.score).toBeLessThanOrEqual(80);
    expect(result.issues.some((i) => i.includes('non-semantic pseudo-button'))).toBe(true);
  });

  it('penalizes icon-only buttons with missing accessible names', () => {
    const html = `
      <button><svg></svg></button>
    `;
    const result = computeAccessibilityAffordance(html);
    expect(result.score).toBeLessThan(100);
    expect(result.issues).toContain('Icon button missing accessible name or aria-label');
  });

  it('penalizes multiple ambiguous links without context', () => {
    const html = `
      <a href="/p1">Read more</a>
      <a href="/p2">Read more</a>
      <a href="/p3">Read more</a>
    `;
    const result = computeAccessibilityAffordance(html);
    expect(result.score).toBeLessThan(100);
    expect(result.issues.some((i) => i.includes('ambiguous links'))).toBe(true);
  });
});

describe('calculateScientificMetrics', () => {
  it('calculates sid, hpci, and aac bounded between 0 and 100', () => {
    const page = fakePage({
      rawHtml: '<h1>Topic</h1><h2>Subtopic</h2><button aria-label="Save">Save</button>',
    });
    const metrics = calculateScientificMetrics(page);

    expect(metrics.sid).toBeGreaterThanOrEqual(0);
    expect(metrics.sid).toBeLessThanOrEqual(100);
    expect(metrics.hpci).toBeGreaterThanOrEqual(0);
    expect(metrics.hpci).toBeLessThanOrEqual(100);
    expect(metrics.aac).toBeGreaterThanOrEqual(0);
    expect(metrics.aac).toBeLessThanOrEqual(100);
  });
});
