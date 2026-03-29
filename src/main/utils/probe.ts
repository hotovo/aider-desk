import { PROBE_BINARY_PATH } from '@/constants';
import { execWithShellPath } from '@/utils/shell';

interface ProbeSearchOptions {
  query: string;
  path?: string;
  json?: boolean;
  filesOnly?: boolean;
  ignore?: string;
  excludeFilenames?: string;
  reranker?: string;
  frequencySearch?: boolean;
  exact?: boolean;
  strictElasticSyntax?: boolean;
  maxResults?: number;
  maxBytes?: number;
  maxTokens?: number;
  allowTests?: boolean;
  noMerge?: boolean;
  mergeThreshold?: number;
  session?: string;
  timeout?: number;
  language?: string;
  format?: string;
}

const FLAG_MAP: Record<string, string> = {
  filesOnly: '--files-only',
  ignore: '--ignore',
  excludeFilenames: '--exclude-filenames',
  reranker: '--reranker',
  frequencySearch: '--frequency',
  exact: '--exact',
  strictElasticSyntax: '--strict-elastic-syntax',
  maxResults: '--max-results',
  maxBytes: '--max-bytes',
  maxTokens: '--max-tokens',
  allowTests: '--allow-tests',
  noMerge: '--no-merge',
  mergeThreshold: '--merge-threshold',
  session: '--session',
  timeout: '--timeout',
  language: '--language',
  format: '--format',
};

export const search = async (options: ProbeSearchOptions): Promise<string | unknown> => {
  const args: string[] = [];

  const opts = options as unknown as Record<string, unknown>;
  for (const [key, flag] of Object.entries(FLAG_MAP)) {
    const value = opts[key];
    if (value === undefined || value === false) {
      continue;
    }

    if (typeof value === 'boolean') {
      args.push(flag);
    } else {
      args.push(`${flag} ${String(value)}`);
    }
  }

  args.push(`"${options.query}"`);

  if (options.path) {
    args.push(`"${options.path}"`);
  }

  const command = `"${PROBE_BINARY_PATH}" ${args.join(' ')}`;

  const { stdout } = await execWithShellPath(command);

  if (options.json) {
    return JSON.parse(stdout);
  }

  return stdout;
};
