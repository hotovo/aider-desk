import { AgentProfile, ContextMemoryMode, ContextMessage, PromptContext } from '@common/types';
import { DEFAULT_AGENT_PROFILE, getSubagentId, isSubagentEnabled } from '@common/agent';
import { SUBAGENTS_TOOL_GROUP_NAME, SUBAGENTS_TOOL_RUN_TASK } from '@common/tools';
import { extractServerNameToolName } from '@common/utils';
import { v4 as uuidv4 } from 'uuid';

import { Task } from '@/task';
import logger from '@/logger';

export type SubagentGroupName =
  | string
  | {
      key: string;
      params: Record<string, string>;
    };

export type RunSubagentTaskParams = {
  task: Task;
  targetSubagent: AgentProfile;
  prompt: string;
  description?: string;
  abortSignal?: AbortSignal;
  contextMessages?: ContextMessage[];
  currentMessages?: ContextMessage[];
  onStarted?: (promptContext: PromptContext) => void | Promise<void>;
};

export type RunSubagentTaskResult =
  | {
      status: 'success';
      messages: ContextMessage[];
      promptContext: PromptContext;
    }
  | {
      status: 'cancelled';
      messages: ContextMessage[];
      promptContext: PromptContext;
    }
  | {
      status: 'error';
      error: string;
      promptContext: PromptContext;
    };

export const getEnabledSubagents = (profiles: AgentProfile[], mainAgentProfile: AgentProfile): AgentProfile[] => {
  return profiles.filter((agentProfile) => isSubagentEnabled(agentProfile, mainAgentProfile));
};

export const findEnabledSubagent = (
  enabledSubagents: AgentProfile[],
  subagentId: string,
  options: { matchByName?: boolean } = {},
): AgentProfile | undefined => {
  return enabledSubagents.find((agentProfile) => getSubagentId(agentProfile) === subagentId || (options.matchByName && agentProfile.name === subagentId));
};

export const buildRestrictedSubagentProfile = (targetSubagent: AgentProfile): AgentProfile => {
  return {
    ...DEFAULT_AGENT_PROFILE,
    ...targetSubagent,
    useTodoTools: false,
    useSubagents: false,
    useMemoryTools: targetSubagent.useMemoryTools ?? false,
  };
};

export const createSubagentPromptContext = (targetSubagent: AgentProfile, description?: string): PromptContext => {
  return {
    id: uuidv4(),
    group: {
      id: uuidv4(),
      color: targetSubagent.subagent.color,
      name: getRunningGroupName(targetSubagent, description),
      interruptId: uuidv4(),
    },
  };
};

export const getRunningGroupName = (targetSubagent: AgentProfile, description?: string): SubagentGroupName => {
  if (description) {
    return `${targetSubagent.name}: ${description.endsWith('...') ? description : `${description}...`}`;
  }

  return {
    key: 'toolMessage.subagents.groupRunning',
    params: {
      name: targetSubagent.name,
    },
  };
};

export const getCancelledGroupName = (targetSubagent: AgentProfile, description?: string): SubagentGroupName => {
  if (description) {
    return {
      key: 'toolMessage.subagents.groupCancelledWithDescription',
      params: {
        name: targetSubagent.name,
        description: description.endsWith('...') ? description.slice(0, -3) : description,
      },
    };
  }

  return {
    key: 'toolMessage.subagents.groupCancelled',
    params: {
      name: targetSubagent.name,
    },
  };
};

export const getCompletedGroupName = (targetSubagent: AgentProfile, description?: string): SubagentGroupName => {
  if (description) {
    return {
      key: 'toolMessage.subagents.groupCompletedWithDescription',
      params: {
        name: targetSubagent.name,
        description: description.endsWith('...') ? description.slice(0, -3) : description,
      },
    };
  }

  return {
    key: 'toolMessage.subagents.groupCompleted',
    params: {
      name: targetSubagent.name,
    },
  };
};

const getSubagentContextMessages = (
  subagentId: string,
  contextMemory: ContextMemoryMode,
  contextMessages: ContextMessage[],
  currentMessages: ContextMessage[],
): ContextMessage[] => {
  const subagentContextMessages: ContextMessage[] = [];

  const findMessagesForToolCallId = (toolCallId: string) => {
    return [...contextMessages, ...currentMessages].reduce<ContextMessage[]>((acc, message) => {
      if (message.role !== 'tool') {
        return acc;
      }

      const matchingParts = message.content.filter((part) => part.type === 'tool-result' && part.toolCallId === toolCallId && part.output.type === 'json');

      for (const part of matchingParts) {
        // @ts-expect-error part.output.value is expected to be in the output
        const messages = (part.output.value as { messages: ContextMessage[] }).messages;
        if (messages.length > 0) {
          acc.push(...messages);
        }
      }

      return acc;
    }, []);
  };

  logger.debug('Subagent context messages:', {
    messages: contextMessages.length,
    currentMessages: currentMessages.length,
  });

  [...contextMessages, ...currentMessages]
    .filter((message) => message.role === 'assistant')
    .forEach((message) => {
      if (!Array.isArray(message.content)) {
        return;
      }

      for (const part of message.content) {
        if (part.type === 'tool-call') {
          const [serverName, toolName] = extractServerNameToolName(part.toolName);
          logger.info('Subagent context messages: tool-call', {
            serverName,
            toolName,
            subagentId,
            input: part.input,
          });
          // @ts-expect-error subagentId is expected to be in the input
          if (serverName === SUBAGENTS_TOOL_GROUP_NAME && toolName === SUBAGENTS_TOOL_RUN_TASK && part.input?.subagentId === subagentId) {
            const toolMessages = findMessagesForToolCallId(part.toolCallId);

            logger.info('Subagent context messages:', {
              count: toolMessages.length,
            });
            if (toolMessages.length > 0) {
              subagentContextMessages.push({
                id: message.id,
                role: 'user',
                // @ts-expect-error prompt is expected to be in the input
                content: part.input.prompt,
              });

              switch (contextMemory) {
                case ContextMemoryMode.FullContext:
                  subagentContextMessages.push(...toolMessages);
                  break;
                case ContextMemoryMode.LastMessage:
                  subagentContextMessages.push(toolMessages[toolMessages.length - 1]);
                  break;
              }
            }
          }
        }
      }
    });

  logger.info('Subagent context messages:', {
    messages: subagentContextMessages.length,
  });

  return subagentContextMessages;
};

export const runSubagentTask = async ({
  task,
  targetSubagent,
  prompt,
  description,
  abortSignal,
  contextMessages = [],
  currentMessages = [],
  onStarted,
}: RunSubagentTaskParams): Promise<RunSubagentTaskResult> => {
  const subagentId = getSubagentId(targetSubagent);
  const subagentProfile = buildRestrictedSubagentProfile(targetSubagent);
  const promptContext = createSubagentPromptContext(targetSubagent, description);
  const interruptId = promptContext.group!.interruptId!;
  const subagentAbortController = new AbortController();

  if (abortSignal) {
    if (abortSignal.aborted) {
      subagentAbortController.abort();
    } else {
      abortSignal.addEventListener('abort', () => subagentAbortController.abort());
    }
  }

  try {
    await onStarted?.(promptContext);

    const subagentContextMessages =
      subagentProfile.subagent.contextMemory !== ContextMemoryMode.Off
        ? getSubagentContextMessages(subagentId, subagentProfile.subagent.contextMemory, contextMessages, currentMessages)
        : [];
    const effectivePrompt =
      subagentContextMessages.length > 0
        ? `${prompt}

Make sure to reuse the previous conversation if possible.`
        : prompt;

    const subagentSystemPrompt = targetSubagent.subagent.systemPrompt?.trim()
      ? await task.compileCustomSystemPrompt(targetSubagent.subagent.systemPrompt)
      : undefined;

    const subagentResultMessages = await task.runSubagent(
      subagentProfile,
      effectivePrompt,
      subagentContextMessages,
      [],
      subagentSystemPrompt,
      subagentAbortController,
      promptContext,
    );

    if (subagentAbortController.signal.aborted) {
      logger.info('Subagent run cancelled by user', { subagentId, interruptId });

      promptContext.group = {
        ...promptContext.group!,
        name: getCancelledGroupName(targetSubagent, description),
        finished: true,
      };

      subagentResultMessages.push({
        id: uuidv4(),
        role: 'user' as const,
        content: 'Subagent run cancelled by user.',
        promptContext,
      });

      return {
        status: 'cancelled',
        messages: subagentResultMessages,
        promptContext,
      };
    }

    promptContext.group = {
      ...promptContext.group!,
      name: getCompletedGroupName(targetSubagent, description),
      finished: true,
    };

    return {
      status: 'success',
      messages: subagentResultMessages,
      promptContext,
    };
  } catch (error) {
    if (subagentAbortController.signal.aborted) {
      logger.info('Subagent run cancelled by user (in catch)', { subagentId, interruptId });

      promptContext.group = {
        ...promptContext.group!,
        name: getCancelledGroupName(targetSubagent, description),
        finished: true,
      };

      return {
        status: 'cancelled',
        messages: [
          {
            id: uuidv4(),
            role: 'user' as const,
            content: 'Subagent run cancelled by user.',
            promptContext,
          },
        ],
        promptContext,
      };
    }

    const errorMessage = error instanceof Error ? error.message : String(error);
    logger.error('Error running subagent:', error);

    promptContext.group = {
      ...promptContext.group!,
      name: 'toolMessage.error',
      color: 'var(--color-error-muted)',
      finished: true,
    };

    return {
      status: 'error',
      error: `Error running subagent '${targetSubagent.name}': ${errorMessage}`,
      promptContext,
    };
  }
};
