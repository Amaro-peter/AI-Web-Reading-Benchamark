import { describe, expect, it } from 'vitest';
import {
  answerTokens,
  containsAllTokens,
  normalizeAnswer,
  tokenOverlap,
} from '../../src/evaluation/normalize.js';

describe('normalizeAnswer', () => {
  it.each([
    ['Three Euros.', 'three euros'],
    ['  MIXED   Case  ', 'mixed case'],
    ['"quoted answer"', 'quoted answer'],
    ['Ribeiro, Marta', 'ribeiro marta'],
    ['São Paulo', 'sao paulo'],
    ['Café', 'cafe'],
    ['', ''],
  ])('normalizes %j to %j', (input, expected) => {
    expect(normalizeAnswer(input)).toBe(expected);
  });

  it('removes digit grouping so 25,000 and 25000 compare equal', () => {
    expect(normalizeAnswer('25,000')).toBe(normalizeAnswer('25000'));
    expect(normalizeAnswer('1.000.000')).toBe('1000000');
  });

  it('does not merge a decimal into a different number', () => {
    expect(normalizeAnswer('3.20')).toBe('3 20');
  });
});

describe('answerTokens', () => {
  it('drops filler words', () => {
    expect(answerTokens('the fare is a euro')).toEqual(['fare', 'euro']);
  });

  it('folds number words onto digits', () => {
    expect(answerTokens('seven')).toEqual(['7']);
    expect(answerTokens('1914')).toEqual(['1914']);
  });

  it('merges an English tens-plus-units pair into one number', () => {
    expect(answerTokens('twenty five')).toEqual(['25']);
    expect(answerTokens('twenty five million')).toEqual(['25', '1000000']);
  });

  it('does not merge numbers that are not a tens-plus-units pair', () => {
    expect(answerTokens('five twenty')).toEqual(['5', '20']);
    expect(answerTokens('twenty thirty')).toEqual(['20', '30']);
  });

  it('returns nothing for empty or filler-only input', () => {
    expect(answerTokens('')).toEqual([]);
    expect(answerTokens('the of a')).toEqual([]);
  });
});

describe('tokenOverlap', () => {
  it('is 1 when every expected token is present', () => {
    expect(tokenOverlap('Route 28', 'The answer is Route 28.')).toBe(1);
  });

  it('is 0 when nothing matches', () => {
    expect(tokenOverlap('Route 28', 'Completely different')).toBe(0);
  });

  it('is a fraction for a partial match', () => {
    expect(tokenOverlap('Marta Ribeiro Silva', 'Marta Ribeiro')).toBeCloseTo(2 / 3);
  });

  it('is 0 when the expectation has no content tokens', () => {
    expect(tokenOverlap('the of', 'anything')).toBe(0);
  });
});

describe('containsAllTokens', () => {
  it('accepts a full sentence that carries the fact', () => {
    expect(containsAllTokens('1914', 'Route 28 opened in 1914.')).toBe(true);
  });

  it('rejects a sentence missing part of the fact', () => {
    expect(containsAllTokens('Marta Ribeiro', 'Written by Marta.')).toBe(false);
  });

  it('is false when the expectation is empty', () => {
    expect(containsAllTokens('', 'anything')).toBe(false);
  });
});
