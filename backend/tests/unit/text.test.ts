import { describe, expect, it } from 'vitest';
import {
  countWords,
  normalizeBlockText,
  normalizeWhitespace,
  truncateAtWordBoundary,
} from '../../src/domain/text.js';

describe('normalizeWhitespace', () => {
  it.each([
    ['  hello   world  ', 'hello world'],
    ['line\nbreak', 'line break'],
    ['tabs\t\tand\tspaces', 'tabs and spaces'],
    ['', ''],
    ['   ', ''],
  ])('normalizes %j to %j', (input, expected) => {
    expect(normalizeWhitespace(input)).toBe(expected);
  });
});

describe('normalizeBlockText', () => {
  it('keeps paragraph boundaries but collapses inner whitespace', () => {
    expect(normalizeBlockText('one   line\nstill one\n\n  second   block ')).toBe(
      'one line still one\n\nsecond block',
    );
  });

  it('drops blocks that are only whitespace', () => {
    expect(normalizeBlockText('a\n\n   \n\nb')).toBe('a\n\nb');
  });
});

describe('countWords', () => {
  it.each([
    ['', 0],
    ['   ', 0],
    ['one', 1],
    ['one two three', 3],
    ['  spaced   out  words ', 3],
    ['line\nbreaks\ncount', 3],
  ])('counts %j as %i', (input, expected) => {
    expect(countWords(input)).toBe(expected);
  });
});

describe('truncateAtWordBoundary', () => {
  it('returns the input untouched when it already fits', () => {
    expect(truncateAtWordBoundary('short text', 100)).toBe('short text');
  });

  it('never returns more than the limit', () => {
    const result = truncateAtWordBoundary('a'.repeat(50) + ' ' + 'b'.repeat(50), 60);
    expect(result.length).toBeLessThanOrEqual(60);
  });

  it('cuts at a space when one is close enough to the limit', () => {
    expect(truncateAtWordBoundary('alpha beta gamma delta', 17)).toBe('alpha beta gamma');
  });

  it('cuts mid-word rather than losing most of the budget', () => {
    const result = truncateAtWordBoundary('short ' + 'x'.repeat(100), 20);
    expect(result).toBe('short xxxxxxxxxxxxxx');
  });

  it.each([0, -1])('returns empty for a limit of %i', (limit) => {
    expect(truncateAtWordBoundary('anything', limit)).toBe('');
  });
});
