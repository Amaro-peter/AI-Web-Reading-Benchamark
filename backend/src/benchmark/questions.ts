import type { Question } from '../domain/benchmark.js';
import { normalizeWhitespace } from '../domain/text.js';
import { NOT_IN_PAGE } from '../providers/prompt.js';
import type { ScrapedPage } from '../scraper/index.js';

/**
 * Question generation.
 *
 * This is deliberately a small fixed battery of templates filled in from the
 * page, not a generator. The priority is reproducibility: the same page must
 * always yield the same questions and the same gold answers, and a gold answer
 * is only ever read off the page — never invented. When a template cannot be
 * grounded in this particular page, its expected answer is null and the
 * question is reported as NOT_EVALUABLE rather than guessed at.
 */

/** Terms too common to make a useful "which section covers X" question. */
const COMMON_TERMS = new Set([
  'the',
  'this',
  'that',
  'there',
  'these',
  'those',
  'their',
  'with',
  'from',
  'have',
  'has',
  'been',
  'were',
  'was',
  'will',
  'would',
  'could',
  'should',
  'which',
  'when',
  'what',
  'where',
  'while',
  'about',
  'after',
  'before',
  'between',
  'because',
  'they',
  'them',
  'than',
  'then',
  'into',
  'over',
  'under',
  'more',
  'most',
  'some',
  'such',
  'only',
  'also',
  'still',
  'other',
  'its',
  'and',
  'for',
  'are',
  'but',
  'not',
  'one',
  'two',
  'all',
  'can',
  'new',
  'now',
  'may',
]);

const MIN_TERM_LENGTH = 6;
const MIN_CLOZE_SENTENCE_WORDS = 8;

export function buildQuestions(page: ScrapedPage): Question[] {
  return [
    titleQuestion(page),
    authorQuestion(page),
    firstHeadingQuestion(page),
    clozeQuestion(page),
    sectionOfTermQuestion(page),
  ];
}

/** EXTRACTION: the headline, which every page has. */
function titleQuestion(page: ScrapedPage): Question {
  return {
    id: 'q1-title',
    category: 'EXTRACTION',
    prompt: 'What is the title of this page? Answer with the title only.',
    expectedAnswer: page.title.length > 0 ? page.title : null,
    acceptableAnswers: [],
  };
}

/**
 * EXTRACTION: authorship.
 *
 * A page with no byline is still gradeable — the correct answer is then the
 * abstention token, which is how the benchmark measures whether a model
 * invents an author.
 */
function authorQuestion(page: ScrapedPage): Question {
  const byline = page.byline;

  return {
    id: 'q2-author',
    category: 'EXTRACTION',
    prompt: `Who wrote this page? Answer with the author's name only, or exactly "${NOT_IN_PAGE}" if the page does not say.`,
    expectedAnswer: byline === null ? NOT_IN_PAGE : stripBylinePrefix(byline),
    acceptableAnswers: byline === null ? [] : [byline],
  };
}

function stripBylinePrefix(byline: string): string {
  return normalizeWhitespace(byline.replace(/^\s*(by|por)\s+/i, ''));
}

/** EXTRACTION: document structure. */
function firstHeadingQuestion(page: ScrapedPage): Question {
  const heading = page.headings[0] ?? null;

  return {
    id: 'q3-first-heading',
    category: 'EXTRACTION',
    prompt:
      'What is the first section heading in the body of this page? Answer with the heading text only.',
    expectedAnswer: heading,
    acceptableAnswers: [],
  };
}

/**
 * COMPREHENSION: a cloze over a numeric fact.
 *
 * The model is shown the sentence with one number removed and must supply it.
 * That needs the sentence to be located and read, not just pattern-matched
 * against the question's own words.
 */
function clozeQuestion(page: ScrapedPage): Question {
  const target = findNumericSentence(page.text);

  if (target === null) {
    return {
      id: 'q4-cloze',
      category: 'COMPREHENSION',
      prompt:
        'Complete the missing value in a sentence from this page. (This page contains no suitable sentence, so this question cannot be graded.)',
      expectedAnswer: null,
      acceptableAnswers: [],
    };
  }

  const blanked = target.sentence.replace(target.number, '_____');

  return {
    id: 'q4-cloze',
    category: 'COMPREHENSION',
    prompt: `This sentence appears on the page with one value removed: "${blanked}" What value belongs in the blank? Answer with the value only.`,
    expectedAnswer: target.number,
    acceptableAnswers: [target.number.replace(/[,.]/g, '')],
  };
}

interface NumericSentence {
  sentence: string;
  number: string;
}

function findNumericSentence(text: string): NumericSentence | null {
  for (const sentence of splitSentences(text)) {
    if (countWordsIn(sentence) < MIN_CLOZE_SENTENCE_WORDS) {
      continue;
    }
    const match = /\b\d[\d.,]*\b/.exec(sentence);
    if (match !== null) {
      return { sentence, number: match[0] };
    }
  }
  return null;
}

/**
 * RELATION: connects a term in the body to the heading it sits under.
 *
 * Answering means locating the term and then working out which section
 * contains it — two facts on the page, related.
 */
function sectionOfTermQuestion(page: ScrapedPage): Question {
  const found = findTermUnderHeading(page);

  if (found === null) {
    return {
      id: 'q5-section-of-term',
      category: 'RELATION',
      prompt:
        'Which section of this page discusses a given term? (This page is not divided into sections that allow this question to be graded.)',
      expectedAnswer: null,
      acceptableAnswers: [],
    };
  }

  return {
    id: 'q5-section-of-term',
    category: 'RELATION',
    prompt: `Under which section heading does this page discuss "${found.term}"? Answer with the heading text only.`,
    expectedAnswer: found.heading,
    acceptableAnswers: [],
  };
}

interface TermUnderHeading {
  term: string;
  heading: string;
}

/**
 * Splits the text at its headings and looks for a distinctive word that occurs
 * in exactly one section. Uniqueness is what makes the answer unambiguous;
 * without it the question would have more than one defensible answer.
 */
function findTermUnderHeading(page: ScrapedPage): TermUnderHeading | null {
  const sections = splitIntoSections(page.text, page.headings);

  if (sections.length < 2) {
    return null;
  }

  const occurrences = new Map<string, Set<string>>();

  for (const section of sections) {
    for (const word of candidateTerms(section.body)) {
      const headings = occurrences.get(word) ?? new Set<string>();
      headings.add(section.heading);
      occurrences.set(word, headings);
    }
  }

  for (const section of sections) {
    for (const word of candidateTerms(section.body)) {
      if (occurrences.get(word)?.size === 1) {
        return { term: word, heading: section.heading };
      }
    }
  }

  return null;
}

interface Section {
  heading: string;
  body: string;
}

function splitIntoSections(text: string, headings: string[]): Section[] {
  const sections: Section[] = [];

  for (const [index, heading] of headings.entries()) {
    const start = text.indexOf(heading);
    if (start === -1) {
      continue;
    }
    const bodyStart = start + heading.length;
    const next = headings[index + 1];
    const end = next === undefined ? text.length : indexOrEnd(text, next, bodyStart);
    sections.push({ heading, body: text.slice(bodyStart, end) });
  }

  return sections.filter((section) => countWordsIn(section.body) > 0);
}

function indexOrEnd(text: string, needle: string, from: number): number {
  const found = text.indexOf(needle, from);
  return found === -1 ? text.length : found;
}

/** Distinctive lower-cased words: long enough and not part of the common set. */
function candidateTerms(body: string): string[] {
  const seen = new Set<string>();
  const out: string[] = [];

  for (const raw of body.split(/[^\p{L}]+/u)) {
    const word = raw.toLowerCase();
    if (word.length < MIN_TERM_LENGTH || COMMON_TERMS.has(word) || seen.has(word)) {
      continue;
    }
    seen.add(word);
    out.push(word);
  }

  return out;
}

function splitSentences(text: string): string[] {
  return text
    .split(/(?<=[.!?])\s+|\n+/)
    .map((sentence) => normalizeWhitespace(sentence))
    .filter((sentence) => sentence.length > 0);
}

function countWordsIn(value: string): number {
  const normalized = normalizeWhitespace(value);
  return normalized.length === 0 ? 0 : normalized.split(' ').length;
}
