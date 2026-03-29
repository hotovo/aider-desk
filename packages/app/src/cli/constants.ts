import { resolve, dirname } from 'path';

export const READY_PATTERN = /AiderDesk Runner is ready and running on port (\d+)/;
export const DEFAULT_PORT = 24337;
export const MAX_LOG_LINES = 500;

export const pkgRoot = resolve(dirname(__filename), '..');
export const resourcesDir = resolve(pkgRoot, 'out', 'resources');
export const rendererDir = resolve(pkgRoot, 'out', 'renderer');
export const runnerPath = resolve(pkgRoot, 'out', 'runner.js');

export function getPortFromEnv(): number | null {
  const envPort = process.env.AIDER_DESK_PORT;
  if (envPort) {
    const port = parseInt(envPort, 10);
    if (port >= 1 && port <= 65535) return port;
  }
  return null;
}

export function getDefaultPort(): number {
  return getPortFromEnv() ?? DEFAULT_PORT;
}

export function resolvePort(port: number | undefined): number {
  return port ?? getDefaultPort();
}

export const c = {
  reset: '\x1b[0m',
  bold: '\x1b[1m',
  dim: '\x1b[2m',
  blink: '\x1b[5m',
  black: (s: string) => `\x1b[30m${s}\x1b[39m`,
  red: (s: string) => `\x1b[31m${s}\x1b[39m`,
  green: (s: string) => `\x1b[32m${s}\x1b[39m`,
  yellow: (s: string) => `\x1b[33m${s}\x1b[39m`,
  cyan: (s: string) => `\x1b[36m${s}\x1b[39m`,
  gray: (s: string) => `\x1b[90m${s}\x1b[39m`,
  white: (s: string) => `\x1b[37m${s}\x1b[49m`,
  bgCyan: (s: string) => `\x1b[46m${s}\x1b[49m`,
  boldCyan: (s: string) => `\x1b[1m\x1b[36m${s}\x1b[0m`,
  boldWhite: (s: string) => `\x1b[1m\x1b[37m${s}\x1b[0m`,
  bgCyanBlack: (s: string) => `\x1b[30m\x1b[46m${s}\x1b[0m`,
};
