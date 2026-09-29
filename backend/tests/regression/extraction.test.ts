import { beforeAll, describe, expect, it } from 'vitest';
import { buildQuestions } from '../../src/benchmark/questions.js';
import type { Question } from '../../src/domain/benchmark.js';
import type { ScrapedPage } from '../../src/scraper/index.js';
import { scrapeFixture } from '../helpers/page.js';

/**
 * Regression baseline for the deterministic article fixture.
 *
 * These are exact assertions, not snapshots: a change here should be read as
 * "the extractor now reports something different", and a reviewer should be
 * able to see what the old value was without regenerating a file.
 */

let page: ScrapedPage;
let questions: Question[];

beforeAll(async () => {
  page = await scrapeFixture('article');
  questions = buildQuestions(page);
});

describe('regression: extracted page', () => {
  it('reports the expected title', () => {
    expect(page.title).toBe("Lisbon's tram network turns 150");
  });

  it('reports the expected metadata', () => {
    expect(page.byline).toBe('Marta Ribeiro');
    expect(page.siteName).toBe('The Transit Review');
    expect(page.lang).toBe('en');
    expect(page.publishedTime).toBe('2024-03-12T08:00:00Z');
  });

  it('reports the expected headings', () => {
    expect(page.headings).toEqual([
      'A network built for hills',
      'The Remodelado fleet',
      'Pressure from tourism',
      'What comes next',
    ]);
  });

  it('uses the Readability path and does not truncate this page', () => {
    expect(page.strategy).toBe('readability');
    expect(page.truncated).toBe(false);
  });

  it('reports a stable word count', () => {
    expect(page.wordCount).toBe(428);
  });

  it('starts and ends where the article does', () => {
    // Readability keeps the byline line as the article's first paragraph.
    expect(page.text.startsWith('By Marta Ribeiro')).toBe(true);
    expect(page.text).toContain('Lisbon put its first passenger tram into service in 1873');
    expect(page.text.trimEnd().endsWith('handle the gradients of Route 28.')).toBe(true);
  });

  it('keeps every fact the questions depend on', () => {
    for (const fact of [
      '1873',
      '1914',
      'twenty five million',
      'Fifty eight trams',
      'three euros and twenty cents',
      'Remodelado',
    ]) {
      expect(page.text).toContain(fact);
    }
  });
});

describe('regression: generated questions', () => {
  it('produces the expected ids and categories, in order', () => {
    expect(questions.map((q) => [q.id, q.category])).toEqual([
      ['q1-title', 'EXTRACTION'],
      ['q2-author', 'EXTRACTION'],
      ['q3-first-heading', 'EXTRACTION'],
      ['q4-cloze', 'COMPREHENSION'],
      ['q5-section-of-term', 'RELATION'],
    ]);
  });

  it('produces the expected gold answers', () => {
    expect(questions.map((q) => q.expectedAnswer)).toEqual([
      "Lisbon's tram network turns 150",
      'Marta Ribeiro',
      'A network built for hills',
      '1873',
      'Pressure from tourism',
    ]);
  });

  it('picks a distinctive term for the relation question, not a generic one', () => {
    const relation = questions.find((q) => q.id === 'q5-section-of-term');
    const term = /"([^"]+)"/.exec(relation?.prompt ?? '')?.[1] ?? '';
    expect(term.length).toBeGreaterThanOrEqual(8);
    // It names something on the page rather than being a stray adverb.
    expect(page.text).toContain(term.charAt(0).toUpperCase() + term.slice(1));
  });

  it('grades every question on this fixture — none is unevaluable', () => {
    expect(questions.every((q) => q.expectedAnswer !== null)).toBe(true);
  });

  it('asks the relation question about the expected term', () => {
    const relation = questions.find((q) => q.id === 'q5-section-of-term');
    expect(relation?.prompt).toContain('"navegante"');
  });
});
