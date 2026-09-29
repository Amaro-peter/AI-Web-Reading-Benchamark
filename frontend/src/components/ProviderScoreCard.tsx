import { formatDuration, formatPercentage, formatScore } from '@/lib/format';
import { QUESTION_CATEGORIES, type ProviderResult } from '@/lib/types';

const CATEGORY_LABELS: Record<(typeof QUESTION_CATEGORIES)[number], string> = {
  EXTRACTION: 'Extraction',
  COMPREHENSION: 'Comprehension',
  RELATION: 'Relation',
};

const STATUS_NOTE: Record<Exclude<ProviderResult['status'], 'ok'>, string> = {
  unavailable: 'Not run',
  error: 'Failed',
};

/**
 * One provider's scores.
 *
 * Cards are rendered in a fixed order and never sorted by score: this is a
 * comparison, not a leaderboard.
 */
export function ProviderScoreCard({ result }: { result: ProviderResult }) {
  const scores = result.scores;

  const headingId = `score-card-${result.id}`;

  return (
    <article
      aria-labelledby={headingId}
      className="rounded-xl border border-slate-200 bg-white p-4 dark:border-slate-800 dark:bg-slate-900"
    >
      <header className="flex items-baseline justify-between gap-2">
        <h3 id={headingId} className="text-base font-semibold">
          {result.label}
        </h3>
        {result.status !== 'ok' && (
          <span className="rounded-full bg-slate-100 px-2 py-0.5 text-xs font-medium text-slate-700 dark:bg-slate-800 dark:text-slate-300">
            {STATUS_NOTE[result.status]}
          </span>
        )}
      </header>

      <p
        className="mt-0.5 truncate text-xs text-slate-500 dark:text-slate-400"
        title={result.model}
      >
        {result.model}
      </p>

      {scores === null ? (
        <p className="mt-4 text-sm text-slate-600 dark:text-slate-400">
          {result.reason ?? 'This provider produced no answers, so it has no score.'}
        </p>
      ) : (
        <>
          <p className="mt-4 flex items-baseline gap-2">
            <span className="text-3xl font-semibold tabular-nums">
              {formatPercentage(scores.overall.percentage)}
            </span>
            <span className="text-sm text-slate-600 dark:text-slate-400">
              {formatScore(scores.overall)} points
            </span>
          </p>

          <dl className="mt-4 space-y-1.5">
            {QUESTION_CATEGORIES.map((category) => (
              <div key={category} className="flex items-baseline justify-between gap-2 text-sm">
                <dt className="text-slate-600 dark:text-slate-400">{CATEGORY_LABELS[category]}</dt>
                <dd className="tabular-nums">
                  {formatPercentage(scores.byCategory[category].percentage)}
                  <span className="ml-1 text-xs text-slate-500 dark:text-slate-500">
                    ({formatScore(scores.byCategory[category])})
                  </span>
                </dd>
              </div>
            ))}
          </dl>

          <p className="mt-3 text-xs text-slate-500 dark:text-slate-400">
            {formatDuration(result.durationMs)}
            {scores.overall.notEvaluable > 0 &&
              ` · ${scores.overall.notEvaluable} question(s) not evaluable`}
          </p>
        </>
      )}
    </article>
  );
}
