import { UpdatedFile } from '@common/types';

import type { DiffModalGroup } from './UpdatedFilesDiffModal';

export const UNCOMMITTED_GROUP_ID = '__uncommitted__';

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
