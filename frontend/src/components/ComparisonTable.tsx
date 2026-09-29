import { VERDICT_CLASSES, VERDICT_LABELS } from '@/lib/format';
import { PROVIDER_IDS, type AnswerRecord, type BenchmarkResult, type Question } from '@/lib/types';

function answerFor(result: BenchmarkResult, providerId: string, questionId: string) {
  const provider = result.results[providerId as (typeof PROVIDER_IDS)[number]];
  return provider?.answers.find((answer) => answer.questionId === questionId);
}

function AnswerCell({
  answer,
  status,
  reason,
}: {
  answer: AnswerRecord | undefined;
  status: string;
  reason: string | null;
}) {
  if (answer === undefined) {
    return (
      <td className="align-top px-3 py-3 text-sm text-slate-500 dark:text-slate-400">
        <span className="italic">{status === 'unavailable' ? 'Not run' : 'No answer'}</span>
        {reason !== null && <span className="mt-1 block text-xs">{reason}</span>}
      </td>
    );
  }

  return (
    <td className="align-top px-3 py-3 text-sm">
      <span
        className={`inline-block rounded-full px-2 py-0.5 text-xs font-medium ring-1 ring-inset ${VERDICT_CLASSES[answer.verdict]}`}
      >
        {VERDICT_LABELS[answer.verdict]}
      </span>
      <p className="mt-1.5 whitespace-pre-wrap break-words text-slate-800 dark:text-slate-200">
        {answer.error !== null ? (
          <span className="italic text-rose-700 dark:text-rose-300">{answer.error.message}</span>
        ) : (
          (answer.answer ?? '—')
        )}
      </p>
    </td>
  );
}

/**
 * Question x provider grid.
 *
 * The expected answer is shown alongside each question so a reader can check
 * the grading rather than take the verdict on trust. Nothing is collapsed or
 * hidden.
 */
export function ComparisonTable({ result }: { result: BenchmarkResult }) {
  return (
    <div className="overflow-x-auto rounded-xl border border-slate-200 dark:border-slate-800">
      <table className="w-full min-w-[56rem] border-collapse text-left">
        <caption className="sr-only">
          Each question, the answer expected from the page, and what each model answered
        </caption>
        <thead className="bg-slate-50 text-xs uppercase tracking-wide text-slate-600 dark:bg-slate-900 dark:text-slate-400">
          <tr>
            <th scope="col" className="w-[28%] px-3 py-2 font-medium">
              Question
            </th>
            {PROVIDER_IDS.map((id) => (
              <th key={id} scope="col" className="px-3 py-2 font-medium">
                {result.results[id]?.label ?? id}
              </th>
            ))}
          </tr>
        </thead>
        <tbody className="divide-y divide-slate-200 dark:divide-slate-800">
          {result.questions.map((question: Question) => (
            <tr key={question.id} className="align-top">
              <th scope="row" className="px-3 py-3 text-left font-normal">
                <span className="inline-block rounded bg-slate-100 px-1.5 py-0.5 text-[0.65rem] font-semibold uppercase tracking-wide text-slate-600 dark:bg-slate-800 dark:text-slate-400">
                  {question.category}
                </span>
                <p className="mt-1.5 text-sm text-slate-800 dark:text-slate-200">
                  {question.prompt}
                </p>
                <p className="mt-1.5 text-xs text-slate-600 dark:text-slate-400">
                  {question.expectedAnswer === null ? (
                    <em>The page does not support this question, so it is not graded.</em>
                  ) : (
                    <>
                      <span className="font-medium">Expected: </span>
                      {question.expectedAnswer}
                    </>
                  )}
                </p>
              </th>

              {PROVIDER_IDS.map((id) => (
                <AnswerCell
                  key={id}
                  answer={answerFor(result, id, question.id)}
                  status={result.results[id]?.status ?? 'unavailable'}
                  reason={result.results[id]?.reason ?? null}
                />
              ))}
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}
