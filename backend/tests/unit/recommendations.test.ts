import { describe, expect, it } from 'vitest';
import { generateOptimizations } from '../../src/recommendations/generator.js';
import type { ScrapedPage } from '../../src/scraper/index.js';

function fakePage(overrides: Partial<ScrapedPage> = {}): ScrapedPage {
  return {
    requestedUrl: 'https://example.com/article',
    finalUrl: 'https://example.com/article',
    title: 'The Future of Web Reading by Autonomous Agents',
    byline: 'Alice Smith',
    siteName: 'AI Engineering Gazette',
    description: 'A deep dive into how web agents parse semantic HTML.',
    lang: 'en',
    publishedTime: '2025-01-10T12:00:00Z',
    headings: ['Introduction to Agents', 'DOM Architecture', 'Action Affordances'],
    text: 'A rich article discussing how LLMs extract information from websites using modern semantics.',
    wordCount: 850,
    charCount: 5200,
    bytes: 5200,
    truncated: false,
    strategy: 'readability',
    ...overrides,
  };
}

describe('generateOptimizations', () => {
  it('awards a high readiness score (Grade A/B) to well-structured pages', () => {
    const page = fakePage();
    const result = generateOptimizations(page);

    expect(result.readiness.overall).toBeGreaterThanOrEqual(80);
    expect(['A', 'B']).toContain(result.readiness.grade);
    expect(result.readiness.breakdown.structure).toBe(100);
    expect(result.readiness.breakdown.metadata).toBe(100);
    expect(result.readiness.breakdown.contentDensity).toBe(100);
  });

  it('penalizes pages with zero headings with a CRITICAL guidance', () => {
    const page = fakePage({ headings: [] });
    const result = generateOptimizations(page);

    expect(result.readiness.breakdown.structure).toBeLessThan(50);
    const headingRec = result.optimizations.find((r) => r.id === 'opt-structure-no-headings');
    expect(headingRec).toBeDefined();
    expect(headingRec?.severity).toBe('CRITICAL');
    expect(headingRec?.targetModels).toContain('claude');
  });

  it('penalizes pages with missing author bylines and timestamps', () => {
    const page = fakePage({ byline: null, publishedTime: null });
    const result = generateOptimizations(page);

    expect(result.readiness.breakdown.metadata).toBe(50);
    expect(result.optimizations.some((r) => r.id === 'opt-meta-byline')).toBe(true);
    expect(result.optimizations.some((r) => r.id === 'opt-meta-published-time')).toBe(true);
  });

  it('flags truncated pages with a CRITICAL content density warning', () => {
    const page = fakePage({ truncated: true });
    const result = generateOptimizations(page);

    expect(result.readiness.breakdown.contentDensity).toBeLessThan(70);
    const truncRec = result.optimizations.find((r) => r.id === 'opt-content-truncated');
    expect(truncRec).toBeDefined();
    expect(truncRec?.severity).toBe('CRITICAL');
  });

  it('warns about thin content when word count is below 120 words', () => {
    const page = fakePage({ wordCount: 85 });
    const result = generateOptimizations(page);

    expect(result.readiness.breakdown.contentDensity).toBeLessThan(80);
    expect(result.optimizations.some((r) => r.id === 'opt-content-thin')).toBe(true);
  });

  it('includes interactive button affordance guidance for web agents', () => {
    const page = fakePage();
    const result = generateOptimizations(page);

    const affordanceRec = result.optimizations.find(
      (r) => r.id === 'opt-affordance-semantic-buttons',
    );
    expect(affordanceRec).toBeDefined();
    expect(affordanceRec?.targetModels).toContain('claude');
    expect(affordanceRec?.codeSnippet).toContain('<button');
  });

  it('always includes AI discovery and robots.txt guidance', () => {
    const page = fakePage();
    const result = generateOptimizations(page);

    const robotRec = result.optimizations.find((r) => r.id === 'opt-ai-robots-txt');
    expect(robotRec).toBeDefined();
    expect(robotRec?.codeSnippet).toContain('GPTBot');
    expect(robotRec?.codeSnippet).toContain('ClaudeBot');
    expect(robotRec?.codeSnippet).toContain('Google-Extended');
  });
});
