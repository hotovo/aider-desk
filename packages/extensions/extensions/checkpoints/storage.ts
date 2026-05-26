import { readFile, writeFile, mkdir } from 'fs/promises';
import { join } from 'path';

import type { CheckpointData } from './core';

const CHECKPOINTS_DIR = 'checkpoints';

interface CheckpointEntry {
  ref: string;
  toolName: string;
  filePath: string;
  timestamp: number;
}

interface CheckpointIndex {
  checkpoints: Record<string, CheckpointEntry>;
}

function getCheckpointsDir(projectDir: string): string {
  return join(projectDir, '.aider-desk', CHECKPOINTS_DIR);
}

function getCheckpointsPath(projectDir: string, taskId: string): string {
  return join(getCheckpointsDir(projectDir), `${taskId}.json`);
}

export async function loadCheckpointIndex(projectDir: string, taskId: string): Promise<CheckpointIndex> {
  const filePath = getCheckpointsPath(projectDir, taskId);
  try {
    const data = await readFile(filePath, 'utf-8');
    return JSON.parse(data) as CheckpointIndex;
  } catch {
    return { checkpoints: {} };
  }
}

async function saveCheckpointIndex(projectDir: string, taskId: string, index: CheckpointIndex): Promise<void> {
  const filePath = getCheckpointsPath(projectDir, taskId);
  const dir = getCheckpointsDir(projectDir);
  await mkdir(dir, { recursive: true });
  await writeFile(filePath, JSON.stringify(index, null, 2), 'utf-8');
}

export async function addCheckpointEntry(
  projectDir: string,
  taskId: string,
  messageId: string,
  cpData: CheckpointData,
): Promise<void> {
  const index = await loadCheckpointIndex(projectDir, taskId);
  index.checkpoints[messageId] = {
    ref: cpData.ref,
    toolName: cpData.toolName,
    filePath: cpData.filePath,
    timestamp: cpData.timestamp,
  };
  await saveCheckpointIndex(projectDir, taskId, index);
}

export async function removeCheckpointEntry(
  projectDir: string,
  taskId: string,
  messageId: string,
): Promise<void> {
  const index = await loadCheckpointIndex(projectDir, taskId);
  delete index.checkpoints[messageId];
  await saveCheckpointIndex(projectDir, taskId, index);
}

export async function findCheckpointByMessage(
  projectDir: string,
  taskId: string,
  messageId: string,
): Promise<CheckpointEntry | null> {
  const index = await loadCheckpointIndex(projectDir, taskId);
  return index.checkpoints[messageId] ?? null;
}
