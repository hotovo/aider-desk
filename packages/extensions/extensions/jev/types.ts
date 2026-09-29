/**
 * Jev (TypeSafe System One) wire contract — ported from github.com/disler/ten-levels-of-jev (MIT).
 * One endpoint: POST https://api.typesafe.ai/v1/systemone (or OpenRouter as fallback provider).
 * You send a `state` and a map of typed `questions`; you get back one typed `answer` per question.
 */

export type JevProvider = 'typesafe' | 'openrouter' | 'requesty' | 'mock';

export type State = string | Record<string, unknown> | unknown[];

export type Instructions = string | Record<string, unknown>;

export interface NoulCriteria {
  true?: string;
  false?: string;
}

/** Map of option -> rubric description. Use null when an option needs no detail. Max 255 options. */
export type ChoiceCriteria = Record<string, string | null>;

/** Ordered array of level descriptions, low to high. 2-10 levels. */
export type ScoreCriteria = string[];

export interface NoulQuestion {
  type: 'noul';
  instructions: Instructions;
  criteria?: NoulCriteria;
}

export interface ChoiceQuestion {
  type: 'choice';
  instructions: Instructions;
  criteria: ChoiceCriteria;
}

export interface ScoreQuestion {
  type: 'score';
  instructions: Instructions;
  criteria: ScoreCriteria;
}

export type Question = NoulQuestion | ChoiceQuestion | ScoreQuestion;

/** Question IDs are for your code. They are not sent to the model and are not used in inference. */
export type Questions = Record<string, Question>;

export interface NoulAnswer {
  type: 'noul';
  /** The probability the answer is yes. 0 = strong no, 1 = strong yes, 0.5 = uncertain. */
  noul: number;
}

export interface ChoiceAnswer {
  type: 'choice';
  /** The highest-probability option. Always one you defined. */
  choice: string;
  /** Every option mapped to its probability. Floats that sum to 1. */
  probabilities: Record<string, number>;
  /** How certain the model is, derived from the shape of the distribution. */
  confidence: number;
}

export interface ScoreAnswer {
  type: 'score';
  /** Probability-weighted position along the levels. Can land between levels. */
  score: number;
  /** Each level number mapped back to its description. */
  legend: Record<string, string>;
  /** Each level mapped to its probability. Floats that sum to 1. */
  probabilities: Record<string, number>;
  confidence: number;
}

export type Answer = NoulAnswer | ChoiceAnswer | ScoreAnswer;

export interface SystemOneRequest {
  /** Defaults to 'jev-latest'. */
  model?: string;
  state: State;
  questions: Questions;
}

export interface SystemOneUsage {
  input_tokens: number;
  output_tokens: number;
  /** Provider-reported USD cost. Only finite, nonnegative numbers are trusted. */
  cost?: unknown;
  [key: string]: unknown;
}

export interface SystemOneResponse {
  /** The versioned model that answered. Log it. */
  model: string;
  answers: Record<string, Answer>;
  usage: SystemOneUsage;
  /** Provider extensions are retained, not stripped. */
  [key: string]: unknown;
}

export interface Usage {
  input_tokens: number;
  output_tokens: number;
  cost_usd: number | null;
}

export interface AskResult {
  answers: Record<string, Answer>;
  usage: Usage;
  model: string;
}

export const LIMITS = {
  MAX_CHOICE_OPTIONS: 255,
  MIN_SCORE_LEVELS: 2,
  MAX_SCORE_LEVELS: 10,
  /** Approximate shared token budget for state + all questions. */
  TOTAL_TOKEN_BUDGET: 64_000,
} as const;

export class QuestionValidationError extends Error {
  constructor(message: string) {
    super(message);
    this.name = 'QuestionValidationError';
  }
}

const isRecord = (value: unknown): value is Record<string, unknown> =>
  value !== null && typeof value === 'object' && !Array.isArray(value);

export const roundAnswerValue = (value: number, places = 2): number => {
  const f = 10 ** places;
  return Math.round(value * f) / f;
};

/** Validate runtime input as well as TypeScript callers, before any transport. */
export const validateRequest = (request: unknown): void => {
  if (!isRecord(request)) throw new QuestionValidationError('Expected a request object.');
  if (typeof request.state !== 'string' && !isRecord(request.state) && !Array.isArray(request.state)) {
    throw new QuestionValidationError('State must be a string, object, or array.');
  }
  if (request.model !== undefined && (typeof request.model !== 'string' || !request.model.trim())) {
    throw new QuestionValidationError('Model must be a nonblank string.');
  }
  validateQuestions(request.questions);
};

/** Validate a request's question shapes before it is ever sent. */
export const validateQuestions = (questions: unknown): Questions => {
  if (!isRecord(questions) || Object.keys(questions).length === 0) {
    throw new QuestionValidationError('Questions must be a nonempty object.');
  }
  for (const [id, q] of Object.entries(questions)) {
    if (!isRecord(q)) throw new QuestionValidationError(`Question "${id}" must be an object.`);
    if (q.type !== 'noul' && q.type !== 'choice' && q.type !== 'score') {
      throw new QuestionValidationError(`Question "${id}" has a missing or unknown type. Use noul, choice, or score.`);
    }
    const validInstructions = typeof q.instructions === 'string' ? !!q.instructions.trim() : isRecord(q.instructions);
    if (!validInstructions) {
      throw new QuestionValidationError(`Question "${id}" needs nonblank string or object instructions.`);
    }
    if (q.type === 'noul' && q.criteria !== undefined) {
      if (
        !isRecord(q.criteria) ||
        Object.entries(q.criteria).some(([key, value]) => !['true', 'false'].includes(key) || (value !== undefined && typeof value !== 'string'))
      ) {
        throw new QuestionValidationError(`Noul "${id}" criteria must map true/false to descriptions.`);
      }
    }
    if (q.type === 'choice') {
      if (!isRecord(q.criteria)) {
        throw new QuestionValidationError(`Choice "${id}" criteria must be an object.`);
      }
      const options = Object.keys(q.criteria);
      if (options.length === 0) {
        throw new QuestionValidationError(`Choice "${id}" has no options. Every choice needs at least one; add an "other" exit.`);
      }
      if (options.length > LIMITS.MAX_CHOICE_OPTIONS) {
        throw new QuestionValidationError(`Choice "${id}" has ${options.length} options; the maximum is ${LIMITS.MAX_CHOICE_OPTIONS}.`);
      }
      if (Object.values(q.criteria).some((value) => value !== null && typeof value !== 'string')) {
        throw new QuestionValidationError(`Choice "${id}" descriptions must be strings or null.`);
      }
    }
    if (q.type === 'score') {
      if (!Array.isArray(q.criteria)) {
        throw new QuestionValidationError(`Score "${id}" criteria must be an array.`);
      }
      if (q.criteria.length < LIMITS.MIN_SCORE_LEVELS || q.criteria.length > LIMITS.MAX_SCORE_LEVELS) {
        throw new QuestionValidationError(
          `Score "${id}" must have between ${LIMITS.MIN_SCORE_LEVELS} and ${LIMITS.MAX_SCORE_LEVELS} levels; got ${q.criteria.length}.`,
        );
      }
      if (q.criteria.some((level) => typeof level !== 'string' || !level.trim())) {
        throw new QuestionValidationError(`Score "${id}" levels must be nonblank strings.`);
      }
    }
  }
  return questions as Questions;
};

/** Ensure every choice has an `other` exit; auto-append a generic one when missing. */
export const ensureOtherExit = (questions: Questions): Questions => {
  for (const q of Object.values(questions)) {
    if (q.type === 'choice' && !Object.keys(q.criteria).includes('other')) {
      q.criteria.other = 'The situation fits none of the listed options';
    }
  }
  return questions;
};

const isUnit = (x: unknown): x is number => typeof x === 'number' && Number.isFinite(x) && x >= 0 && x <= 1;
const isTokenCount = (x: unknown): x is number => typeof x === 'number' && Number.isFinite(x) && x >= 0 && Number.isSafeInteger(x);

/** Strict live contract; unknown payload fields are deliberately retained. */
export const validateResponse = (response: unknown, questions: Questions): SystemOneResponse => {
  if (!isRecord(response) || !isRecord(response.answers) || typeof response.model !== 'string' || !response.model.trim()) {
    throw new Error('Invalid response envelope: expected model and answers.');
  }
  if (!isRecord(response.usage) || !isTokenCount(response.usage.input_tokens) || !isTokenCount(response.usage.output_tokens)) {
    throw new Error('Invalid response usage: expected nonnegative integer input_tokens and output_tokens.');
  }
  for (const [id, q] of Object.entries(questions)) {
    const answer = (response.answers as Record<string, unknown>)[id];
    if (!Object.hasOwn(response.answers, id) || !isRecord(answer) || answer.type !== q.type) {
      throw new Error(`Missing or mismatched answer: ${id}`);
    }
    if (q.type === 'noul') {
      if (!isUnit(answer.noul)) throw new Error(`Invalid noul: ${id}`);
      continue;
    }
    if (!isUnit(answer.confidence) || !isRecord(answer.probabilities)) {
      throw new Error(`Invalid distribution: ${id}`);
    }
    const keys = q.type === 'choice' ? Object.keys(q.criteria) : q.criteria.map((_, i) => String(i));
    const probs = answer.probabilities as Record<string, unknown>;
    if (Object.keys(probs).length !== keys.length || !keys.every((k) => Object.hasOwn(probs, k) && isUnit(probs[k]))) {
      throw new Error(`Distribution keys must match the declared criteria: ${id}`);
    }
    const sum = keys.reduce((acc, k) => acc + (probs[k] as number), 0);
    if (Math.abs(sum - 1) > 0.025) throw new Error(`Distribution does not sum to one: ${id} (${sum})`);
    if (q.type === 'choice' && (typeof answer.choice !== 'string' || !keys.includes(answer.choice))) {
      throw new Error(`Undeclared choice returned: ${id}`);
    }
    if (q.type === 'score') {
      if (!isUnit(answer.score) && !(typeof answer.score === 'number' && answer.score >= 0 && answer.score <= keys.length - 1)) {
        throw new Error(`Score out of range: ${id}`);
      }
      const legend = answer.legend;
      if (
        !isRecord(legend) ||
        Object.keys(legend).length !== keys.length ||
        !keys.every((k, i) => Object.hasOwn(legend, k) && legend[k] === q.criteria[i])
      ) {
        throw new Error(`Score legend must match the declared criteria: ${id}`);
      }
    }
    if (answer.type === 'choice' || answer.type === 'score') {
      (answer as { confidence: number }).confidence = roundAnswerValue(answer.confidence as number);
    }
  }
  return response as SystemOneResponse;
};
