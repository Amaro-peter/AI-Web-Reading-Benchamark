/** Collapses all runs of whitespace into single spaces and trims. */
export function normalizeWhitespace(value: string): string {
  return value.replace(/\s+/g, ' ').trim();
}

/**
 * Collapses whitespace inside each line but keeps paragraph breaks, so the
 * text handed to a model still shows where one paragraph ends.
 */
export function normalizeBlockText(value: string): string {
  return value
    .split(/\n{2,}/)
    .map((block) => normalizeWhitespace(block))
    .filter((block) => block.length > 0)
    .join('\n\n');
}

/** Counts whitespace-separated words. */
export function countWords(value: string): number {
  const normalized = normalizeWhitespace(value);
  return normalized.length === 0 ? 0 : normalized.split(' ').length;
}

/**
 * Truncates at a word boundary when possible, so a model is never handed a
 * half word at the cut point.
 */
export function truncateAtWordBoundary(value: string, maxChars: number): string {
  if (maxChars <= 0) {
    return '';
  }
  if (value.length <= maxChars) {
    return value;
  }

  const slice = value.slice(0, maxChars);
  const lastSpace = slice.lastIndexOf(' ');
  return (lastSpace > maxChars * 0.8 ? slice.slice(0, lastSpace) : slice).trimEnd();
}
