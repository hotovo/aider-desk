import { spawnSync } from 'child_process';
import { existsSync } from 'fs';

import { probeBinaryPath, probeScriptPath, resourcesDir, pkgRoot } from './constants';

export function isProbeBinaryPresent(): boolean {
  return existsSync(probeBinaryPath);
}

export type ProbeOutputSink = (line: string, isError?: boolean) => void;

function announce(line: string, sink: ProbeOutputSink | undefined, isError = false): void {
  if (sink) {
    sink(line, isError);
    return;
  }
  const color = isError ? '\x1b[31m' : '\x1b[33m';
  process.stderr.write(`${color}${line}\x1b[0m\n`);
}

export function ensureProbeBinary(onOutput?: ProbeOutputSink): boolean {
  if (isProbeBinaryPresent()) return true;

  const usePipe = typeof onOutput === 'function';
  announce(`Probe binary not found at ${probeBinaryPath}. Attempting to download...`, onOutput);

  let result;
  try {
    result = spawnSync(process.execPath, [probeScriptPath, '--current-platform-only'], {
      cwd: pkgRoot,
      env: { ...process.env, RESOURCES_DIR: resourcesDir },
      stdio: usePipe ? 'pipe' : 'inherit',
      encoding: usePipe ? 'utf8' : undefined,
    });
  } catch (err) {
    announce(`Failed to launch probe download script: ${(err as Error).message}`, onOutput, true);
    return false;
  }

  if (result.error) {
    announce(`Failed to download probe binary: ${result.error.message}`, onOutput, true);
    return false;
  }

  if (usePipe) {
    const stderr = (result.stderr as string | undefined) ?? '';
    for (const rawLine of stderr.split('\n')) {
      const line = rawLine.trim();
      if (line) announce(line, onOutput, true);
    }
    const stdout = (result.stdout as string | undefined) ?? '';
    for (const rawLine of stdout.split('\n')) {
      const line = rawLine.trim();
      if (line) announce(line, onOutput);
    }
  }

  if (typeof result.status === 'number' && result.status !== 0) {
    announce(`Probe download script exited with code ${result.status}.`, onOutput, true);
    return false;
  }

  if (!isProbeBinaryPresent()) {
    announce(`Probe binary still not found at ${probeBinaryPath} after download attempt.`, onOutput, true);
    return false;
  }

  announce('Probe binary downloaded successfully.', onOutput);
  return true;
}
