/**
 * ask-jev state assembly: own state, files (up to 20), and command output into one state object.
 * Over the budget, the error names the parts and a split that fits.
 * Ported from github.com/disler/ten-levels-of-jev (MIT).
 */
import { exec } from 'node:child_process';
import { LIMITS } from './types';
import { expandPatterns, FileStateError, pruneFiles, readFileState, tokensOf, type Skipped } from './files';

/** Leave room for the questions inside Jev's shared budget. */
export const STATE_TOKEN_BUDGET = LIMITS.TOTAL_TOKEN_BUDGET - 4000;
/** A single situation, not a corpus. Many files belong to ask-jev-files. */
export const MAX_FILES_PER_CALL = 20;
/** The agent's own note is for context, not for pasting content that code could fetch. */
export const MAX_OWN_STATE_CHARS = 8000;
const COMMAND_TIMEOUT_MS = 60_000;
const MAX_OUTPUT_CHARS = 200_000;

export interface CommandOutput {
  command: string;
  exit_code: number | null;
  stdout: string;
  stderr: string;
}

export type RunCommand = (command: string, cwd: string) => Promise<CommandOutput>;

export interface AssembleInput {
  state?: string;
  paths?: string[];
  command?: string;
}

export interface Assembled {
  state: Record<string, unknown>;
  summary: {
    own_fields: string[];
    files: string[];
    output: string | null;
    skipped: Skipped[];
    tokens: number;
  };
}

interface Part {
  name: string;
  tokens: number;
  kind: 'own' | 'file' | 'output';
}

export class AskStateError extends Error {
  constructor(message: string) {
    super(message);
    this.name = 'AskStateError';
  }
}

const fmtK = (t: number): string => `${(t >= 1000 ? `${(t / 1000).toFixed(1)}k` : String(t))} tokens`;

/** Greedy first fit, largest first. Returns groups whose token sums fit the budget. */
export const suggestSplit = (parts: Part[], budget: number): Part[][] => {
  const bins: { total: number; items: Part[] }[] = [];
  for (const part of [...parts].sort((a, b) => b.tokens - a.tokens)) {
    const bin = bins.find((b) => b.total + part.tokens <= budget);
    if (bin) {
      bin.items.push(part);
      bin.total += part.tokens;
    } else {
      bins.push({ total: part.tokens, items: [part] });
    }
  }
  return bins.map((b) => b.items);
};

const describeParts = (parts: Part[]): string => {
  const files = parts.filter((p) => p.kind === 'file').map((p) => p.name);
  const bits: string[] = [];
  if (parts.some((p) => p.kind === 'own')) bits.push('your state');
  if (files.length) bits.push(`paths [${files.join(', ')}]`);
  if (parts.some((p) => p.kind === 'output')) bits.push('the command');
  const total = parts.reduce((n, p) => n + p.tokens, 0);
  return `${bits.join(' + ')} (${fmtK(total)})`;
};

/** The message the agent reads when one call cannot hold the situation. */
export const overflowMessage = (parts: Part[], budget: number): string => {
  const total = parts.reduce((n, p) => n + p.tokens, 0);
  const groups = suggestSplit(parts, budget);
  const oversize = parts.filter((p) => p.tokens > budget);
  const lines = [
    `ask-jev: the state is ${fmtK(total)}, the limit per call is ${fmtK(budget)}.`,
    `Parts: ${[...parts].sort((a, b) => b.tokens - a.tokens).map((p) => `${p.name} ${fmtK(p.tokens)}`).join(', ')}.`,
  ];
  if (oversize.length) {
    lines.push(`Too large for any single call: ${oversize.map((p) => p.name).join(', ')}. Narrow it (a smaller file, a command with less output) or leave it out.`);
  }
  if (groups.length > 1 && !oversize.length) {
    lines.push(`Split into ${groups.length} calls with the same questions_json: ${groups.map((g, i) => `call ${i + 1}: ${describeParts(g)}`).join('; ')}.`);
  }
  return lines.join(' ');
};

/** Run a command for the state. The output is captured, never streamed to the agent. */
export const runCommand = (command: string, cwd: string): Promise<CommandOutput> =>
  new Promise((resolve) => {
    exec(
      command,
      {
        cwd,
        timeout: COMMAND_TIMEOUT_MS,
        maxBuffer: MAX_OUTPUT_CHARS * 4,
        env: { ...process.env, CI: '1' },
      },
      (err, stdout, stderr) => {
        const code = err && typeof (err as { code?: unknown }).code === 'number' ? (err as { code: number }).code : err ? null : 0;
        resolve({
          command,
          exit_code: code,
          stdout: String(stdout).slice(0, MAX_OUTPUT_CHARS),
          stderr: String(stderr).slice(0, MAX_OUTPUT_CHARS),
        });
      },
    );
  });

/**
 * Build the state: own state first, then files, then the command output. Nothing is truncated:
 * over the file cap or the token budget, the call is refused with a message that says how to split.
 */
export const assembleState = async (input: AssembleInput, cwd: string, run: RunCommand): Promise<Assembled> => {
  let own: unknown;
  if (input.state === undefined || input.state === '') {
    own = {};
  } else {
    try {
      own = JSON.parse(input.state) as unknown;
      if (typeof own === 'number' || typeof own === 'boolean' || own === null) own = { text: input.state };
    } catch {
      own = input.state;
    }
  }
  const base: Record<string, unknown> = typeof own === 'string' ? { text: own } : Array.isArray(own) ? { items: own } : isRecord(own) ? { ...own } : { text: input.state ?? '' };
  const ownText = JSON.stringify(base);
  if (ownText.length > MAX_OWN_STATE_CHARS) {
    throw new AskStateError(
      `ask-jev: your state is ${fmtK(tokensOf(ownText))}; the limit for your own state is 2.0k tokens. Do not paste file contents or command output; pass paths or command instead and code fetches them.`,
    );
  }
  const parts: Part[] = [];
  if (Object.keys(base).length) parts.push({ name: 'your state', tokens: tokensOf(ownText), kind: 'own' });

  const skipped: Skipped[] = [];
  const files: Record<string, string> = {};
  if (input.paths?.length) {
    const expanded = await expandPatterns(input.paths, cwd, true);
    const pruned = await pruneFiles(expanded, cwd, MAX_FILES_PER_CALL + 1);
    skipped.push(...pruned.skipped);
    if (pruned.files.length > MAX_FILES_PER_CALL) {
      throw new AskStateError(
        `ask-jev: paths expanded to more than ${MAX_FILES_PER_CALL} files. This tool judges one situation in one call. For many files use ask-jev-files, one call per file in parallel, or narrow the paths.`,
      );
    }
    for (const path of pruned.files) {
      try {
        const f = await readFileState(path, cwd);
        files[path] = f.content;
        parts.push({ name: path, tokens: tokensOf(f.content), kind: 'file' });
      } catch (err) {
        const reason = err instanceof FileStateError ? err.message : String((err as Error)?.message ?? err);
        skipped.push({ path, reason });
      }
    }
  }

  let output: CommandOutput | null = null;
  if (input.command?.trim()) {
    output = await run(input.command.trim(), cwd);
    parts.push({ name: `output of \`${output.command}\``, tokens: tokensOf(output.stdout + output.stderr), kind: 'output' });
  }

  if (!parts.length) throw new AskStateError('ask-jev: nothing to judge. Pass state, paths, or command.');

  const total = parts.reduce((n, p) => n + p.tokens, 0);
  if (total > STATE_TOKEN_BUDGET) throw new AskStateError(overflowMessage(parts, STATE_TOKEN_BUDGET));

  const state: Record<string, unknown> = { ...base };
  if (Object.keys(files).length) state.files = files;
  if (output) state.output = output;

  return {
    state,
    summary: {
      own_fields: Object.keys(base),
      files: Object.keys(files),
      output: output ? `${output.command}, exit ${output.exit_code}, ${fmtK(tokensOf(output.stdout + output.stderr))}` : null,
      skipped,
      tokens: total,
    },
  };
};

function isRecord(value: unknown): value is Record<string, unknown> {
  return value !== null && typeof value === 'object' && !Array.isArray(value);
}
