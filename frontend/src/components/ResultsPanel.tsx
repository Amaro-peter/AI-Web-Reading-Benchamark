'use client';

import { useState } from 'react';
import { formatDuration, formatNumber } from '@/lib/format';
import { PROVIDER_IDS, type BenchmarkResult } from '@/lib/types';
import { ComparisonTable } from './ComparisonTable';
import { ProviderScoreCard } from './ProviderScoreCard';
import { RecommendationsPanel } from './RecommendationsPanel';

export function ResultsPanel({ result }: { result: BenchmarkResult }) {
  const [copiedLatex, setCopiedLatex] = useState(false);

  function downloadJson() {
    const blob = new Blob([JSON.stringify(result, null, 2)], { type: 'application/json' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `benchmark-${Date.now()}.json`;
    a.click();
    URL.revokeObjectURL(url);
  }

  function downloadCsv() {
    const headers = [
      'Question ID',
      'Category',
      'Question',
      'Expected Answer',
      'Provider',
      'Model',
      'Actual Answer',
      'Verdict',
      'Score',
      'Duration (ms)',
    ];
    const rows = [headers.join(',')];

    for (const q of result.questions) {
      for (const id of PROVIDER_IDS) {
        const p = result.results[id];
        if (!p) continue;
        const answer = p.answers.find((a) => a.questionId === q.id);
        const cleanPrompt = (q.prompt || '').replace(/"/g, '""');
        const cleanExpected = (q.expectedAnswer || '').replace(/"/g, '""');
        const cleanActual = (answer?.answer || answer?.error?.message || 'Not run').replace(
          /"/g,
          '""',
        );
        rows.push(
          `"${q.id}","${q.category}","${cleanPrompt}","${cleanExpected}","${p.label}","${p.model}","${cleanActual}","${answer?.verdict || 'NOT_EVALUABLE'}",${answer?.score ?? 0},${answer?.durationMs ?? 0}`,
        );
      }
    }

    const blob = new Blob([rows.join('\n')], { type: 'text/csv' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `benchmark-${Date.now()}.csv`;
    a.click();
    URL.revokeObjectURL(url);
  }

  function copyLatexTable() {
    let tex = `% --- Academic Paper LaTeX Table ---
\\begin{table}[h]
\\centering
\\caption{Evaluation Results on ${result.page.title.replace(/[&%$#_{}]/g, '\\$&')}}
\\label{tab:benchmark_run}
\\begin{tabular}{lcccc}
\\toprule
\\textbf{Model} & \\textbf{Overall (\\%)} & \\textbf{Extr} & \\textbf{Comp} & \\textbf{Rel} \\\\
\\midrule
`;
    for (const id of PROVIDER_IDS) {
      const p = result.results[id];
      if (!p || !p.scores) continue;
      const overall =
        p.scores.overall.percentage !== null
          ? `${p.scores.overall.percentage.toFixed(1)}\\%`
          : 'N/A';
      const extr =
        p.scores.byCategory.EXTRACTION.percentage !== null
          ? `${p.scores.byCategory.EXTRACTION.percentage.toFixed(1)}\\%`
          : 'N/A';
      const comp =
        p.scores.byCategory.COMPREHENSION.percentage !== null
          ? `${p.scores.byCategory.COMPREHENSION.percentage.toFixed(1)}\\%`
          : 'N/A';
      const rel =
        p.scores.byCategory.RELATION.percentage !== null
          ? `${p.scores.byCategory.RELATION.percentage.toFixed(1)}\\%`
          : 'N/A';
      tex += `${p.label.padEnd(16)} & ${overall} & ${extr} & ${comp} & ${rel} \\\\\n`;
    }
    tex += `\\bottomrule
\\end{tabular}
\\end{table}
`;
    if (typeof navigator !== 'undefined' && navigator.clipboard) {
      navigator.clipboard.writeText(tex);
    }
    setCopiedLatex(true);
    setTimeout(() => setCopiedLatex(false), 2500);
  }

  return (
    <section aria-labelledby="results-heading" className="mt-10">
      <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
        <h2 id="results-heading" className="text-xl font-semibold">
          Results
        </h2>
        <div className="flex flex-wrap items-center gap-2">
          <button
            type="button"
            onClick={copyLatexTable}
            className="rounded-lg border border-slate-300 bg-white px-3 py-1.5 text-xs font-medium text-slate-700 shadow-sm transition hover:bg-slate-50 dark:border-slate-700 dark:bg-slate-800 dark:text-slate-200 dark:hover:bg-slate-700"
          >
            {copiedLatex ? 'LaTeX Copied!' : 'Copy LaTeX Table'}
          </button>
          <button
            type="button"
            onClick={downloadCsv}
            className="rounded-lg border border-slate-300 bg-white px-3 py-1.5 text-xs font-medium text-slate-700 shadow-sm transition hover:bg-slate-50 dark:border-slate-700 dark:bg-slate-800 dark:text-slate-200 dark:hover:bg-slate-700"
          >
            Export CSV
          </button>
          <button
            type="button"
            onClick={downloadJson}
            className="rounded-lg border border-slate-300 bg-white px-3 py-1.5 text-xs font-medium text-slate-700 shadow-sm transition hover:bg-slate-50 dark:border-slate-700 dark:bg-slate-800 dark:text-slate-200 dark:hover:bg-slate-700"
          >
            Export JSON
          </button>
        </div>
      </div>

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

      <RecommendationsPanel readiness={result.readiness} optimizations={result.optimizations} />

      <h3 className="mt-8 text-lg font-semibold">Every answer</h3>
      <p className="mt-1 mb-4 text-sm text-slate-600 dark:text-slate-400">
        Nothing is hidden or summarised away — the expected answer is shown next to each question so
        you can check the grading yourself.
      </p>

      <ComparisonTable result={result} />
    </section>
  );
}
