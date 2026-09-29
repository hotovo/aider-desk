/**
 * File helpers: read a file as Jev state, expand globs and prune lists.
 * Nothing here calls Jev. Ported from github.com/disler/ten-levels-of-jev (MIT).
 */
import { readFile, glob, stat } from 'node:fs/promises';
import { isAbsolute, relative, resolve, sep } from 'node:path';
import { LIMITS, type State } from './types';

/** Roughly four characters per token. The budget is shared with the questions, so leave room. */
export const MAX_FILE_CHARS = (LIMITS.TOTAL_TOKEN_BUDGET - 4000) * 4;
/** Roughly four characters per token. */
export const tokensOf = (text: string): number => Math.ceil(text.length / 4);

export interface FileState {
  path: string;
  content: string;
}

export class FileStateError extends Error {
  readonly path: string;
  constructor(message: string, path: string) {
    super(message);
    this.name = 'FileStateError';
    this.path = path;
  }
}

const looksBinary = (buf: Buffer): boolean => buf.subarray(0, 8192).includes(0);

/** Read one file as state. Errors name the path and the reason, so a tool can report them per file. */
export const readFileState = async (path: string, cwd: string): Promise<FileState> => {
  const full = isAbsolute(path) ? path : resolve(cwd, path);
  let info;
  try {
    info = await stat(full);
  } catch {
    throw new FileStateError(`not found: ${path}`, path);
  }
  if (!info.isFile()) throw new FileStateError(`not a file: ${path}`, path);
  if (info.size > MAX_FILE_CHARS) {
    throw new FileStateError(`too large for one Jev call: ${path} is ${info.size} bytes, the limit is ${MAX_FILE_CHARS}`, path);
  }
  const buf = await readFile(full);
  if (looksBinary(buf)) throw new FileStateError(`binary: ${path}`, path);
  return { path, content: buf.toString('utf8') };
};

export const SKIP_DIRS = new Set(['node_modules', '.git', '.aider-desk', '.sessions', 'dist', 'build', 'coverage', 'out']);
const GLOB_CHARS = /[*?[\]{}]/;

export interface Skipped {
  path: string;
  reason: string;
}

/** Patterns are globs, files, or directories. A directory means its files, or everything below it when recursive. */
export const expandPatterns = async (patterns: string[], cwd: string, recursive: boolean): Promise<string[]> => {
  const out = new Set<string>();
  for (const raw of patterns) {
    const pattern = raw.trim();
    if (!pattern) continue;
    if (GLOB_CHARS.test(pattern)) {
      for await (const p of glob(pattern, { cwd })) out.add(String(p));
      continue;
    }
    const full = isAbsolute(pattern) ? pattern : resolve(cwd, pattern);
    let info;
    try {
      info = await stat(full);
    } catch {
      out.add(pattern); // let prune report it
      continue;
    }
    if (info.isFile()) {
      out.add(pattern);
      continue;
    }
    for await (const p of glob(recursive ? `${pattern.replace(/\/+$/, '')}/**/*` : `${pattern.replace(/\/+$/, '')}/*`, { cwd })) out.add(String(p));
  }
  return [...out].sort();
};

/** What survives, and why each dropped file dropped. */
export const pruneFiles = async (paths: string[], cwd: string, cap: number = LIMITS.MAX_CHOICE_OPTIONS): Promise<{ files: string[]; skipped: Skipped[] }> => {
  const files: string[] = [];
  const skipped: Skipped[] = [];
  for (const path of paths) {
    const full = isAbsolute(path) ? path : resolve(cwd, path);
    const rel = relative(cwd, full);
    if (rel.startsWith('..') || isAbsolute(path)) {
      if (rel.startsWith('..')) skipped.push({ path, reason: 'outside the project' });
      continue;
    }
    if (rel.split(sep).some((part) => SKIP_DIRS.has(part))) {
      skipped.push({ path, reason: 'in skipped directory' });
      continue;
    }
    let info;
    try {
      info = await stat(full);
    } catch {
      skipped.push({ path, reason: 'not found' });
      continue;
    }
    if (!info.isFile()) continue;
    if (info.size === 0) {
      skipped.push({ path, reason: 'empty' });
      continue;
    }
    if (info.size > MAX_FILE_CHARS) {
      skipped.push({ path, reason: `too large, ${info.size} bytes` });
      continue;
    }
    if (/\.(png|jpe?g|gif|webp|ico|svg|pdf|zip|gz|tgz|woff2?|ttf|mp[34]|mov|lock|bin)$/i.test(path)) {
      skipped.push({ path, reason: 'binary or lock file' });
      continue;
    }
    if (files.length >= cap) {
      skipped.push({ path, reason: `over the ${cap} file cap; narrow the pattern` });
      continue;
    }
    files.push(path);
  }
  return { files, skipped };
};

/** Run `fn` over `items` with at most `limit` in flight. Results keep the input order. */
export const parallel = async <T, R>(items: T[], limit: number, fn: (item: T) => Promise<R>): Promise<R[]> => {
  const out: R[] = new Array(items.length);
  let next = 0;
  const worker = async () => {
    while (next < items.length) {
      const i = next++;
      out[i] = await fn(items[i]);
    }
  };
  await Promise.all(Array.from({ length: Math.min(limit, items.length) }, () => worker()));
  return out;
};
