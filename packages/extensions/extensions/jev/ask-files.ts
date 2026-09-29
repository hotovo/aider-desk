/**
 * ask-jev-files: the same question block over many files, one Jev call per file in parallel.
 * Optional second pass picks the file worth opening first. Answers per path; no file enters the
 * agent's context. Ported from github.com/disler/ten-levels-of-jev (MIT).
 */
import { LIMITS, type Answer, type Questions } from './types';
import { expandPatterns, parallel, pruneFiles, readFileState, type Skipped } from './files';
import { parseQuestions } from './ask';

export interface FileAnswers {
  path: string;
  answers: Record<string, Answer>;
  usage: { input_tokens: number; output_tokens: number; cost_usd: number | null };
}

export interface AskFilesResult {
  results: FileAnswers[];
  skipped: Skipped[];
  calls: number;
  usage: { input_tokens: number; output_tokens: number; cost_usd: number | null };
}

export type Decide = (
  state: unknown,
  questions: Questions,
  signal?: AbortSignal,
) => Promise<{ model: string; answers: Record<string, unknown>; usage: { input_tokens: number; output_tokens: number; cost_usd: number | null } }>;

export const askFiles = async (
  patterns: string[],
  questionsJson: string,
  cwd: string,
  opts: { recursive?: boolean; concurrency?: number; decide: Decide; signal?: AbortSignal },
): Promise<AskFilesResult> => {
  const questions = parseQuestions(questionsJson);
  const expanded = await expandPatterns(patterns, cwd, opts.recursive ?? false);
  const { files, skipped } = await pruneFiles(expanded, cwd);
  const results: FileAnswers[] = [];
  await parallel(files, opts.concurrency ?? 16, async (path) => {
    try {
      opts.signal?.throwIfAborted();
      const state = await readFileState(path, cwd);
      const result = await opts.decide(state, questions, opts.signal);
      results.push({
        path,
        answers: result.answers as Record<string, Answer>,
        usage: result.usage,
      });
    } catch (err) {
      skipped.push({ path, reason: `call failed: ${(err as Error)?.message ?? String(err)}` });
    }
  });
  results.sort((a, b) => a.path.localeCompare(b.path));
  const usage = results.reduce(
    (acc, r) => ({
      input_tokens: acc.input_tokens + r.usage.input_tokens,
      output_tokens: acc.output_tokens + r.usage.output_tokens,
      cost_usd: acc.cost_usd === null || r.usage.cost_usd === null ? null : acc.cost_usd + r.usage.cost_usd,
    }),
    { input_tokens: 0, output_tokens: 0, cost_usd: 0 as number | null },
  );
  return { results, skipped, calls: results.length, usage };
};

/** Keys are the paths themselves. `none` is the exit when nothing fits. */
const pickQuestion = (question: string, candidates: string[]) => {
  const criteria: Record<string, string | null> = {};
  for (const path of candidates.slice(0, LIMITS.MAX_CHOICE_OPTIONS - 1)) criteria[path] = null;
  criteria.none = 'No file in the list fits';
  return { pick: { type: 'choice' as const, instructions: question, criteria } };
};

export interface FirstPick {
  path: string | null;
  confidence: number;
}

/** A second pass over the first-pass results: one Choice keyed by path, so the pick is always a real file. */
export const pickFirstFile = async (question: string, candidates: string[], decide: Decide, floor = 0.3, signal?: AbortSignal): Promise<FirstPick> => {
  if (!candidates.length) return { path: null, confidence: 0 };
  const state = { question, files: candidates };
  const result = await decide(state, pickQuestion(question, candidates), signal);
  const a = result.answers.pick as { choice: string; confidence: number };
  const path = a.choice === 'none' || a.confidence < floor ? null : a.choice;
  return { path, confidence: a.confidence };
};
