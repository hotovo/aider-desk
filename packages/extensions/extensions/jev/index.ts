/**
 * Jev Extension for AiderDesk
 *
 * Brings Jev — TypeSafe's decision model — to AiderDesk agents as two tools:
 * - ask-jev: ask typed questions (noul / choice / score) about one situation: state, files, a command's
 *   output, or any mix. The agent receives typed answers, never the content.
 * - ask-jev-files: the same question block over many files, one call per file in parallel, with an
 *   optional second pass that picks the file worth opening first.
 *
 * Providers: typesafe (native SystemOne endpoint), openrouter (alpha/decisions), requesty (chat
 * completions with response_format questions), and a mock backend for offline use.
 * API keys resolve as: extension config override > provider profile key (via settings) > env var.
 *
 * Source: https://github.com/disler/ten-levels-of-jev (MIT)
 */

import { existsSync, readFileSync, writeFileSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';

import { z } from 'zod';

import type { CommandDefinition, Extension, ExtensionContext, ToolDefinition, UIComponentDefinition } from '@aiderdesk/extensions';

import { ask, parseQuestions } from './ask';
import { askFiles, pickFirstFile, type Decide } from './ask-files';
import { JevClient } from './client';
import type { JevProvider as WireProvider, State } from './types';

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);

const configComponentJsx = readFileSync(join(__dirname, './ConfigComponent.jsx'), 'utf-8');

enum JevProvider {
  Typesafe = 'typesafe',
  Openrouter = 'openrouter',
  Requesty = 'requesty',
  Mock = 'mock',
}

interface JevConfig {
  provider: JevProvider;
  apiKey?: string;
  model?: string;
  commandGate: boolean;
  concurrency: number;
}

const DEFAULT_CONFIG: JevConfig = {
  provider: JevProvider.Typesafe,
  commandGate: true,
  concurrency: 16,
};

const isRecord = (value: unknown): value is Record<string, unknown> => value !== null && typeof value === 'object' && !Array.isArray(value);

/** Key fallback chain: extension config (checked by caller) > provider profile key > settings key > env var. */
const resolveApiKey = async (context: ExtensionContext, provider: JevProvider): Promise<string | undefined> => {
  if (provider === JevProvider.Mock) return undefined;

  const providerName = provider === JevProvider.Openrouter ? 'openrouter' : provider === JevProvider.Requesty ? 'requesty' : '';
  if (providerName) {
    const profile = context.getProviders().find((p) => {
      const p2 = p.provider as unknown as { name?: string; apiKey?: string };
      return p2?.name === providerName && p2.apiKey?.trim();
    });
    if (profile) return (profile.provider as unknown as { apiKey?: string }).apiKey?.trim();

    try {
      const settingsKey = (await context.getSetting(`llmProviders.${providerName}.apiKey`)) as unknown;
      if (typeof settingsKey === 'string' && settingsKey.trim()) return settingsKey;
    } catch {
      // settings store unavailable — fall through to env
    }
  }

  const envName = provider === JevProvider.Typesafe ? 'TYPESAFE_API_KEY' : provider === JevProvider.Openrouter ? 'OPENROUTER_API_KEY' : 'REQUESTY_API_KEY';
  return process.env[envName]?.trim() || undefined;
};

const askJevInputSchema = z.object({
  questions_json: z
    .string()
    .describe(
      'The question block, a JSON object keyed by question id. Three types: noul {"type":"noul","instructions":"Is `output` a real failure rather than a flaky one?","criteria":{"true":"...","false":"..."}} -> { noul: 0..1 }; choice {"type":"choice","instructions":"What kind of failure is `output`?","criteria":{"bug_in_code":"...","wrong_test":"...","environment":"...","other":"..."}} -> { choice, confidence, probabilities }; score {"type":"score","instructions":"How risky is `diff`?","criteria":["Isolated, tested","Some callers","Security sensitive, no tests"]} -> { score, confidence, legend }.',
    ),
  state: z.string().optional().describe('Your own state: plain text, or a JSON object as a string. Short — not for pasting files or output.'),
  paths: z.array(z.string()).optional().describe('Files or globs for code to read into files["path"]. Up to 20 files.'),
  command: z.string().optional().describe('A command for code to run in the project; its result goes into output {command, exit_code, stdout, stderr}.'),
});
type AskJevInput = z.infer<typeof askJevInputSchema>;

const askJevFilesInputSchema = z.object({
  questions_json: z.string().describe('The question block, a JSON object keyed by question id (same three question types as ask-jev).'),
  paths: z.array(z.string()).min(1).describe('Files, globs, or directories. A directory means its files; everything below it only with recursive=true.'),
  recursive: z.boolean().optional().describe('Recurse into subdirectories when a path is a directory. Default: false.'),
  pick_first: z.union([z.string(), z.boolean()]).optional().describe('Second pass: pick the file worth opening first. true uses pick_first_question; a string is the instruction itself.'),
  pick_first_question: z.string().optional().describe('Instruction for the pick-first pass when pick_first is true. Default: "Which file should be opened first?"'),
});
type AskJevFilesInput = z.infer<typeof askJevFilesInputSchema>;

/** Compact one-line answer summaries for the results list. */
const summarizeAnswers = (answers: Record<string, unknown>): string =>
  Object.entries(answers)
    .map(([id, a]) => {
      if (!isRecord(a)) return `${id}: ?`;
      if (a.type === 'choice') {
        const c = a as { choice: string; confidence: number };
        return `${id}: ${c.choice} (conf ${c.confidence.toFixed(2)})`;
      }
      if (a.type === 'score') {
        const s = a as { score: number; confidence: number };
        return `${id}: ${s.score.toFixed(2)} (conf ${s.confidence.toFixed(2)})`;
      }
      return `${id}: ${(a as { noul: number }).noul.toFixed(2)}`;
    })
    .join(', ');

export default class JevExtension implements Extension {
  static metadata = {
    name: 'Jev',
    version: '1.0.0',
    description: 'Jev decision-model tools: typed yes/no, choice, and score questions about files, command output, or free-form state',
    iconUrl: 'https://raw.githubusercontent.com/hotovo/aider-desk/refs/heads/main/packages/extensions/extensions/jev/icon.png',
    author: 'wladimiiir',
    capabilities: ['tools', 'ui-elements'],
  };

  private configPath = join(__dirname, 'config.json');

  private getConfigDataSync(): JevConfig {
    try {
      if (existsSync(this.configPath)) {
        const parsed = JSON.parse(readFileSync(this.configPath, 'utf-8')) as Partial<JevConfig>;
        return { ...DEFAULT_CONFIG, ...parsed, provider: (parsed.provider as JevProvider) ?? DEFAULT_CONFIG.provider };
      }
    } catch {
      // fall back to defaults
    }
    return { ...DEFAULT_CONFIG };
  }

  private async createClient(context: ExtensionContext): Promise<JevClient> {
    const config = this.getConfigDataSync();
    const apiKey = config.apiKey?.trim() || (await resolveApiKey(context, config.provider));
    return new JevClient({
      provider: config.provider as WireProvider,
      apiKey,
      model: config.model,
    });
  }

  /** Gate a command through Jev: what does it do to the machine, and does it mean to destroy something? */
  private static bashQuestions = {
    effect: {
      type: 'choice' as const,
      instructions: 'What does running `command` in `cwd` do to the machine?',
      criteria: {
        read_only: 'Lists, reads, searches, tests, builds into a scratch directory; nothing durable changes',
        reversible: 'Changes files or state that git or a reinstall can restore: edits, installs, generated output',
        irreversible: 'Deletes or overwrites things with no way back: removing directories, force pushing, dropping data, rewriting history',
      },
    },
    destructive_intent: {
      type: 'noul' as const,
      instructions: 'Does `command` aim to remove or wipe something rather than build or inspect?',
      criteria: {
        true: 'rm -rf, drop, purge, force, reset --hard, truncate, overwriting real data',
        false: 'Reading, listing, testing, installing, generating, or editing in place',
      },
    },
  };

  private static bashThresholds = { irreversible: 0.6, destructive: 0.7 };

  private static async gateCommand(command: string, cwd: string, client: JevClient): Promise<{ block: boolean; reason: string }> {
    const result = await client.systemOne({ command, cwd }, JevExtension.bashQuestions);
    const effect = result.answers.effect as { choice: string; confidence: number };
    const destructive = result.answers.destructive_intent as { noul: number };
    if (effect.choice === 'irreversible' && effect.confidence >= JevExtension.bashThresholds.irreversible) {
      return { block: true, reason: `irreversible (${effect.confidence.toFixed(2)}): nothing would restore what this removes or overwrites` };
    }
    if (destructive.noul >= JevExtension.bashThresholds.destructive) {
      return { block: true, reason: `destructive intent (${destructive.noul.toFixed(2)}): this command aims to wipe something` };
    }
    return { block: false, reason: `${effect.choice} (${effect.confidence.toFixed(2)}), destructive ${destructive.noul.toFixed(2)}` };
  }

  private async buildDecide(context: ExtensionContext): Promise<{ decide: Decide; client: JevClient }> {
    const client = await this.createClient(context);
    const decide: Decide = async (state, questions, signal) => {
      const result = await client.systemOne(state as State, questions, { signal });
      return { model: result.model, answers: result.answers, usage: result.usage };
    };
    return { decide, client };
  }

  getUIComponents(): UIComponentDefinition[] {
    const jsx = readFileSync(join(__dirname, './JevToolCallMessage.jsx'), 'utf-8');
    return (['ask-jev', 'ask-jev-files'] as const).map((toolName) => ({
      id: `jev-tool-call-message-${toolName}`,
      placement: 'task-message',
      jsx,
      messageFilter: {
        types: ['tool'],
        serverName: 'extensions',
        toolName,
      },
    }));
  }

  getConfigComponent(_context: ExtensionContext): string {
    return configComponentJsx;
  }

  async getConfigData(_context: ExtensionContext): Promise<JevConfig> {
    return this.getConfigDataSync();
  }

  async saveConfigData(configData: unknown, context: ExtensionContext): Promise<unknown> {
    const merged: JevConfig = { ...DEFAULT_CONFIG, ...(configData as Partial<JevConfig>) };
    writeFileSync(this.configPath, JSON.stringify(merged, null, 2), 'utf-8');
    context.log('[jev] configuration saved', 'info');
    return merged;
  }

  getTools(_context: ExtensionContext): ToolDefinition[] {
    return [
      {
        name: 'ask-jev',
        description: [
          'Ask Jev, a fast decision model, typed questions about one situation: files, a command output, your own state, or any mix. It answers in about 300 ms for a fraction of a cent, and each answer is a number you can branch on, not prose. Use it whenever a judgment call would otherwise cost you a long think.',
          '',
          'Do not paste content you already have; that costs output tokens. Pass paths and code reads the files into files["path"]. Pass command and code runs it in the project and puts the result into output {command, exit_code, stdout, stderr}. Use state for what only you can say: a customer report, your plan, a line of context. Plain text or a JSON object as a string; your field names are kept as is. You can combine all three, and you never receive the files or the output, only the answers.',
          '',
          'One call judges one situation: up to 20 files and about 60k tokens in total. Over that the call is refused with a message naming the parts and a split that fits; make two calls with the same questions_json. For many files judged separately use ask-jev-files instead. Commands are checked by a quick Jev classification first and refused when they look irreversible or destructive; keep commands read-oriented.',
          '',
          'Write questions against files["path"], output, or your own field names. Good uses: run the tests through command and classify the failure before choosing a fix, put git diff through command and score its risk before committing, pass the customer words as state with the relevant paths and decide bug or expected, decide whether a request is clear enough to plan.',
          'Ask every question you might need in one call; they share the state. Always give a choice an `other` option. Describe situations, not degrees.',
          'Not for: exact lookups, counting, math, or anything a grep answers. Not a substitute for reading code you need to edit.',
        ].join('\n'),
        inputSchema: askJevInputSchema,
        execute: async (input, signal, context) => {
          const cwd = context.getProjectDir();
          const parsed = askJevInputSchema.parse(input);
          const { decide, client } = await this.buildDecide(context);

          if (parsed.command?.trim() && this.getConfigDataSync().commandGate) {
            const config = this.getConfigDataSync();
            void config;
            const gate = await JevExtension.gateCommand(parsed.command.trim(), cwd, client);
            if (gate.block) {
              throw new Error(
                `ask-jev: the command was refused by the bash gate: ${gate.reason}. The block is final — do not try to work around it with another command, another tool, a different path, or an encoding that does the same thing. Stop and tell the user what was blocked and why. ask-jev commands should only read.`,
              );
            }
          }

          const result = await ask({ state: parsed.state, paths: parsed.paths, command: parsed.command }, parsed.questions_json, cwd, decide, signal);
          return {
            answers: result.answers,
            state_summary: {
              ...result.state_summary,
              skipped: result.state_summary.skipped.map((s) => `${s.path}: ${s.reason}`),
            },
            usage: result.usage,
            model: result.model,
          };
        },
      },
      {
        name: 'ask-jev-files',
        description: [
          'Ask the same Jev questions about many files at once, one call per file, all in parallel. You get typed answers per path and never the files themselves. Use it to scout: which of these 40 files matter, which tests target what, which file holds the bug.',
          '',
          'Pass paths, globs, or directories (expanded and pruned in code: node_modules, dist, binaries, and oversized files drop out with a reason; 255-file cap). The question block is raw JSON, same shape as ask-jev. Optionally a second pass picks the file worth opening first — the pick is always a real file from the list, or null.',
          '',
          'Good uses: several named files plus several questions each, a glob over a directory, or a recursive scout of the project followed by opening only the file that matters.',
        ].join('\n'),
        inputSchema: askJevFilesInputSchema,
        execute: async (input, signal, context) => {
          const cwd = context.getProjectDir();
          const parsed = askJevFilesInputSchema.parse(input);
          const { decide } = await this.buildDecide(context);
          const config = this.getConfigDataSync();
          const result = await askFiles(parsed.paths, parsed.questions_json, cwd, {
            recursive: parsed.recursive,
            concurrency: config.concurrency,
            decide,
            signal,
          });
          let firstPick: { path: string | null; confidence: number } | null = null;
          if (parsed.pick_first) {
            const instruction = typeof parsed.pick_first === 'string' ? parsed.pick_first : (parsed.pick_first_question ?? 'Which file should be opened first?');
            firstPick = await pickFirstFile(instruction, result.results.map((r) => r.path), decide, 0.3, signal);
          }
          return {
            results: result.results.map((r) => ({ path: r.path, answers: r.answers, summary: summarizeAnswers(r.answers) })),
            skipped: result.skipped,
            calls: result.calls,
            usage: result.usage,
            first_pick: firstPick,
          };
        },
      },
    ];
  }

  getCommands(_context: ExtensionContext): CommandDefinition[] {
    return [
      {
        name: 'jev-test',
        description: 'Verify the Jev configuration with a live request; prints the resolved provider, model, and answer',
        arguments: [],
        execute: async (_args, context) => {
          const taskContext = context.getTaskContext();
          try {
            const config = this.getConfigDataSync();
            const client = await this.createClient(context);
            const result = await client.systemOne(
              'This is a Jev test message sent from the AiderDesk /jev-test command.',
              { test: { type: 'noul', instructions: 'Is this a test message?' } },
            );
            const noul = (result.answers.test as { noul: number }).noul;
            const message = `Jev test OK — provider ${config.provider}, model ${result.meta.resolvedModel} (${result.meta.elapsedMs} ms, ${result.usage.input_tokens}+${result.usage.output_tokens} tokens), answer: ${(noul > 0.5).toString()} (${noul})`;
            taskContext?.addLogMessage('info', message);
          } catch (err) {
            taskContext?.addLogMessage('error', `Jev test failed: ${(err as Error).message}`);
          }
        },
      },
    ];
  }
}
