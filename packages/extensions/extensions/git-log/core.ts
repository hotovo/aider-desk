import { spawn } from 'node:child_process';

const FIELD_SEP = '\u001e';
const RECORD_SEP = '\u001f';

const MAX_DIFF_CHARS = 200_000;

export interface GitCommit {
  hash: string;
  shortHash: string;
  authorName: string;
  authorEmail: string;
  date: string;
  isHead: boolean;
  branches: string[];
  tags: string[];
  subject: string;
  body: string;
}

export interface GitBranch {
  name: string;
  current: boolean;
  remote: boolean;
}

export type FileStatus = 'A' | 'M' | 'D' | 'R' | 'B';

export interface ChangedFile {
  path: string;
  oldPath?: string;
  status: FileStatus;
  additions: number;
  deletions: number;
}

export interface CommitDetail {
  files: ChangedFile[];
  insertions: number;
  deletions: number;
  diff: string;
  truncated: boolean;
}

export interface LogResult {
  commits: GitCommit[];
  hasMore: boolean;
}

function runGit(args: string[], cwd: string): Promise<string> {
  return new Promise((resolve, reject) => {
    const proc = spawn('git', args, { cwd, stdio: ['pipe', 'pipe', 'pipe'] });

    let stdout = '';
    let stderr = '';

    proc.stdout.on('data', (d: Buffer) => {
      stdout += d.toString();
    });
    proc.stderr.on('data', (d: Buffer) => {
      stderr += d.toString();
    });
    proc.on('error', reject);
    proc.on('close', (code) => {
      if (code === 0) {
        resolve(stdout);
      } else {
        reject(new Error(stderr.trim() || `git ${args[0]} failed (code ${code})`));
      }
    });

    proc.stdin.end();
  });
}

export const isGitRepo = (cwd: string): Promise<boolean> =>
  runGit(['rev-parse', '--is-inside-work-tree'], cwd)
    .then(() => true)
    .catch(() => false);

export async function getBranches(cwd: string): Promise<GitBranch[]> {
  const current = (await runGit(['branch', '--show-current'], cwd).catch(() => '')).trim();

  const [localsRaw, remotesRaw] = await Promise.all([
    runGit(['for-each-ref', '--format=%(refname:short)', 'refs/heads'], cwd).catch(() => ''),
    runGit(['for-each-ref', '--format=%(refname:short)', 'refs/remotes'], cwd).catch(() => ''),
  ]);

  const branches: GitBranch[] = [];
  const seen = new Set<string>();

  for (const name of localsRaw.split('\n')) {
    const trimmed = name.trim();
    if (!trimmed || seen.has(trimmed)) continue;
    seen.add(trimmed);
    branches.push({ name: trimmed, current: trimmed === current, remote: false });
  }

  for (const name of remotesRaw.split('\n')) {
    const trimmed = name.trim();
    if (!trimmed || seen.has(trimmed) || trimmed.endsWith('/HEAD')) continue;
    seen.add(trimmed);
    branches.push({ name: trimmed, current: false, remote: true });
  }

  return branches;
}

export async function getLog(cwd: string, branch: string, skip: number, limit: number): Promise<LogResult> {
  const rangeArgs = branch && branch !== 'all' ? [branch] : ['--all'];
  const format = ['%H', '%h', '%an', '%ae', '%ad', '%D', '%s', '%b'].join(FIELD_SEP) + RECORD_SEP;

  const out = await runGit(
    ['log', '--date=iso-strict', `--pretty=format:${format}`, `--skip=${skip}`, `--max-count=${limit + 1}`, ...rangeArgs],
    cwd,
  );

  const records = out
    .split(RECORD_SEP)
    .map((r) => r.replace(/^\n+/, ''))
    .filter((r) => r.length > 0);
  const hasMore = records.length > limit;
  const commitRecords = hasMore ? records.slice(0, limit) : records;

  return { commits: commitRecords.map(parseCommit), hasMore };
}

function parseCommit(record: string): GitCommit {
  const [hash = '', shortHash = '', authorName = '', authorEmail = '', date = '', refsRaw = '', subject = '', body = ''] =
    record.split(FIELD_SEP);

  const refs = (refsRaw || '')
    .split(',')
    .map((r) => r.trim())
    .filter(Boolean);

  const isHead = refs.some((r) => r.startsWith('HEAD'));
  const branches = refs.filter((r) => !r.startsWith('HEAD') && !r.startsWith('tag:') && !r.endsWith('/HEAD'));
  const tags = refs.filter((r) => r.startsWith('tag:')).map((r) => r.slice(4).trim());

  return { hash, shortHash, authorName, authorEmail, date, isHead, branches, tags, subject: subject.trim(), body: body.trim() };
}

async function getParents(cwd: string, hash: string): Promise<string[]> {
  const out = await runGit(['rev-list', '--parents', '-n', '1', hash], cwd).catch(() => '');
  const parts = out.trim().split(/\s+/).filter(Boolean);
  return parts.slice(1);
}

async function resolveDiffBase(cwd: string, hash: string): Promise<string | null> {
  const parents = await getParents(cwd, hash);
  if (parents.length === 0) return null;
  if (parents.length === 1) return parents[0];

  for (const parent of parents.slice(0, 2)) {
    const numstat = await runGit(['diff', parent, hash, '--numstat', '-z'], cwd).catch(() => '');
    if (numstat.trim()) return parent;
  }
  return parents[0];
}

export async function getCommitDetail(cwd: string, hash: string): Promise<CommitDetail> {
  const base = await resolveDiffBase(cwd, hash);

  const numstatArgs = base ? ['diff', base, hash, '--numstat', '-z'] : ['show', hash, '--format=', '--numstat', '-z'];
  const numstat = await runGit(numstatArgs, cwd).catch(() => '');
  const files = parseNumstat(numstat);

  let insertions = 0;
  let deletions = 0;
  for (const f of files) {
    if (f.additions > 0) insertions += f.additions;
    if (f.deletions > 0) deletions += f.deletions;
  }

  const patchArgs = base ? ['diff', base, hash, '--unified=3', '--no-ext-diff'] : ['show', hash, '--format=', '--patch', '--unified=3', '--no-ext-diff'];
  const diffRaw = await runGit(patchArgs, cwd).catch(() => '');
  const truncated = diffRaw.length > MAX_DIFF_CHARS;
  const diff = truncated ? diffRaw.slice(0, MAX_DIFF_CHARS) : diffRaw;

  return { files, insertions, deletions, diff, truncated };
}

export async function getFileDiff(cwd: string, hash: string, path: string): Promise<string> {
  const base = await resolveDiffBase(cwd, hash);

  const args = base
    ? ['diff', base, hash, '--unified=3', '--no-ext-diff', '--', path]
    : ['show', hash, '--format=', '--patch', '--unified=3', '--no-ext-diff', '--', path];

  const out = await runGit(args, cwd).catch(() => '');

  return out.length > MAX_DIFF_CHARS ? out.slice(0, MAX_DIFF_CHARS) : out;
}

function parseNumstat(output: string): ChangedFile[] {
  const tokens = output.split('\0');
  const files: ChangedFile[] = [];

  let i = 0;
  while (i < tokens.length) {
    const token = tokens[i];
    i += 1;
    if (!token) continue;

    const parts = token.split('\t');
    const additionsRaw = parts[0] ?? '';
    const deletionsRaw = parts[1] ?? '';
    const pathOrEmpty = parts[2] ?? '';

    const isBinary = additionsRaw === '-' && deletionsRaw === '-';
    const additions = isBinary || additionsRaw === '' ? 0 : parseInt(additionsRaw, 10);
    const deletions = isBinary || deletionsRaw === '' ? 0 : parseInt(deletionsRaw, 10);

    if (pathOrEmpty !== '') {
      const status: FileStatus = isBinary ? 'B' : additions === 0 && deletions > 0 ? 'D' : deletions === 0 && additions > 0 ? 'A' : 'M';
      files.push({ path: pathOrEmpty, status, additions, deletions });
    } else {
      const oldPath = tokens[i] ?? '';
      i += 1;
      const newPath = tokens[i] ?? '';
      i += 1;
      files.push({ path: newPath, oldPath, status: 'R', additions, deletions });
    }
  }

  return files;
}
