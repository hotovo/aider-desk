import { UpdatedFile } from '@common/types';

import { createFileTree, normalizePath } from './types';

import type { DiffModalGroup } from './UpdatedFilesDiffModal';

export const UNCOMMITTED_GROUP_ID = '__uncommitted__';

// Sort files to match the sidebar tree order (folders first, alphabetical within each folder, depth-first)
export const sortFilesByTreeOrder = (files: UpdatedFile[]): UpdatedFile[] => {
  const treeData = createFileTree(files.map((f) => ({ path: f.path })));
  const order: string[] = [];
  const walk = (nodeId: string): void => {
    const node = treeData[nodeId];
    if (!node) {
      return;
    }
    if (!node.isFolder && node.file) {
      order.push(normalizePath(node.file.path));
    }
    for (const child of node.children ?? []) {
      walk(String(child));
    }
  };
  walk('root');

  const orderMap = new Map(order.map((path, index) => [path, index]));
  return [...files].sort((a, b) => (orderMap.get(normalizePath(a.path)) ?? 0) - (orderMap.get(normalizePath(b.path)) ?? 0));
};

export const groupFilesByCommit = (files: UpdatedFile[]): DiffModalGroup[] => {
  const groupMap = new Map<string, DiffModalGroup>();
  const committedOrder: string[] = [];

  for (const file of files) {
    const groupId = file.commitHash || UNCOMMITTED_GROUP_ID;

    if (!groupMap.has(groupId)) {
      if (file.commitHash) {
        committedOrder.push(groupId);
      }
      groupMap.set(groupId, {
        id: groupId,
        commitHash: file.commitHash,
        commitMessage: file.commitMessage,
        files: [],
      });
    }

    groupMap.get(groupId)!.files.push(file);
  }

  // Oldest commits first (reverse of backend order), then uncommitted last
  const result: DiffModalGroup[] = [...committedOrder].reverse().map((id) => groupMap.get(id)!);
  const uncommitted = groupMap.get(UNCOMMITTED_GROUP_ID);
  if (uncommitted) {
    result.push(uncommitted);
  }

  return result;
};
