/**
 * The shape of POST /api/benchmark, mirrored from the backend.
 *
 * Kept as a hand-written mirror rather than a shared package: the two apps
 * deploy separately (Railway and Vercel), and a shared workspace package
 * would have to be published or bundled for either deploy to work. The
 * backend's regression suite pins this shape, so a drift breaks a test rather
 * than production.
 */

export const PROVIDER_IDS = ['gemini', 'openai', 'claude'] as const;
export type ProviderId = (typeof PROVIDER_IDS)[number];

export const QUESTION_CATEGORIES = ['EXTRACTION', 'COMPREHENSION', 'RELATION'] as const;
export type QuestionCategory = (typeof QUESTION_CATEGORIES)[number];

export type Verdict = 'CORRECT' | 'PARTIAL' | 'INCORRECT' | 'NOT_EVALUABLE';

export type ProviderStatus = 'ok' | 'unavailable' | 'error';

export interface Question {
  id: string;
  category: QuestionCategory;
  prompt: string;
  expectedAnswer: string | null;
  acceptableAnswers: string[];
}

export interface AnswerRecord {
  questionId: string;
  answer: string | null;
  error: { code: string; message: string } | null;
  verdict: Verdict;
  score: number;
  durationMs: number;
}

export interface ScoreBreakdown {
  correct: number;
  partial: number;
  incorrect: number;
  notEvaluable: number;
  evaluated: number;
  score: number;
  /** Null when nothing could be graded — not the same as zero. */
  percentage: number | null;
}

export interface ScoreSummary {
  overall: ScoreBreakdown;
  byCategory: Record<QuestionCategory, ScoreBreakdown>;
}

export interface ProviderResult {
  id: ProviderId;
  label: string;
  model: string;
  status: ProviderStatus;
  reason: string | null;
  answers: AnswerRecord[];
  scores: ScoreSummary | null;
  durationMs: number;
}

export interface PageSummary {
  title: string;
  wordCount: number;
  charCount: number;
  truncated: boolean;
  byline: string | null;
  siteName: string | null;
  publishedTime: string | null;
  lang: string | null;
  headings: string[];
  extractionStrategy: string;
}

export interface BenchmarkResult {
  url: string;
  finalUrl: string;
  page: PageSummary;
  questions: Question[];
  results: Record<ProviderId, ProviderResult>;
  judge: string;
  disclaimer: string;
  generatedAt: string;
  durationMs: number;
}

export interface ApiError {
  code: string;
  message: string;
}
