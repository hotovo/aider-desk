import { spawn } from 'child_process';
import { existsSync, statSync, readdirSync } from 'fs';
import { mkdtemp, rm } from 'fs/promises';
import { tmpdir } from 'os';
import { join } from 'path';

export const REF_BASE = 'refs/aiderdesk-checkpoints';

const DEBUG = process.env.AIDERDESK_CHECKPOINT_DEBUG === '1';

function debugLog(msg: string): void {
  if (DEBUG) console.log(`[checkpoint-debug] ${msg}`);
}

export const MAX_UNTRACKED_FILE_SIZE = 10 * 1024 * 1024;
export const MAX_UNTRACKED_DIR_FILES = 200;

export const IGNORED_DIR_NAMES = new Set([
  'node_modules',
  '.venv',
  'venv',
  'env',
  '.env',
  'dist',
  'build',
  '.pytest_cache',
  '.mypy_cache',
  '.cache',
  '.tox',
  '__pycache__',
]);

export const MUTATING_TOOLS = new Set(['power---file_edit', 'power---file_write']);

export interface CheckpointData {
  ref: string;
  toolName: string;
  filePath: string;
  timestamp: number;
  branch: string;
  headSha: string;
  indexTreeSha: string;
  worktreeTreeSha: string;
  preexistingUntrackedFiles?: string[];
}

export function git(cmd: string, cwd: string, opts: { env?: NodeJS.ProcessEnv; input?: string } = {}): Promise<string> {
  return new Promise((resolve, reject) => {
    const args = parseArgs(cmd);
    const proc = spawn('git', args, {
      cwd,
      env: opts.env,
      stdio: ['pipe', 'pipe', 'pipe'],
    });

    let stdout = '';
    let stderr = '';
    proc.stdout.on('data', (d) => (stdout += d));
    proc.stderr.on('data', (d) => (stderr += d));

    proc.on('close', (code) => {
      if (code === 0) resolve(stdout.trim());
      else reject(new Error(stderr || `git ${args[0]} failed (code ${code})`));
    });
    proc.on('error', reject);

    if (opts.input && proc.stdin) {
      proc.stdin.write(opts.input);
      proc.stdin.end();
    } else if (proc.stdin) {
      proc.stdin.end();
    }
  });
}

function parseArgs(cmd: string): string[] {
  const args: string[] = [];
  let cur = '';
  let sq = false;
  let dq = false;
  for (let i = 0; i < cmd.length; i++) {
    const c = cmd[i];
    if (c === "'" && !dq) sq = !sq;
    else if (c === '"' && !sq) dq = !dq;
    else if (c === ' ' && !sq && !dq) {
      if (cur) { args.push(cur); cur = ''; }
    } else cur += c;
  }
  if (cur) args.push(cur);
  return args;
}

export const isGitRepo = (cwd: string) =>
  git('rev-parse --is-inside-work-tree', cwd).then(() => true).catch(() => false);

export const getRepoRoot = (cwd: string) =>
  git('rev-parse --show-toplevel', cwd);

export function shouldIgnoreForSnapshot(path: string): boolean {
  return path.split(/[/\\]/).some((c) => IGNORED_DIR_NAMES.has(c));
}

function normalizeGitPath(p: string): string {
  let n = p.replace(/\\/g, '/');
  if (n.startsWith('./')) n = n.slice(2);
  return n.replace(/\/$/, '');
}

function isPathWithin(path: string, dir: string): boolean {
  if (!dir || dir === '.') return true;
  if (path === dir) return true;
  const prefix = dir.endsWith('/') ? dir : `${dir}/`;
  return path.startsWith(prefix);
}

function isPathWithinAny(path: string, dirs: Set<string>): boolean {
  return [...dirs].some((d) => isPathWithin(path, d));
}

interface StatusSnapshot {
  trackedPaths: string[];
  untrackedFiles: string[];
  untrackedFilesForIndex: string[];
  untrackedDirs: string[];
  skippedLargeFiles: string[];
}

async function captureStatusSnapshot(root: string): Promise<StatusSnapshot> {
  const snap: StatusSnapshot = {
    trackedPaths: [],
    untrackedFiles: [],
    untrackedFilesForIndex: [],
    untrackedDirs: [],
    skippedLargeFiles: [],
  };

  const output = await git('status --porcelain=2 -z --untracked-files=all', root).catch(() => '');
  if (!output) return snap;

  const entries = output.split('\0').filter(Boolean);
  let expectRename = false;

  for (const entry of entries) {
    if (expectRename) {
      const n = normalizeGitPath(entry);
      if (n) snap.trackedPaths.push(n);
      expectRename = false;
      continue;
    }

    const tag = entry[0];
    if (tag === '?' || tag === '!') {
      const sp = entry.indexOf(' ');
      if (sp === -1) continue;
      const raw = normalizeGitPath(entry.slice(sp + 1));
      if (!raw || shouldIgnoreForSnapshot(raw)) continue;

      let st: ReturnType<typeof statSync> | null = null;
      try { st = statSync(join(root, raw)); } catch { st = null; }

      if (st?.isDirectory()) { snap.untrackedDirs.push(raw); continue; }

      snap.untrackedFiles.push(raw);
      const large = st?.isFile() ? st.size > MAX_UNTRACKED_FILE_SIZE : false;
      if (large) snap.skippedLargeFiles.push(raw);
      else snap.untrackedFilesForIndex.push(raw);
    } else if (tag === '1') {
      const p = extractField(entry, 8);
      if (p) snap.trackedPaths.push(normalizeGitPath(p));
    } else if (tag === '2') {
      const p = extractField(entry, 9);
      if (p) snap.trackedPaths.push(normalizeGitPath(p));
      expectRename = true;
    } else if (tag === 'u') {
      const p = extractField(entry, 10);
      if (p) snap.trackedPaths.push(normalizeGitPath(p));
    }
  }
  return snap;
}

function extractField(record: string, n: number): string | null {
  let spaces = 0;
  for (let i = 0; i < record.length; i++) {
    if (record[i] === ' ' && ++spaces === n) {
      const p = record.slice(i + 1);
      return p.length > 0 ? p : null;
    }
  }
  return null;
}

function detectLargeDirs(files: string[], dirs: string[], threshold: number): string[] {
  if (threshold <= 0 || files.length === 0) return [];
  const counts = new Map<string, number>();

  const sortedDirs = [...dirs].sort((a, b) => {
    const da = a.split('/').length, db = b.split('/').length;
    return da !== db ? db - da : a.localeCompare(b);
  });

  for (const f of files) {
    let bucket: string | null = null;
    for (const d of sortedDirs) {
      if (isPathWithin(f, d)) { bucket = d; break; }
    }
    if (!bucket) {
      const parts = f.split('/');
      bucket = parts.length > 1 ? parts.slice(0, -1).join('/') : '.';
    }
    counts.set(bucket, (counts.get(bucket) || 0) + 1);
  }

  return [...counts.entries()]
    .filter(([_, v]) => v >= threshold && _ !== '.')
    .sort((a, b) => b[1] - a[1])
    .map(([k]) => k);
}

interface FilesToAddResult {
  filtered: string[];
  allUntracked: string[];
  skippedLargeFiles: string[];
  skippedLargeDirs: string[];
}

async function getFilesToAdd(root: string): Promise<FilesToAddResult> {
  const status = await captureStatusSnapshot(root);
  const largeDirs = detectLargeDirs(status.untrackedFiles, status.untrackedDirs, MAX_UNTRACKED_DIR_FILES);
  const largeDirsSet = new Set(largeDirs);

  const untrackedForIndex = status.untrackedFilesForIndex
    .filter((p) => !isPathWithinAny(p, largeDirsSet));
  const skippedLargeFiles = status.skippedLargeFiles
    .filter((p) => !isPathWithinAny(p, largeDirsSet));

  const all = new Set<string>();
  status.trackedPaths.forEach((p) => all.add(p));
  untrackedForIndex.forEach((p) => all.add(p));

  return {
    filtered: [...all],
    allUntracked: status.untrackedFiles,
    skippedLargeFiles,
    skippedLargeDirs: largeDirs,
  };
}

export interface CreateCheckpointOpts {
  root: string;
  id: string;
  toolName: string;
  filePath: string;
}

export async function createCheckpoint(opts: CreateCheckpointOpts): Promise<CheckpointData> {
  const { root, id, toolName, filePath } = opts;
  const timestamp = Date.now();
  const iso = new Date(timestamp).toISOString();

  const headSha = await git('rev-parse HEAD', root).catch(() => '0'.repeat(40));
  const branch = await git('rev-parse --abbrev-ref HEAD', root).catch(() => 'unknown');
  const indexTreeSha = await git('write-tree', root);

  const tmpDir = await mkdtemp(join(tmpdir(), 'ad-checkpoint-'));
  const tmpIndex = join(tmpDir, 'index');

  try {
    const tmpEnv = { ...process.env, GIT_INDEX_FILE: tmpIndex };

    const { filtered, allUntracked, skippedLargeFiles, skippedLargeDirs } =
      await getFilesToAdd(root);

    debugLog(`createCheckpoint: ${filtered.length} files to add, ${allUntracked.length} untracked, ${skippedLargeFiles.length} skipped large, ${skippedLargeDirs.length} skipped large dirs`);

    const largeDirsSet = new Set(skippedLargeDirs);
    const largeFilesSet = new Set(skippedLargeFiles);
    const preexistingUntrackedFiles = allUntracked.filter((f) => {
      if (shouldIgnoreForSnapshot(f)) return false;
      if (largeFilesSet.has(f)) return false;
      if (isPathWithinAny(f, largeDirsSet)) return false;
      return true;
    });

    debugLog(`createCheckpoint: ${preexistingUntrackedFiles.length} preexisting untracked files`);

    if (headSha !== '0'.repeat(40)) {
      await git(`read-tree ${headSha}`, root, { env: tmpEnv });
    }

    const BATCH = 100;
    for (let i = 0; i < filtered.length; i += BATCH) {
      const batch = filtered.slice(i, i + BATCH).filter((f) => existsSync(join(root, f)));
      if (batch.length === 0) continue;
      const paths = batch.map((f) => `"${f}"`).join(' ');
      await git(`add --all -- ${paths}`, root, { env: tmpEnv });
    }

    const worktreeTreeSha = await git('write-tree', root, { env: tmpEnv });

    debugLog(`createCheckpoint: headSha=${headSha.slice(0, 8)} worktreeTreeSha=${worktreeTreeSha.slice(0, 8)} indexTreeSha=${indexTreeSha.slice(0, 8)}`);

    // Verify the worktree tree contains the expected content
    const diffTreeOutput = await git(`diff-tree --no-commit-id -r ${headSha} ${worktreeTreeSha}`, root).catch(() => '');
    const diffFiles = diffTreeOutput.split('\n').filter(Boolean);
    debugLog(`createCheckpoint: ${diffFiles.length} files differ between HEAD and worktree tree`);

    const msg = [
      `aiderdesk-checkpoint:${id}`,
      `toolName ${toolName}`,
      `filePath ${filePath}`,
      `branch ${branch}`,
      `head ${headSha}`,
      `index-tree ${indexTreeSha}`,
      `worktree-tree ${worktreeTreeSha}`,
      `created ${iso}`,
      `untracked ${JSON.stringify(preexistingUntrackedFiles)}`,
    ].join('\n');

    const commitEnv = {
      ...process.env,
      GIT_AUTHOR_NAME: 'aiderdesk-checkpoint',
      GIT_AUTHOR_EMAIL: 'checkpoint@aiderdesk',
      GIT_AUTHOR_DATE: iso,
      GIT_COMMITTER_NAME: 'aiderdesk-checkpoint',
      GIT_COMMITTER_EMAIL: 'checkpoint@aiderdesk',
      GIT_COMMITTER_DATE: iso,
    };

    const commitSha = await git(`commit-tree ${worktreeTreeSha}`, root, {
      input: msg,
      env: commitEnv,
    });

    await git(`update-ref ${REF_BASE}/${id} ${commitSha}`, root);

    return {
      ref: `${REF_BASE}/${id}`,
      toolName,
      filePath,
      timestamp,
      branch,
      headSha,
      indexTreeSha,
      worktreeTreeSha,
      preexistingUntrackedFiles: preexistingUntrackedFiles.length > 0 ? preexistingUntrackedFiles : undefined,
    };
  } finally {
    await rm(tmpDir, { recursive: true, force: true }).catch(() => {});
  }
}

export async function restoreCheckpoint(root: string, cp: CheckpointData): Promise<void> {
  if (cp.branch) {
    const currentBranch = await git('rev-parse --abbrev-ref HEAD', root).catch(() => 'unknown');
    if (currentBranch !== cp.branch) {
      throw new Error(
        `Branch mismatch: checkpoint created on "${cp.branch}" but current is "${currentBranch}". Switch branches first.`,
      );
    }
  }

  if (cp.headSha !== '0'.repeat(40)) {
    await git(`reset --hard ${cp.headSha}`, root);
  }

  await git(`read-tree --reset -u ${cp.worktreeTreeSha}`, root);

  await safeClean(root, cp.preexistingUntrackedFiles || []);

  await git(`read-tree --reset ${cp.indexTreeSha}`, root);
}

async function safeClean(root: string, preexisting: string[]): Promise<void> {
  const output = await git('ls-files --others --exclude-standard', root).catch(() => '');
  if (!output) return;
  const current = output.split('\n').filter(Boolean);
  if (current.length === 0) return;

  const preSet = new Set(preexisting);

  const toRemove = current.filter((f) => {
    if (preSet.has(f)) return false;
    if (shouldIgnoreForSnapshot(f)) return false;
    return true;
  });

  if (toRemove.length === 0) return;

  const BATCH = 100;
  for (let i = 0; i < toRemove.length; i += BATCH) {
    const batch = toRemove.slice(i, i + BATCH);
    const paths = batch.map((f) => `"${f}"`).join(' ');
    await git(`clean -f -- ${paths}`, root).catch(() => {});
  }
}

export async function deleteCheckpointRef(root: string, id: string): Promise<void> {
  await git(`update-ref -d ${REF_BASE}/${id}`, root).catch(() => {});
}
