import { mkdtemp, mkdir, rm, writeFile } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';

import { afterEach, describe, expect, it } from 'vitest';

import { ask, parseQuestions, AskStateError } from '../ask';
import { assembleState, type CommandOutput } from '../assemble';
import { pickFirstFile } from '../ask-files';
import { JevClient } from '../client';
import { MockJev } from '../mock';
import { NoulQuestion, ScoreQuestion, ChoiceQuestion } from '../types';

const temporaryDirectories: string[] = [];

const createTemporaryDirectory = async (): Promise<string> => {
  const directory = await mkdtemp(join(tmpdir(), 'aiderdesk-jev-'));
  temporaryDirectories.push(directory);
  return directory;
};

afterEach(async () => {
  await Promise.all(temporaryDirectories.splice(0).map((directory) => rm(directory, { recursive: true, force: true })));
});

describe('Jev extension — assembleState', () => {
  it('parses own state: plain text is wrapped, JSON objects pass through, arrays get items', async () => {
    const commandOutput: CommandOutput = { command: '', exit_code: 0, stdout: '', stderr: '' };
    const run = async (): Promise<CommandOutput> => commandOutput;
    const directory = await createTemporaryDirectory();

    const fromText = await assembleState({ state: 'plain note' }, directory, run);
    expect(Object.keys(fromText.state)).toEqual(['text']);

    const fromJson = await assembleState({ state: '{"customer":"report"}' }, directory, run);
    expect(fromJson.state).toEqual({ customer: 'report' });

    const fromArray = await assembleState({ state: '[1,2]' }, directory, run);
    expect(fromArray.state).toEqual({ items: [1, 2] });
  });

  it('files land in files[path] with raw content', async () => {
    const directory = await createTemporaryDirectory();
    await writeFile(join(directory, 'a.ts'), 'export const a = 1;');
    const commandOutput: CommandOutput = { command: '', exit_code: 0, stdout: '', stderr: '' };
    const result = await assembleState({ paths: ['a.ts'] }, directory, async () => commandOutput);
    expect(result.state.files).toEqual({ 'a.ts': 'export const a = 1;' });
    expect(result.summary.own_fields).toEqual([]);
  });

  it('command output goes into output with exit_code, stdout, stderr', async () => {
    const directory = await createTemporaryDirectory();
    const result = await assembleState({ command: 'echo hi' }, directory, async () => ({
      command: 'echo hi',
      exit_code: 0,
      stdout: 'hi',
      stderr: '',
    }));
    expect(result.state.output).toEqual({ command: 'echo hi', exit_code: 0, stdout: 'hi', stderr: '' });
  });

  it('nothing to judge raises', async () => {
    const directory = await createTemporaryDirectory();
    const run = async (): Promise<CommandOutput> => ({ command: '', exit_code: 0, stdout: '', stderr: '' });
    await expect(assembleState({}, directory, run)).rejects.toThrow(AskStateError);
  });

  it('own state over its cap raises with guidance', async () => {
    const directory = await createTemporaryDirectory();
    const run = async (): Promise<CommandOutput> => ({ command: '', exit_code: 0, stdout: '', stderr: '' });
    await expect(assembleState({ state: 'x'.repeat(9000) }, directory, run)).rejects.toThrow(AskStateError);
  });
});

describe('Jev extension — MockJev', () => {
  const mock = new MockJev();

  it('answers a noul question with a number', () => {
    const response = mock.systemOne({
      state: 'this message is urgent hot immediate',
      questions: { urgency: { type: 'noul', instructions: 'Is this urgent?' } },
    });
    const answer = response.answers.urgency as { type: string; noul: number };
    expect(answer.type).toBe('noul');
    expect(answer.noul).toBeGreaterThanOrEqual(0);
    expect(answer.noul).toBeLessThanOrEqual(1);
  });

  it('answers a choice question within declared options', () => {
    const response = mock.systemOne({
      state: 'a bug in the code',
      questions: {
        kind: {
          type: 'choice',
          instructions: 'What is this?',
          criteria: { bug: 'A bug', environment: 'An environment problem', other: null },
        },
      },
    });
    const answer = response.answers.kind as { type: string; choice: string; confidence: number };
    expect(['bug', 'environment', 'other']).toContain(answer.choice);
    expect(answer.confidence).toBeGreaterThanOrEqual(0);
  });
});

describe('Jev extension — JevClient (mock provider)', () => {
  it('routes to the mock without credentials and returns usage with zero cost', async () => {
    const client = new JevClient({ provider: 'mock', apiKey: undefined });
    const result = await client.systemOne('The tests are failing', { broken: { type: 'noul', instructions: 'Is this broken?' } as NoulQuestion });
    expect(result.meta.provider).toBe('mock');
    expect(result.usage.cost_usd).toBe(0);
    expect(Object.keys(result.answers)).toEqual(['broken']);
  });

  it('uses defaults and reports usage', async () => {
    const client = new JevClient({ provider: 'mock' });
    const result = await client.systemOne(
      { diff: '+coming straight' },
      { risk: { type: 'score', instructions: 'How risky is the diff?', criteria: ['Isolated, tested', 'Some callers', 'Security sensitive, no tests'] } as ScoreQuestion },
    );
    expect(result.meta.provider).toBe('mock');
  });
});

describe('Jev extension — pickFirstFile', () => {
  it('returns null when the winning pick is below the threshold', async () => {
    const decide = async () => ({
      model: 'mock',
      answers: {
        pick: { type: 'choice', choice: 'src/domain/billing.ts', probabilities: { 'src/domain/billing.ts': 0.2, other: 0.8 }, confidence: 0.1 } as unknown,
      },
      usage: { input_tokens: 0, output_tokens: 0, cost_usd: null },
    });
    await expect(pickFirstFile('Which file first?', ['src/domain/billing.ts'], decide, 0.3)).resolves.toEqual({ path: null, confidence: 0.1 });
  });
});

describe('Jev extension — parseQuestions', () => {
  it('accepts a valid question block', () => {
    const questions = parseQuestions(
      '{"risk":{"type":"choice","instructions":"pick one","criteria":{"a":"A","b":"B","other":"anything else"},"other_option":false}}',
    );
    expect(Object.keys(questions)).toEqual(['risk']);
  });

  it('rejects a choice with no options', () => {
    expect(() => parseQuestions('{"x":{"type":"choice","instructions":"pick one","criteria":{}}}')).toThrow(/no options/);
  });
});

describe('Jev extension — question types', () => {
  it('noul criteria is optional and passes through untouched', () => {
    const q = { type: 'noul', instructions: 'Is this clear?' } as NoulQuestion;
    const rendered = JSON.parse(JSON.stringify(q)) as { criteria?: Record<string, unknown> };
    expect(rendered.criteria).toBeUndefined();
  });

  it('choice criteria must map options to descriptions', () => {
    const q = { type: 'choice', instructions: 'pick', criteria: { a: 'A', b: 'B', other: null }, other_option: true } as ChoiceQuestion;
    expect(Object.keys(q.criteria)).toEqual(['a', 'b', 'other']);
  });

  it('score criteria render low-to-high labels', () => {
    const q = { type: 'score', instructions: 'grade it', criteria: ['low', 'high'] } as ScoreQuestion;
    expect(q.criteria).toHaveLength(2);
  });
});
