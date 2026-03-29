import { spawn, type ChildProcess } from 'child_process';

import { resourcesDir, rendererDir, runnerPath, DEFAULT_PORT } from './constants';

export function getRunnerEnv(port: number): Record<string, string> {
  const env: Record<string, string> = {
    ...(process.env as Record<string, string>),
    NODE_ENV: process.env.NODE_ENV || 'production',
    AIDER_DESK_HEADLESS: 'true',
    AIDER_DESK_RESOURCES_DIR: resourcesDir,
    AIDER_DESK_RENDERER_DIR: rendererDir,
  };

  if (port !== DEFAULT_PORT || process.env.AIDER_DESK_PORT) {
    env.AIDER_DESK_PORT = String(port);
  }

  return env;
}

export function spawnRunnerProcess(port: number, stdio: 'inherit' | ['pipe', 'pipe', 'pipe']): ChildProcess {
  return spawn(process.execPath, [runnerPath], {
    env: getRunnerEnv(port),
    stdio,
  });
}

export function spawnRunner(port: number, stdio: 'inherit' | ['pipe', 'pipe', 'pipe']): void {
  const child = spawnRunnerProcess(port, stdio);

  const forwardSignal = (signal: NodeJS.Signals) => {
    child.kill(signal);
  };

  process.on('SIGINT', () => forwardSignal('SIGINT'));
  process.on('SIGTERM', () => forwardSignal('SIGTERM'));

  child.on('exit', (code) => {
    process.exit(code ?? 0);
  });

  child.on('error', (err) => {
    console.error(`Failed to start: ${err.message}`);
    process.exit(1);
  });
}
