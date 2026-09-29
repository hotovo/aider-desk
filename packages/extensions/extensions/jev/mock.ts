/**
 * MockJev — deterministic, offline stand-in for the real System One endpoint.
 * Decides by token overlap between the flattened state and each option/level description
 * through a softmax — a stand-in for shape, not intelligence. Ported from github.com/disler/ten-levels-of-jev (MIT).
 */
import type { Answer, ChoiceQuestion, NoulQuestion, Question, Questions, ScoreQuestion, State, SystemOneRequest, SystemOneResponse } from './types';

const STOPWORDS = new Set([
  'the', 'a', 'an', 'and', 'or', 'but', 'if', 'then', 'than', 'of', 'to', 'in', 'on', 'at', 'for', 'with', 'without', 'is', 'are', 'was',
  'were', 'be', 'been', 'decides', 'this', 'that', 'these', 'those', 'it', 'its', 'as', 'by', 'from', 'into', 'about', 'against', 'between',
  'through', 'during', 'before', 'after', 'above', 'below', 'up', 'down', 'out', 'off', 'over', 'under', 'again', 'further', 'once', 'here',
  'there', 'when', 'where', 'why', 'how', 'all', 'any', 'both', 'each', 'few', 'more', 'most', 'other', 'some', 'such', 'no', 'nor', 'not',
  'only', 'own', 'same', 'so', 'too', 'very', 's', 't', 'can', 'will', 'just', 'don', 'should', 'now', 'd', 'll', 'm', 'o', 're', 've', 'y',
  'i', 'you', 'we', 'they', 'he', 'she', 'what', 'which', 'who', 'whom', 'am', 'has', 'have', 'had', 'having', 'message', 'text', 'given',
]);

const stem = (t: string): string => {
  if (t.length > 4 && t.endsWith('ing')) return t.slice(0, -3);
  if (t.length > 4 && t.endsWith('ed')) return t.slice(0, -2);
  if (t.length > 3 && t.endsWith('es')) return t.slice(0, -2);
  if (t.length > 3 && t.endsWith('s') && !t.endsWith('ss')) return t.slice(0, -1);
  return t;
};

const tokenize = (text: string): Set<string> =>
  new Set(
    text
      .toLowerCase()
      .replace(/[`_*#>/[\]{}()"',.;:!?\\-]/g, ' ')
      .split(/\s+/)
      .filter((t) => t.length > 1 && !STOPWORDS.has(t))
      .map(stem),
  );

/** Flatten any state shape into text the overlap engine can read. */
export const flattenState = (state: State): string => (typeof state === 'string' ? state : JSON.stringify(state, null, 2));

const instructionsText = (q: Question): string => (typeof q.instructions === 'string' ? q.instructions : JSON.stringify(q.instructions));

const softmax = (values: number[], temperature = 0.6): number[] => {
  if (values.every((v) => v === 0)) return values.map(() => 1 / values.length);
  const max = Math.max(...values);
  const exps = values.map((v) => Math.exp((v - max) / temperature));
  const sum = exps.reduce((a, b) => a + b, 0);
  return exps.map((e) => e / sum);
};

const affinity = (stateTokens: Set<string>, description: string): number => {
  const descTokens = tokenize(description);
  let shared = 0;
  for (const t of descTokens) if (stateTokens.has(t)) shared++;
  return shared;
};

const round = (n: number, places = 4): number => {
  const f = 10 ** places;
  return Math.round(n * f) / f;
};

const noulAnswer = (q: NoulQuestion, stateTokens: Set<string>): Answer => {
  const yesText = instructionsText(q) + ' ' + (q.criteria?.true ?? '');
  const noText = q.criteria?.false ?? '';
  const yes = affinity(stateTokens, yesText);
  const no = affinity(stateTokens, noText);
  const k = 2.5;
  const signal = (yes - no) / (yes + no + k);
  const p = 1 / (1 + Math.exp(-4 * signal));
  return { type: 'noul', noul: round(p) };
};

const choiceAnswer = (q: ChoiceQuestion, stateTokens: Set<string>): Answer => {
  const entries = Object.entries(q.criteria);
  const affinities = entries.map(([option, desc]) => {
    const keyText = option.replace(/_/g, ' ');
    return affinity(stateTokens, keyText) * 1.5 + affinity(stateTokens, desc ?? '') * 1.0;
  });
  const probs = softmax(affinities);
  const probabilities: Record<string, number> = {};
  entries.forEach(([option], i) => (probabilities[option] = round(probs[i])));
  let best = 0;
  entries.forEach((_, i) => {
    if (probs[i] > probs[best]) best = i;
  });
  return { type: 'choice', choice: entries[best][0], probabilities, confidence: round(probs[best]) };
};

const scoreAnswer = (q: ScoreQuestion, stateTokens: Set<string>): Answer => {
  const affinities = q.criteria.map((level) => affinity(stateTokens, level) + 1e-9);
  const probs = softmax(affinities);
  const legend: Record<string, string> = {};
  q.criteria.forEach((level, i) => (legend[String(i)] = level));
  const probabilities: Record<string, number> = {};
  q.criteria.forEach((_, i) => (probabilities[String(i)] = round(probs[i])));
  const scoreValue = probs.reduce((acc, p, i) => acc + p * i, 0);
  const confidence = Math.max(...probs);
  return { type: 'score', score: round(scoreValue, 2), legend, probabilities, confidence: round(confidence) };
};

export class MockJev {
  readonly model = 'jev-1.13.0-mock';

  systemOne(req: SystemOneRequest): SystemOneResponse {
    const stateTokens = tokenize(flattenState(req.state));
    const answers: Record<string, Answer> = {};
    for (const [id, q] of Object.entries(req.questions)) {
      if (q.type === 'noul') answers[id] = noulAnswer(q, stateTokens);
      else if (q.type === 'choice') answers[id] = choiceAnswer(q, stateTokens);
      else answers[id] = scoreAnswer(q, stateTokens);
    }
    const usage = {
      input_tokens: Math.ceil(flattenState(req.state).length / 4) + 20 * Object.keys(req.questions).length,
      output_tokens: 20 * Object.keys(req.questions).length,
    };
    return { model: this.model, answers, usage };
  }
}
