#!/usr/bin/env node

/**
 * Paper-Level Benchmark Evaluation Harness
 *
 * Runs scientific evaluations against real-world WebArena-aligned web pages,
 * collecting grounded accuracy, abstention rates, affordance recognition,
 * and generating LaTeX tables, CSV, and JSON artifacts for publication.
 */

import { existsSync, mkdirSync, readFileSync, writeFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { loadDotEnvFile } from '../backend/dist/config/dotenv.js';
import { apiKeyFor, loadEnv } from '../backend/dist/config/env.js';
import { modelConfigFor } from '../backend/dist/config/models.js';
import { OpenAIProvider } from '../backend/dist/providers/openai.js';
import { ClaudeProvider } from '../backend/dist/providers/claude.js';
import { MockProvider } from '../backend/dist/providers/mock.js';
import { scrapeOptionsFromEnv, scrapePage } from '../backend/dist/scraper/index.js';
import { evaluateAnswer, heuristicJudge } from '../backend/dist/evaluation/judge.js';
import { scoreForVerdict } from '../backend/dist/domain/benchmark.js';

// Ensure .env is loaded
const rootEnv = resolve(process.cwd(), '.env');
const parentEnv = resolve(process.cwd(), '..', '.env');
const envPath = existsSync(rootEnv) ? rootEnv : existsSync(parentEnv) ? parentEnv : rootEnv;
loadDotEnvFile(envPath);

const env = loadEnv();
const scrapeOptions = scrapeOptionsFromEnv(env);

// Load WebArena dataset
const datasetPath = resolve(process.cwd(), 'benchmarks', 'webarena_dataset.json');
if (!existsSync(datasetPath)) {
  console.error(`Dataset not found at: ${datasetPath}`);
  process.exit(1);
}

const dataset = JSON.parse(readFileSync(datasetPath, 'utf8'));

// Initialize available providers
const activeProviders = [];

const openAiKey = apiKeyFor(env, 'openai');
if (openAiKey) {
  const model = modelConfigFor(env, 'openai');
  activeProviders.push({
    id: 'openai',
    label: 'ChatGPT (OpenAI)',
    model: model.model,
    provider: new OpenAIProvider({
      apiKey: openAiKey,
      model: model.model,
      maxOutputTokens: 256,
      timeoutMs: env.PROVIDER_TIMEOUT_MS,
    }),
  });
}

const claudeKey = apiKeyFor(env, 'claude');
if (claudeKey) {
  const model = modelConfigFor(env, 'claude');
  activeProviders.push({
    id: 'claude',
    label: 'Claude (Anthropic)',
    model: model.model,
    provider: new ClaudeProvider({
      apiKey: claudeKey,
      model: model.model,
      maxOutputTokens: 256,
      timeoutMs: env.PROVIDER_TIMEOUT_MS,
      workspaceId: env.ANTHROPIC_WORKSPACE_ID,
    }),
  });
}

// Fallback to mock providers if no real keys configured or mock mode requested
if (activeProviders.length === 0 || env.AI_PROVIDER_MODE === 'mock') {
  console.log('Running benchmark in MOCK mode (no live keys configured)...');
  activeProviders.push(
    {
      id: 'openai-mock',
      label: 'OpenAI (Mock)',
      model: 'mock-gpt4o',
      provider: new MockProvider({ name: 'openai', model: 'mock-gpt4o', strategy: 'sentence' }),
    },
    {
      id: 'claude-mock',
      label: 'Claude (Mock)',
      model: 'mock-claude',
      provider: new MockProvider({ name: 'claude', model: 'mock-claude', strategy: 'sentence' }),
    },
  );
}

console.log('='.repeat(70));
console.log('  AI WEB READING BENCHMARK — SCIENTIFIC EVALUATION SUITE');
console.log('='.repeat(70));
console.log(
  `Evaluated Models: ${activeProviders.map((p) => `${p.label} (${p.model})`).join(', ')}`,
);
console.log(`Benchmark Tasks:  ${dataset.length} domains from WebArena`);
console.log(`Scraper Engine:   Readability + JSDOM with SSRF Guard`);
console.log('-'.repeat(70));

const results = [];
const csvRows = [
  'taskId,domain,url,category,questionId,questionPrompt,expectedAnswer,providerId,model,actualAnswer,verdict,score,durationMs',
];

for (const task of dataset) {
  console.log(`\n[Task: ${task.id}] ${task.name} (${task.domain})`);
  console.log(`URL: ${task.url}`);

  let scraped;
  try {
    scraped = await scrapePage(task.url, scrapeOptions);
    console.log(` -> Extracted: "${scraped.title}" (${scraped.wordCount} words)`);
  } catch (err) {
    console.error(` -> Scraping failed: ${err.message}`);
    continue;
  }

  const taskResult = {
    taskId: task.id,
    domain: task.domain,
    name: task.name,
    url: task.url,
    pageTitle: scraped.title,
    wordCount: scraped.wordCount,
    questions: [],
  };

  for (const q of task.groundTruthQuestions) {
    const questionResult = {
      questionId: q.id,
      category: q.category,
      prompt: q.prompt,
      expectedAnswer: q.expectedAnswer,
      modelAnswers: {},
    };

    for (const p of activeProviders) {
      const start = Date.now();
      let answer = null;
      let error = null;
      let verdict = 'NOT_EVALUABLE';
      let score = 0;

      try {
        answer = await p.provider.answer({
          pageContent: scraped.text,
          question: q.prompt,
        });

        verdict = evaluateAnswer(heuristicJudge, q, answer);
        score = scoreForVerdict(verdict);
      } catch (err) {
        error = err.message;
        verdict = 'NOT_EVALUABLE';
      }

      const durationMs = Date.now() - start;

      questionResult.modelAnswers[p.id] = {
        answer,
        verdict,
        score,
        durationMs,
        error,
      };

      const cleanPrompt = q.prompt.replace(/"/g, '""');
      const cleanExpected = (q.expectedAnswer || '').replace(/"/g, '""');
      const cleanActual = (answer || error || '').replace(/"/g, '""');

      csvRows.push(
        `"${task.id}","${task.domain}","${task.url}","${q.category}","${q.id}","${cleanPrompt}","${cleanExpected}","${p.id}","${p.model}","${cleanActual}","${verdict}",${score},${durationMs}`,
      );

      const symbol = verdict === 'CORRECT' ? '✓' : verdict === 'PARTIAL' ? '~' : '✗';
      console.log(
        `  [${p.id}] ${symbol} ${q.category} (${durationMs}ms): ${answer || `ERROR: ${error}`}`,
      );
    }

    taskResult.questions.push(questionResult);
  }

  results.push(taskResult);
}

// Compute aggregate metrics
const stats = {};
for (const p of activeProviders) {
  stats[p.id] = {
    id: p.id,
    label: p.label,
    model: p.model,
    totalQuestions: 0,
    evaluated: 0,
    correct: 0,
    partial: 0,
    incorrect: 0,
    notEvaluable: 0,
    totalScore: 0,
    totalDurationMs: 0,
    byCategory: {},
    abstentionsEvaluated: 0,
    abstentionsCorrect: 0,
  };
}

for (const task of results) {
  for (const q of task.questions) {
    for (const p of activeProviders) {
      const res = q.modelAnswers[p.id];
      if (!res) continue;

      const pStat = stats[p.id];
      pStat.totalQuestions += 1;
      pStat.totalDurationMs += res.durationMs;

      if (!pStat.byCategory[q.category]) {
        pStat.byCategory[q.category] = { evaluated: 0, score: 0 };
      }

      if (res.verdict === 'CORRECT') pStat.correct += 1;
      else if (res.verdict === 'PARTIAL') pStat.partial += 1;
      else if (res.verdict === 'INCORRECT') pStat.incorrect += 1;
      else pStat.notEvaluable += 1;

      if (res.verdict !== 'NOT_EVALUABLE') {
        pStat.evaluated += 1;
        pStat.totalScore += res.score;
        pStat.byCategory[q.category].evaluated += 1;
        pStat.byCategory[q.category].score += res.score;
      }

      if (q.category === 'ABSTENTION' && res.verdict !== 'NOT_EVALUABLE') {
        pStat.abstentionsEvaluated += 1;
        if (res.verdict === 'CORRECT') {
          pStat.abstentionsCorrect += 1;
        }
      }
    }
  }
}

// Compute percentages
for (const p of activeProviders) {
  const pStat = stats[p.id];
  pStat.overallAccuracy = pStat.evaluated > 0 ? (pStat.totalScore / pStat.evaluated) * 100 : 0;
  pStat.meanLatencyMs = pStat.totalQuestions > 0 ? pStat.totalDurationMs / pStat.totalQuestions : 0;
  pStat.abstentionAccuracy =
    pStat.abstentionsEvaluated > 0
      ? (pStat.abstentionsCorrect / pStat.abstentionsEvaluated) * 100
      : 0;
  pStat.hallucinationRate = 100 - pStat.abstentionAccuracy;

  for (const [cat, catStat] of Object.entries(pStat.byCategory)) {
    catStat.percentage = catStat.evaluated > 0 ? (catStat.score / catStat.evaluated) * 100 : 0;
  }
}

// Ensure reports directory exists
const reportsDir = resolve(process.cwd(), 'reports');
mkdirSync(reportsDir, { recursive: true });

// 1. JSON Report
const jsonReportPath = resolve(reportsDir, 'benchmark-summary.json');
writeFileSync(
  jsonReportPath,
  JSON.stringify(
    {
      benchmark: 'AI Web Reading & Usability Benchmark (AWRB-Eval)',
      version: '1.0.0',
      timestamp: new Date().toISOString(),
      models: activeProviders.map((p) => ({ id: p.id, model: p.model, label: p.label })),
      stats,
      tasks: results,
    },
    null,
    2,
  ),
  'utf8',
);

// 2. CSV Report
const csvReportPath = resolve(reportsDir, 'benchmark-summary.csv');
writeFileSync(csvReportPath, csvRows.join('\n'), 'utf8');

// 3. LaTeX Table Generator for Research Paper
const latexTable = generateLatexTable(stats, activeProviders);
const latexReportPath = resolve(reportsDir, 'paper-tables.tex');
writeFileSync(latexReportPath, latexTable, 'utf8');

console.log('\n' + '='.repeat(70));
console.log('  BENCHMARK SUMMARY RESULTS (PAPER-READY)');
console.log('='.repeat(70));

for (const p of activeProviders) {
  const s = stats[p.id];
  console.log(`\nModel: ${s.label} [${s.model}]`);
  console.log(
    ` -> Overall Accuracy:        ${s.overallAccuracy.toFixed(1)}% (${s.totalScore}/${s.evaluated})`,
  );
  console.log(
    ` -> Abstention Accuracy:     ${s.abstentionAccuracy.toFixed(1)}% (Refusal to hallucinate)`,
  );
  console.log(` -> Hallucination Rate:      ${s.hallucinationRate.toFixed(1)}%`);
  console.log(` -> Mean Latency:            ${s.meanLatencyMs.toFixed(0)} ms / query`);

  console.log(' -> Category Breakdown:');
  for (const [cat, c] of Object.entries(s.byCategory)) {
    console.log(`    * ${cat.padEnd(20)}: ${c.percentage.toFixed(1)}% (${c.score}/${c.evaluated})`);
  }
}

console.log('\n' + '-'.repeat(70));
console.log(`Artifacts generated:`);
console.log(` - JSON Report: ${jsonReportPath}`);
console.log(` - CSV Dataset: ${csvReportPath}`);
console.log(` - LaTeX Table: ${latexReportPath}`);
console.log('-'.repeat(70));

function generateLatexTable(statsMap, providers) {
  const categories = [
    'EXTRACTION',
    'COMPREHENSION',
    'RELATION',
    'USABILITY_AFFORDANCE',
    'ABSTENTION',
  ];

  let tex = `% --- Auto-generated LaTeX table for academic publication ---
\\begin{table*}[t]
\\centering
\\small
\\caption{Comparative performance on the AI Web Reading and Usability Benchmark across Frontier Models. Acc denotes overall accuracy; Extr, Comp, Rel, Afford, and Abst denote category-specific accuracies; Latency denotes mean response time per query in milliseconds.}
\\label{tab:web_reading_benchmark}
\\begin{tabular}{lccccccr}
\\toprule
\\textbf{Model} & \\textbf{Acc (\\%)} & \\textbf{Extr} & \\textbf{Comp} & \\textbf{Rel} & \\textbf{Afford} & \\textbf{Abst} & \\textbf{Latency (ms)} \\\\
\\midrule
`;

  for (const p of providers) {
    const s = statsMap[p.id];
    const catScores = categories.map((c) => {
      const val = s.byCategory[c]?.percentage;
      return val !== undefined ? val.toFixed(1) : '-';
    });

    tex += `${s.label.padEnd(24)} & ${s.overallAccuracy.toFixed(1)} & ${catScores.join(' & ')} & ${s.meanLatencyMs.toFixed(0)} \\\\\n`;
  }

  tex += `\\bottomrule
\\end{tabular}
\\end{table*}
`;

  return tex;
}
