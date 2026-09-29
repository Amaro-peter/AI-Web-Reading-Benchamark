import { formatDuration, formatNumber } from '@/lib/format';
import { PROVIDER_IDS, type BenchmarkResult } from '@/lib/types';
import { ComparisonTable } from './ComparisonTable';
import { ProviderScoreCard } from './ProviderScoreCard';

export function ResultsPanel({ result }: { result: BenchmarkResult }) {
  return (
    <section aria-labelledby="results-heading" className="mt-10">
      <h2 id="results-heading" className="text-xl font-semibold">
        Results
      </h2>

      <dl className="mt-4 grid gap-x-6 gap-y-3 rounded-xl border border-slate-200 bg-white p-4 text-sm sm:grid-cols-2 dark:border-slate-800 dark:bg-slate-900">
        <div className="sm:col-span-2">
          <dt className="text-slate-600 dark:text-slate-400">Page</dt>
          <dd className="font-medium">{result.page.title}</dd>
        </div>

        <div className="sm:col-span-2">
          <dt className="text-slate-600 dark:text-slate-400">URL</dt>
          <dd className="break-all">
            <a
              href={result.finalUrl}
              rel="noopener noreferrer nofollow"
              target="_blank"
              className="text-sky-700 underline underline-offset-2 hover:text-sky-900 dark:text-sky-400 dark:hover:text-sky-300"
            >
              {result.finalUrl}
            </a>
            {result.finalUrl !== result.url && (
              <span className="ml-2 text-xs text-slate-500 dark:text-slate-400">
                (redirected from {result.url})
              </span>
            )}
          </dd>
        </div>

        <div>
          <dt className="text-slate-600 dark:text-slate-400">Words extracted</dt>
          <dd className="tabular-nums">
            {formatNumber(result.page.wordCount)}
            {result.page.truncated && (
              <span className="ml-2 text-xs text-amber-700 dark:text-amber-400">
                truncated before being sent to the models
              </span>
            )}
          </dd>
        </div>

        <div>
          <dt className="text-slate-600 dark:text-slate-400">Model time</dt>
          <dd className="tabular-nums">{formatDuration(result.durationMs)}</dd>
        </div>

        {result.page.byline !== null && (
          <div>
            <dt className="text-slate-600 dark:text-slate-400">Author</dt>
            <dd>{result.page.byline}</dd>
          </div>
        )}

        {result.page.siteName !== null && (
          <div>
            <dt className="text-slate-600 dark:text-slate-400">Site</dt>
            <dd>{result.page.siteName}</dd>
          </div>
        )}

        <div>
          <dt className="text-slate-600 dark:text-slate-400">Grading method</dt>
          <dd>{result.judge}</dd>
        </div>
      </dl>

      <h3 className="mt-8 text-lg font-semibold">Scores</h3>
      <p className="mt-1 text-sm text-slate-600 dark:text-slate-400">
        Correct = 1, partial = 0.5, incorrect = 0. Questions the page cannot answer are excluded
        from the total rather than counted as failures.
      </p>

      <div className="mt-4 grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
        {PROVIDER_IDS.map((id) => {
          const provider = result.results[id];
          return provider === undefined ? null : <ProviderScoreCard key={id} result={provider} />;
        })}
      </div>

      <h3 className="mt-8 text-lg font-semibold">Every answer</h3>
      <p className="mt-1 mb-4 text-sm text-slate-600 dark:text-slate-400">
        Nothing is hidden or summarised away — the expected answer is shown next to each question so
        you can check the grading yourself.
      </p>

      <ComparisonTable result={result} />
    </section>
  );
}
