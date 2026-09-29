import type { ScoreBreakdown, Verdict } from './types';

/**
 * Formats a score.
 *
 * A null percentage means nothing on this run could be graded, which is not
 * the same as scoring zero, so it is never rendered as "0%".
 */
export function formatPercentage(percentage: number | null): string {
  return percentage === null ? 'n/a' : `${Math.round(percentage * 10) / 10}%`;
}

/** "2.5 / 4" — the raw score against the number of gradable questions. */
export function formatScore(breakdown: ScoreBreakdown): string {
  return `${breakdown.score} / ${breakdown.evaluated}`;
}

export const VERDICT_LABELS: Record<Verdict, string> = {
  CORRECT: 'Correct',
  PARTIAL: 'Partial',
  INCORRECT: 'Incorrect',
  NOT_EVALUABLE: 'Not evaluable',
};

/**
 * Colour per verdict. Every verdict also carries its label as text, so colour
 * is never the only cue.
 */
export const VERDICT_CLASSES: Record<Verdict, string> = {
  CORRECT:
    'bg-emerald-100 text-emerald-900 dark:bg-emerald-950 dark:text-emerald-200 ring-emerald-600/30',
  PARTIAL: 'bg-amber-100 text-amber-900 dark:bg-amber-950 dark:text-amber-200 ring-amber-600/30',
  INCORRECT: 'bg-rose-100 text-rose-900 dark:bg-rose-950 dark:text-rose-200 ring-rose-600/30',
  NOT_EVALUABLE:
    'bg-slate-100 text-slate-700 dark:bg-slate-800 dark:text-slate-300 ring-slate-500/30',
};

export function formatDuration(ms: number): string {
  return ms < 1000 ? `${ms} ms` : `${(ms / 1000).toFixed(1)} s`;
}

export function formatNumber(value: number): string {
  return new Intl.NumberFormat('en-US').format(value);
}
