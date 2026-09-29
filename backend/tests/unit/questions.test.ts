import { beforeAll, describe, expect, it } from 'vitest';
import { buildQuestions } from '../../src/benchmark/questions.js';
import { QUESTION_CATEGORIES, type Question } from '../../src/domain/benchmark.js';
import { NOT_IN_PAGE } from '../../src/providers/prompt.js';
import type { ScrapedPage } from '../../src/scraper/index.js';
import { scrapeFixture } from '../helpers/page.js';

let page: ScrapedPage;
let questions: Question[];

beforeAll(async () => {
  page = await scrapeFixture('article');
  questions = buildQuestions(page);
});

describe('the question battery', () => {
  it('asks five questions', () => {
    expect(questions).toHaveLength(5);
  });

  it('has a unique id per question', () => {
    expect(new Set(questions.map((q) => q.id)).size).toBe(questions.length);
  });

  it('covers all three categories', () => {
    const used = new Set(questions.map((q) => q.category));
    for (const category of QUESTION_CATEGORIES) {
      expect(used).toContain(category);
    }
  });

  it('is deterministic: the same page yields the same questions', () => {
    expect(buildQuestions(page)).toEqual(questions);
  });

  it('never leaks the expected answer into the prompt it sends the model', () => {
    for (const q of questions) {
      if (q.expectedAnswer !== null && q.expectedAnswer !== NOT_IN_PAGE) {
        expect(q.prompt).not.toContain(q.expectedAnswer);
      }
    }
  });
});

describe('grounded answers', () => {
  it('reads the title off the page', () => {
    const q = questions.find((item) => item.id === 'q1-title');
    expect(q?.expectedAnswer).toBe("Lisbon's tram network turns 150");
  });

  it('reads the author off the page and drops the "By" prefix', () => {
    const q = questions.find((item) => item.id === 'q2-author');
    expect(q?.expectedAnswer).toBe('Marta Ribeiro');
  });

  it('reads the first section heading off the page', () => {
    const q = questions.find((item) => item.id === 'q3-first-heading');
    expect(q?.expectedAnswer).toBe('A network built for hills');
  });

  it('builds a cloze whose answer is a number from the page', () => {
    const q = questions.find((item) => item.id === 'q4-cloze');
    expect(q?.expectedAnswer).toMatch(/^\d[\d.,]*$/);
    expect(q?.prompt).toContain('_____');
    expect(page.text).toContain(q?.expectedAnswer ?? '<none>');
  });

  it('relates a term to the section heading it appears under', () => {
    const q = questions.find((item) => item.id === 'q5-section-of-term');
    expect(page.headings).toContain(q?.expectedAnswer);
    const term = /"([^"]+)"/.exec(q?.prompt ?? '')?.[1];
    expect(term).toBeDefined();
    expect(page.text.toLowerCase()).toContain(term);
  });
});

describe('pages that cannot support a question', () => {
  function pageWith(overrides: Partial<ScrapedPage>): ScrapedPage {
    return { ...page, ...overrides };
  }

  it('marks the author question as answerable with the abstention token', () => {
    const q = buildQuestions(pageWith({ byline: null })).find((i) => i.id === 'q2-author');
    // Absence is a fact the page supports, so this stays gradeable.
    expect(q?.expectedAnswer).toBe(NOT_IN_PAGE);
  });

  it('marks the heading question not evaluable when the page has no headings', () => {
    const q = buildQuestions(pageWith({ headings: [] })).find((i) => i.id === 'q3-first-heading');
    expect(q?.expectedAnswer).toBeNull();
  });

  it('marks the cloze not evaluable when no sentence carries a number', () => {
    const prose = 'This page is written entirely in prose with no figures of any kind at all.';
    const q = buildQuestions(pageWith({ text: prose })).find((i) => i.id === 'q4-cloze');
    expect(q?.expectedAnswer).toBeNull();
    expect(q?.prompt).toContain('cannot be graded');
  });

  it('marks the relation question not evaluable when the page has no sections', () => {
    const q = buildQuestions(pageWith({ headings: [] })).find((i) => i.id === 'q5-section-of-term');
    expect(q?.expectedAnswer).toBeNull();
  });

  it('marks the title question not evaluable when there is no title', () => {
    const q = buildQuestions(pageWith({ title: '' })).find((i) => i.id === 'q1-title');
    expect(q?.expectedAnswer).toBeNull();
  });

  it('never invents an answer: an ungradable question carries no acceptable answers', () => {
    const stripped = buildQuestions(pageWith({ headings: [], title: '', text: 'no numbers here' }));
    for (const q of stripped) {
      if (q.expectedAnswer === null) {
        expect(q.acceptableAnswers).toEqual([]);
      }
    }
  });
});
