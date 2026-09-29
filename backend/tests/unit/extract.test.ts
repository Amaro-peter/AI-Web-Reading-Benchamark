import { describe, expect, it } from 'vitest';
import { extractContent } from '../../src/scraper/extract.js';
import { ScrapeError } from '../../src/domain/errors.js';
import { FIXTURE_URL, loadFixture } from '../helpers/fixtures.js';

const options = { maxChars: 12_000 };

describe('extractContent', () => {
  const article = extractContent(loadFixture('article'), FIXTURE_URL, options);

  it('prefers the page headline over the tab title with its site suffix', () => {
    expect(article.title).toBe("Lisbon's tram network turns 150");
  });

  it('extracts metadata when the page provides it', () => {
    expect(article.byline).toContain('Marta Ribeiro');
    expect(article.siteName).toBe('The Transit Review');
    expect(article.lang).toBe('en');
    expect(article.publishedTime).toBe('2024-03-12T08:00:00Z');
    expect(article.description).toContain('horse-drawn carriages');
  });

  it('extracts the section headings in document order, without repeating the title', () => {
    expect(article.headings).toEqual([
      'A network built for hills',
      'The Remodelado fleet',
      'Pressure from tourism',
      'What comes next',
    ]);
  });

  it('keeps the article prose', () => {
    expect(article.text).toContain('Lisbon put its first passenger tram into service in 1873');
    expect(article.text).toContain('twenty five million');
  });

  it.each([
    ['inline script content', 'window.dataLayer'],
    ['stylesheet rules', 'font-family: sans-serif'],
    ['navigation links', 'Subscribe'],
    ['the cookie banner', 'Accept all cookies'],
    ['advertising', 'Book your city transport pass'],
    ['the comment section', 'Comments (42)'],
    ['the footer', 'All rights reserved'],
  ])('strips %s', (_label, needle) => {
    expect(article.text).not.toContain(needle);
  });

  it('uses Readability rather than the fallback for a real article', () => {
    expect(article.strategy).toBe('readability');
  });

  it('reports a word count consistent with the extracted text', () => {
    expect(article.wordCount).toBeGreaterThan(300);
    expect(article.wordCount).toBeLessThan(700);
    expect(article.truncated).toBe(false);
  });
});

describe('extractContent limits', () => {
  it('truncates content beyond the configured budget', () => {
    const result = extractContent(loadFixture('article'), FIXTURE_URL, { maxChars: 500 });
    expect(result.text.length).toBeLessThanOrEqual(500);
    expect(result.truncated).toBe(true);
    // The word count still describes the whole page, not the truncated slice.
    expect(result.wordCount).toBeGreaterThan(300);
  });

  it('never splits a word at the truncation point', () => {
    const result = extractContent(loadFixture('article'), FIXTURE_URL, { maxChars: 300 });
    const full = extractContent(loadFixture('article'), FIXTURE_URL, options).text;
    expect(full.startsWith(result.text)).toBe(true);
  });
});

describe('extractContent failure modes', () => {
  it('rejects a page with no readable content', () => {
    expect(() => extractContent(loadFixture('empty'), FIXTURE_URL, options)).toThrow(ScrapeError);
    try {
      extractContent(loadFixture('empty'), FIXTURE_URL, options);
    } catch (error) {
      expect((error as ScrapeError).code).toBe('EMPTY_CONTENT');
    }
  });

  it.each(['', '   ', '<html></html>', '<!doctype html>'])(
    'rejects degenerate document %j',
    (html) => {
      expect(() => extractContent(html, FIXTURE_URL, options)).toThrow(ScrapeError);
    },
  );

  it('does not throw on malformed HTML, it just extracts what is there', () => {
    const html =
      '<html><body><article><p>' +
      'This is an unclosed paragraph with enough words in it to clear the minimum content ' +
      'threshold that the extractor applies before it gives up on a page entirely.' +
      '<div><span>and a stray nested element';
    const result = extractContent(html, FIXTURE_URL, options);
    expect(result.wordCount).toBeGreaterThanOrEqual(20);
  });

  it('falls back to body text when there is no article element', () => {
    const html =
      '<html><body><div>' +
      'A plain page with no semantic article wrapper at all, containing sufficient prose to be ' +
      'considered readable by the extractor even though Readability may decline to score it.' +
      '</div></body></html>';
    const result = extractContent(html, FIXTURE_URL, options);
    expect(result.text).toContain('A plain page with no semantic article wrapper');
  });
});
