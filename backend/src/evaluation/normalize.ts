/**
 * Answer normalisation.
 *
 * Comparison happens on normalised text so that "Three Euros." and
 * "three euros" are the same answer, without the comparison becoming so loose
 * that it stops discriminating.
 */

// Stryker disable all: the two lookup tables below are data, not logic.
// Mutating each entry produces hundreds of mutants that can only be killed by
// asserting every word individually, which tests the table rather than the
// normalisation rules that use it.
/** Number words the evaluator treats as equal to their digits. */
const NUMBER_WORDS: Record<string, string> = {
  zero: '0',
  one: '1',
  two: '2',
  three: '3',
  four: '4',
  five: '5',
  six: '6',
  seven: '7',
  eight: '8',
  nine: '9',
  ten: '10',
  eleven: '11',
  twelve: '12',
  thirteen: '13',
  fourteen: '14',
  fifteen: '15',
  sixteen: '16',
  seventeen: '17',
  eighteen: '18',
  nineteen: '19',
  twenty: '20',
  thirty: '30',
  forty: '40',
  fifty: '50',
  sixty: '60',
  seventy: '70',
  eighty: '80',
  ninety: '90',
  hundred: '100',
  thousand: '1000',
  million: '1000000',
  billion: '1000000000',
};

/** Words dropped before comparison: they carry no discriminating content. */
const FILLER_WORDS = new Set([
  'the',
  'a',
  'an',
  'of',
  'is',
  'are',
  'was',
  'were',
  'to',
  'in',
  'on',
  'at',
  'by',
  'and',
  'that',
  'it',
  'as',
  'answer',
]);

/**
 * Lowercases, strips accents and punctuation, and collapses whitespace.
 * Digit grouping is removed so "25,000" and "25000" compare equal.
 */
export function normalizeAnswer(value: string): string {
  return value
    .normalize('NFD')
    .replace(/[̀-ͯ]/g, '')
    .toLowerCase()
    .replace(/(\d)[,.](?=\d{3}\b)/g, '$1')
    .replace(/[^\p{L}\p{N}\s]/gu, ' ')
    .replace(/\s+/g, ' ')
    .trim();
}

/** Normalised, filler-free, number-word-folded tokens. */
export function answerTokens(value: string): string[] {
  const normalized = normalizeAnswer(value);
  if (normalized.length === 0) {
    return [];
  }

  const tokens = normalized
    .split(' ')
    .map((token) => NUMBER_WORDS[token] ?? token)
    .filter((token) => token.length > 0 && !FILLER_WORDS.has(token));

  return mergeCompoundNumbers(tokens);
}

/**
 * Joins an English tens-plus-units pair into one number, so "twenty five"
 * and "25" compare equal.
 *
 * Only this one compound shape is handled. Larger constructions such as
 * "one hundred and fifty" are left as separate tokens, which costs recall in
 * the comparison but never produces a wrong merge.
 */
function mergeCompoundNumbers(tokens: string[]): string[] {
  const merged: string[] = [];

  for (let index = 0; index < tokens.length; index += 1) {
    const current = Number(tokens[index]);
    const next = Number(tokens[index + 1]);
    const isTens =
      Number.isInteger(current) && current >= 20 && current <= 90 && current % 10 === 0;
    const isUnit = Number.isInteger(next) && next >= 1 && next <= 9;

    if (tokens[index + 1] !== undefined && isTens && isUnit) {
      merged.push(String(current + next));
      index += 1;
      continue;
    }

    merged.push(tokens[index] as string);
  }

  return merged;
}

/** Fraction of `expected`'s tokens that also appear in `actual` (0 when empty). */
export function tokenOverlap(expected: string, actual: string): number {
  const expectedTokens = answerTokens(expected);
  if (expectedTokens.length === 0) {
    return 0;
  }

  const actualTokens = new Set(answerTokens(actual));
  const matched = expectedTokens.filter((token) => actualTokens.has(token)).length;

  return matched / expectedTokens.length;
}

/** True when every token of `expected` appears in `actual`. */
export function containsAllTokens(expected: string, actual: string): boolean {
  const expectedTokens = answerTokens(expected);
  return expectedTokens.length > 0 && tokenOverlap(expected, actual) === 1;
}
