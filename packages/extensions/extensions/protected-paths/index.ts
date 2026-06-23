/**
 * Protected Paths Extension
 *
 * Blocks read, write, and edit operations on protected paths.
 * Prevents accidental modifications to sensitive files and system directories.
 *
 * Patterns adapted from Terax-AI (Apache-2.0).
 */

import type {
  Extension,
  ExtensionContext,
  ToolCalledEvent,
} from '@aiderdesk/extensions';

/**
 * Secret basename patterns. Matched against the file's basename (last path
 * segment). Patterns use `(?:[.\s:]|$)` as a tail anchor instead of `$` to
 * also catch Windows NTFS alternate data streams (`name:stream`) and
 * trailing dots/spaces that Windows discards at open time.
 */
const SECRET_BASENAME_PATTERNS: RegExp[] = [
  /^\.env(\..+)?(?:[.\s:]|$)/i,
  /^.*\.pem(?:[.\s:]|$)/i,
  /^.*\.key(?:[.\s:]|$)/i,
  /^.*\.p12(?:[.\s:]|$)/i,
  /^.*\.pfx(?:[.\s:]|$)/i,
  /^.*\.asc(?:[.\s:]|$)/i,
  /^.*\.gpg(?:[.\s:]|$)/i,
  /^.*\.keystore(?:[.\s:]|$)/i,
  /^.*\.jks(?:[.\s:]|$)/i,
  /^id_(rsa|dsa|ecdsa|ed25519)([._-].*)?(?:[.\s:]|$)/i,
  /^known_hosts(?:[.\s:]|$)/i,
  /^authorized_keys(?:[.\s:]|$)/i,
  /^htpasswd(?:[.\s:]|$)/i,
  /^\.netrc(?:[.\s:]|$)/i,
  /^_netrc(?:[.\s:]|$)/i,
  /^credentials(?:[.\s:]|$)/i,
  /^\.pgpass(?:[.\s:]|$)/i,
  /^\.npmrc(?:[.\s:]|$)/i,
  /^\.pypirc(?:[.\s:]|$)/i,
  /^secrets?\.(json|ya?ml|toml|env)(?:[.\s:]|$)/i,
  /^service[-_]?account.*\.json(?:[.\s:]|$)/i,
];

/**
 * Protected directories. Matched as exact path segment or descendant —
 * never raw substring. Listed without trailing slash.
 */
const PROTECTED_DIRS = [
  '/.ssh',
  '/.gnupg',
  '/.aws',
  '/.azure',
  '/.kube',
  '/.docker',
  '/.config/gh',
  '/.config/git',
  '/.config/gcloud',
  '/.config/op',
  '/.git',
  '/.terraform.d',
  '/library/keychains',
  '/library/cookies',
  '/etc',
  '/private/etc',
  '/proc',
  '/sys',
  '/var/db',
  '/var/root',
  '/private/var/db',
  '/private/var/root',
  '/appdata/roaming/microsoft/credentials',
  '/appdata/local/microsoft/credentials',
  '/appdata/roaming/gcloud',
];

/**
 * Additional protected paths for substring matching (kept for backward
 * compatibility with the original extension).
 */
const PROTECTED_SUBSTRINGS = ['node_modules/'];

/**
 * Write-only deny prefixes (system locations). Read access is not universally
 * blocked — reading /etc/hosts is fine; writing to it isn't.
 */
const WRITE_DENY_PREFIXES = [
  '/etc/',
  '/var/db/',
  '/var/root/',
  '/system/',
  '/library/keychains/',
  '/library/launchagents/',
  '/library/launchdaemons/',
  '/private/etc/',
  '/private/var/db/',
  '/private/var/root/',
  '/usr/bin/',
  '/usr/sbin/',
  '/usr/local/bin/',
  '/bin/',
  '/sbin/',
  '/boot/',
  '/windows/',
  '/program files/',
  '/program files (x86)/',
  '/programdata/',
];

const basename = function (p: string): string {
  const i = Math.max(p.lastIndexOf('/'), p.lastIndexOf('\\'));
  return i >= 0 ? p.slice(i + 1) : p;
};

/**
 * Build a normalized comparison surface — never used as a real path:
 *  - back-slashes → forward-slashes
 *  - strip Windows drive prefix (e.g. C:)
 *  - strip UNC prefix //?/
 *  - strip NTFS alternate-data-stream suffix from each path segment
 *  - strip trailing dots/spaces from each segment (Windows behavior)
 *  - collapse duplicate slashes
 *  - lowercase (so case variants match on case-insensitive filesystems)
 *  - drop trailing slash (except for root)
 */
const comparisonForm = function (p: string): string {
  let s = p.replace(/\\/g, '/');
  s = s.replace(/^\/\/\?\//, '/');
  s = s.replace(/^[a-zA-Z]:/, '');
  s = s
    .split('/')
    .map((seg) => {
      const colon = seg.indexOf(':');
      return colon === -1 ? seg : seg.slice(0, colon);
    })
    .join('/');
  s = s
    .split('/')
    .map((seg) => seg.replace(/[.\s]+$/, ''))
    .join('/');
  s = s.replace(/\/{2,}/g, '/');
  s = s.toLowerCase();
  if (s.length > 1 && s.endsWith('/')) {
    s = s.slice(0, -1);
  }
  return s;
};

const isUnderProtected = function (cmp: string, dir: string): boolean {
  return (cmp + '/').includes(dir + '/');
};

const describeProtected = function (dir: string): string {
  return dir.replace(/^\//, '');
};

export type SafetyResult = { ok: true } | { ok: false; reason: string };

export const checkReadable = function (path: string): SafetyResult {
  if (typeof path !== 'string' || path.length === 0) {
    return { ok: false, reason: 'Refused: empty path.' };
  }

  if (/[\x00-\x1f]/.test(path)) {
    return { ok: false, reason: 'Refused: path contains control bytes.' };
  }

  const base = basename(path);
  for (const re of SECRET_BASENAME_PATTERNS) {
    if (re.test(base)) {
      return {
        ok: false,
        reason: `Refused: "${base}" matches a sensitive-file pattern.`,
      };
    }
  }

  const cmp = comparisonForm(path);
  for (const dir of PROTECTED_DIRS) {
    if (isUnderProtected(cmp, dir)) {
      return {
        ok: false,
        reason: `Refused: path is inside a protected directory (${describeProtected(dir)}).`,
      };
    }
  }

  if (PROTECTED_SUBSTRINGS.some((p) => path.includes(p))) {
    return { ok: false, reason: 'Refused: path is inside a protected directory.' };
  }

  return { ok: true };
};

export const checkWritable = function (path: string): SafetyResult {
  const r = checkReadable(path);
  if (!r.ok) return r;

  const cmp = comparisonForm(path);
  const cmpForPrefix = cmp.startsWith('/') ? cmp : `/${cmp}`;
  for (const prefix of WRITE_DENY_PREFIXES) {
    if (cmpForPrefix.startsWith(prefix) || `${cmpForPrefix}/`.startsWith(prefix)) {
      return {
        ok: false,
        reason: `Refused: writes under "${prefix.replace(/\/$/, '')}" are not allowed.`,
      };
    }
  }

  return { ok: true };
};

export default class ProtectedPathsExtension implements Extension {
  static metadata = {
    name: 'Protected Paths',
    version: '2.0.0',
    description: 'Blocks file operations on sensitive files and protected directories (.env*, *.pem, .ssh/, .aws/, .git/, system dirs, etc.)',
    author: 'wladimiiir',
    iconUrl: 'https://raw.githubusercontent.com/hotovo/aider-desk/refs/heads/main/packages/extensions/extensions/protected-paths/icon.png',
    capabilities: ['security'],
  };

  async onLoad(context: ExtensionContext) {
    context.log('Protected Paths Extension loaded', 'info');
  }

  async onToolCalled(event: ToolCalledEvent, context: ExtensionContext): Promise<void | Partial<ToolCalledEvent>> {
    context.log(`onToolCalled triggered: toolName=${event.toolName}`, 'debug');

    if (event.toolName !== 'power---file_write' && event.toolName !== 'power---file_edit' && event.toolName !== 'power---file_read') {
      context.log(`Ignoring non-file tool: ${event.toolName}`, 'debug');
      return undefined;
    }

    const path = (event.input as { filePath?: string })?.filePath;
    context.log(`File operation detected on path: ${path}`, 'debug');

    if (typeof path !== 'string') {
      context.log('Path is not a string, skipping', 'warn');
      return undefined;
    }

    const isWrite = event.toolName === 'power---file_write' || event.toolName === 'power---file_edit';
    const result = isWrite ? checkWritable(path) : checkReadable(path);

    if (!result.ok) {
      const reason = (result as { ok: false; reason: string }).reason;
      context.log(`Blocked operation on protected path: ${path} — ${reason}`, 'warn');

      const taskContext = context.getTaskContext();
      if (taskContext) {
        taskContext.addLogMessage('warning', `Blocked ${isWrite ? 'write' : 'read'} to protected path: ${path} — ${reason}`);
      }

      return { output: reason };
    }

    return undefined;
  }
}
