/**
 * ask-jev orchestration: parse the agent's question block, assemble the state, call Jev once.
 * Ported from github.com/disler/ten-levels-of-jev (MIT).
 */
import { assembleState, runCommand, type Assembled } from './assemble';
import { ensureOtherExit, validateQuestions, type Answer, type Questions } from './types';

/** The agent writes Jev's question shape as JSON. Malformed blocks fail here before any state is assembled. */
export const parseQuestions = (questionsJson: string): Questions => {
  let parsed: unknown;
  try {
    parsed = JSON.parse(questionsJson) as unknown;
  } catch (err) {
    throw new Error(`questions_json is not valid JSON: ${(err as Error).message}`);
  }
  if (!parsed || typeof parsed !== 'object' || Array.isArray(parsed)) {
    throw new Error('questions_json must be an object keyed by question id');
  }
  validateQuestions(parsed);
  return ensureOtherExit(parsed as Questions);
};

export interface AskResultWithSummary {
  answers: Record<string, Answer>;
  state_summary: Assembled['summary'];
  usage: { input_tokens: number; output_tokens: number; cost_usd: number | null };
  model: string;
}

export const ask = async (
  input: { state?: string; paths?: string[]; command?: string },
  questionsJson: string,
  cwd: string,
  decide: (state: unknown, questions: Questions, signal?: AbortSignal) => Promise<{ model: string; answers: Record<string, unknown>; usage: { input_tokens: number; output_tokens: number; cost_usd: number | null } }>,
  signal?: AbortSignal,
): Promise<AskResultWithSummary> => {
  const questions = parseQuestions(questionsJson);
  const { state, summary } = await assembleState(input, cwd, runCommand);
  const result = await decide(state, questions, signal);
  return { answers: result.answers as Record<string, Answer>, state_summary: summary, usage: result.usage, model: result.model };
};
