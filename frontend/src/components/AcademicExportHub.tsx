'use client';

import { useState } from 'react';
import { PROVIDER_IDS, type BenchmarkResult } from '@/lib/types';

interface AcademicExportHubProps {
  result: BenchmarkResult;
}

export function AcademicExportHub({ result }: AcademicExportHubProps) {
  const [copiedKey, setCopiedKey] = useState<string | null>(null);

  const cleanTitle = (result.page.title || 'Web Document').replace(/[&%$#_{}]/g, '\\$&');

  // Build LaTeX table
  let latexTable = `% --- Auto-generated Academic LaTeX Table ---
\\begin{table}[h]
\\centering
\\caption{Model Evaluation on ${cleanTitle}}
\\label{tab:web_reading_evaluation}
\\begin{tabular}{lcccc}
\\toprule
\\textbf{Model} & \\textbf{Overall (\\%)} & \\textbf{Extr} & \\textbf{Comp} & \\textbf{Rel} \\\\
\\midrule
`;
  for (const id of PROVIDER_IDS) {
    const p = result.results[id];
    if (!p || !p.scores) continue;
    const overall =
      p.scores.overall.percentage !== null ? `${p.scores.overall.percentage.toFixed(1)}\\%` : 'N/A';
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
    latexTable += `${p.label.padEnd(16)} & ${overall} & ${extr} & ${comp} & ${rel} \\\\\n`;
  }
  latexTable += `\\bottomrule
\\end{tabular}
\\end{table}`;

  const bibtex = `@article{amaro2026aiwebreading,
  title={AI Web Reading Benchmark: Evaluating LLM Extraction, DOM Perplexity, and Agent Affordances},
  author={Amaro, Pedro},
  journal={arXiv preprint},
  year={2026},
  url={https://github.com/Amaro-peter/AI-Web-Reading-Benchamark},
  note={Evaluation target: ${cleanTitle}}
}`;

  const methodology = `We evaluate frontier language models (ChatGPT, Claude, Gemini) on web page comprehension using a zero-shot factual probe paradigm with strict grounding boundaries (<page_content> data isolation). Responses are scored against deterministic ground truth. AI readability is characterized using five peer-reviewed dimensions: Semantic Information Density (SID, TACL '24), Heading Path Consistency Index (HPCI, ACL '23), Accessibility Affordance Completeness (AAC, ICLR '24), DOM Structural Entropy (DCE, ACL '22), and Multimodal & Entity Grounding (MEG, NeurIPS '24).`;

  function copyText(key: string, text: string) {
    navigator.clipboard.writeText(text);
    setCopiedKey(key);
    setTimeout(() => setCopiedKey(null), 2500);
  }

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

  return (
    <div className="space-y-6">
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4 border-b border-slate-200 pb-4 dark:border-slate-800">
        <div>
          <h4 className="text-base font-semibold text-slate-900 dark:text-slate-100">
            Academic Research &amp; Publication Export Hub
          </h4>
          <p className="mt-1 text-xs text-slate-500 dark:text-slate-400">
            Export evaluation data, LaTeX tables, and BibTeX citations formatted for publication.
          </p>
        </div>
        <div className="flex items-center gap-2">
          <button
            type="button"
            onClick={downloadJson}
            className="rounded-lg border border-slate-300 bg-white px-3 py-1.5 text-xs font-medium text-slate-700 shadow-sm transition hover:bg-slate-50 dark:border-slate-700 dark:bg-slate-800 dark:text-slate-200 dark:hover:bg-slate-700"
          >
            Download JSON
          </button>
          <button
            type="button"
            onClick={downloadCsv}
            className="rounded-lg border border-slate-300 bg-white px-3 py-1.5 text-xs font-medium text-slate-700 shadow-sm transition hover:bg-slate-50 dark:border-slate-700 dark:bg-slate-800 dark:text-slate-200 dark:hover:bg-slate-700"
          >
            Download CSV
          </button>
        </div>
      </div>

      <div className="grid gap-6 md:grid-cols-2">
        {/* LaTeX Table */}
        <div className="rounded-xl border border-slate-200 bg-white p-4 dark:border-slate-800 dark:bg-slate-900">
          <div className="flex items-center justify-between">
            <span className="text-xs font-semibold uppercase tracking-wider text-slate-700 dark:text-slate-300">
              LaTeX Table (booktabs)
            </span>
            <button
              type="button"
              onClick={() => copyText('latex', latexTable)}
              className="text-xs font-medium text-sky-600 hover:text-sky-700 dark:text-sky-400"
            >
              {copiedKey === 'latex' ? '✓ Copied' : 'Copy LaTeX'}
            </button>
          </div>
          <pre className="mt-3 overflow-x-auto rounded-lg bg-slate-50 p-3 font-mono text-[11px] leading-relaxed text-slate-800 dark:bg-slate-950 dark:text-slate-200">
            {latexTable}
          </pre>
        </div>

        {/* BibTeX Citation */}
        <div className="rounded-xl border border-slate-200 bg-white p-4 dark:border-slate-800 dark:bg-slate-900">
          <div className="flex items-center justify-between">
            <span className="text-xs font-semibold uppercase tracking-wider text-slate-700 dark:text-slate-300">
              BibTeX Citation
            </span>
            <button
              type="button"
              onClick={() => copyText('bibtex', bibtex)}
              className="text-xs font-medium text-sky-600 hover:text-sky-700 dark:text-sky-400"
            >
              {copiedKey === 'bibtex' ? '✓ Copied' : 'Copy BibTeX'}
            </button>
          </div>
          <pre className="mt-3 overflow-x-auto rounded-lg bg-slate-50 p-3 font-mono text-[11px] leading-relaxed text-slate-800 dark:bg-slate-950 dark:text-slate-200">
            {bibtex}
          </pre>
        </div>
      </div>

      {/* Methodology Description */}
      <div className="rounded-xl border border-slate-200 bg-white p-4 dark:border-slate-800 dark:bg-slate-900">
        <div className="flex items-center justify-between">
          <span className="text-xs font-semibold uppercase tracking-wider text-slate-700 dark:text-slate-300">
            Scientific Evaluation Methodology (Paper Paragraph)
          </span>
          <button
            type="button"
            onClick={() => copyText('methodology', methodology)}
            className="text-xs font-medium text-sky-600 hover:text-sky-700 dark:text-sky-400"
          >
            {copiedKey === 'methodology' ? '✓ Copied' : 'Copy Text'}
          </button>
        </div>
        <p className="mt-2 text-xs leading-relaxed text-slate-700 dark:text-slate-300">
          {methodology}
        </p>
      </div>
    </div>
  );
}
