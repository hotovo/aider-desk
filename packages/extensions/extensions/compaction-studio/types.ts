import type { SmartCompactionPasses } from '@aiderdesk/extensions';

export interface CompactionStudioSettings {
  protectedMessageCount: number;
  compactionLevel: number;
  passes: SmartCompactionPasses;
}

export interface CompactionStudioRunResult {
  messagesBefore: number;
  messagesAfter: number;
  tokensBefore: number;
  tokensAfter: number;
  savedTokens: number;
}

export interface CompactionStudioTaskState {
  visible?: boolean;
  settings?: CompactionStudioSettings;
  lastResult?: CompactionStudioRunResult;
}

export type CompactionStudioStateMap = Record<string, CompactionStudioTaskState>;
