import { v4 as uuidv4 } from 'uuid';

import type { AgentProfile, ContextMessage, PromptContext } from '@common/types';
import type { Task } from '@/task';

export { CompactionLevel, smartCompactMessages } from './smart-compaction';

export const extractSummary = (content: string): string => {
  const lines = content.split('\n');
  const summaryMarker = '### **Conversation Summary**';
  const markerIndex = lines.findIndex((line) => line.trim() === summaryMarker);
  if (markerIndex !== -1) {
    return lines.slice(markerIndex).join('\n');
  }
  return content;
};

export const getSubagentOldResultIds = (resultMessages: ContextMessage[], userRequestMessageId: string): string[] =>
  resultMessages.filter((m) => m.id !== userRequestMessageId).map((m) => m.id);

export const getReloadableMessages = (messages: ContextMessage[]): ContextMessage[] => messages.filter((m) => m.role !== 'user');

export const buildCompactSummaryMessages = (
  userMessage: ContextMessage,
  summaryContent: string | undefined,
  promptContext?: PromptContext,
): ContextMessage[] => [
  userMessage,
  {
    id: uuidv4(),
    role: 'assistant',
    content: summaryContent ? extractSummary(summaryContent) : 'Failed to generate summary.',
    promptContext,
    timestamp: Date.now(),
  },
];

export const generateCompactedSummary = async (
  userMessage: ContextMessage,
  allMessages: ContextMessage[],
  profile: AgentProfile,
  task: Task,
  promptContext?: PromptContext,
  abortSignal?: AbortSignal,
  getCompactConversationPrompt: (task: Task, customInstructions?: string) => Promise<string> = async () => '',
  generateText: (
    modelId: string,
    systemPrompt: string,
    prompt: string,
    projectDir: string,
    messages: ContextMessage[],
    abortable: boolean,
    abortSignal?: AbortSignal,
  ) => Promise<string | undefined> = async () => undefined,
): Promise<ContextMessage[]> => {
  const compactPrompt = await getCompactConversationPrompt(task, undefined);
  const summaryText = await generateText(`${profile.provider}/${profile.model}`, '', compactPrompt, task.getProjectDir(), allMessages, true, abortSignal);
  return buildCompactSummaryMessages(userMessage, summaryText, promptContext);
};
