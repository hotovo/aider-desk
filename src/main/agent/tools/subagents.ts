import { tool, type ToolSet } from 'ai';
import { z } from 'zod';
import { AgentProfile, ContextMemoryMode, ContextMessage, InvocationMode, PromptContext, SettingsData } from '@common/types';
import { v4 as uuidv4 } from 'uuid';
import { SUBAGENTS_TOOL_GROUP_NAME, SUBAGENTS_TOOL_RUN_TASK, TOOL_GROUP_NAME_SEPARATOR } from '@common/tools';
import { DEFAULT_AGENT_PROFILE, isSubagentEnabled } from '@common/agent';
import { extractServerNameToolName } from '@common/utils';

import { AgentProfileManager } from '@/agent/agent-profile-manager';
import { Task } from '@/task';
import logger from '@/logger';

export const getSubagentId = (subagent: AgentProfile): string => {
  return subagent.name.toLowerCase().replace(/\s+/g, '-');
};

export const createSubagentsToolset = async (
  _settings: SettingsData,
  task: Task,
  agentProfileManager: AgentProfileManager,
  mainAgentProfile: AgentProfile,
  abortSignal?: AbortSignal,
  contextMessages: ContextMessage[] = [],
  currentMessages: ContextMessage[] = [],
): Promise<ToolSet> => {
  const allProfiles = agentProfileManager.getProjectProfiles(task.getProjectDir());
  const enabledSubagents = allProfiles.filter((agentProfile) => isSubagentEnabled(agentProfile, mainAgentProfile.id));

  const generateSubagentsRunTaskDescription = (): string => {
    const automaticSubagents = enabledSubagents.filter((agentProfile) => agentProfile.subagent.invocationMode === InvocationMode.Automatic);
    const onDemandSubagents = enabledSubagents.filter((agentProfile) => agentProfile.subagent.invocationMode === InvocationMode.OnDemand);

    let description = 'Delegates a specific task to a subagent. You have access to the following subagents:\n';

    if (automaticSubagents.length > 0) {
      description += '\n<automatic-subagents>\n';
      for (const subagent of automaticSubagents) {
        description += `  <subagent>\n    <id>${getSubagentId(subagent)}</id>\n    <name>${subagent.name}</name>\n    <description>${subagent.subagent.description}</description>\n  </subagent>\n`;
      }
      description += '</automatic-subagents>\n';
    }

    if (onDemandSubagents.length > 0) {
      description += '\n<on-demand-subagents>\n';
      for (const subagent of onDemandSubagents) {
        description += `  <subagent>\n    <id>${getSubagentId(subagent)}</id>\n    <name>${subagent.name}</name>\n  </subagent>\n`;
      }
      description += '</on-demand-subagents>\n';
    }

    description +=
      '\nWhen user asks to use subagent by name, find the most fitting one by the name. The subagent is responsible for its own deep context gathering if needed, you are expected to only provide `prompt`.';

    return description;
  };

  const runTaskTool = tool({
    description: generateSubagentsRunTaskDescription(),
    inputSchema: z.object({
      subagentId: z.string().describe('The ID of the specific subagent to use.'),
      prompt: z
        .string()
        .describe(
          'A clear and concise natural language prompt describing the task the subagent needs to perform. This prompt should provide all necessary information for the subagent to complete its task independently within its limited context.',
        ),
    }),
    execute: async ({ prompt, subagentId }, { toolCallId }) => {
      const targetSubagent = enabledSubagents.find((agentProfile) => getSubagentId(agentProfile) === subagentId);
      if (!targetSubagent) {
        return `Error: Subagent with ID '${subagentId}' not found or not enabled.`;
      }

      // Create a subagent profile based on the selected subagent
      const subagentProfile: AgentProfile = {
        ...DEFAULT_AGENT_PROFILE,
        ...targetSubagent,
        useTodoTools: false, // Disable todo tools for simplicity,
        useSubagents: false, // Disable nested subagents
        useMemoryTools: targetSubagent.useMemoryTools ?? false, // Use memory tools if enabled, false by default
      };

      // Create promptContext with working group
      const promptContext: PromptContext = {
        id: uuidv4(),
        group: {
          id: uuidv4(),
          color: targetSubagent.subagent.color,
          name: {
            key: 'toolMessage.subagents.groupRunning',
            params: {
              name: targetSubagent.name,
            },
          },
        },
      };

      const getSubagentContextMessages = (contextMemory: ContextMemoryMode) => {
        const subagentContextMessages: ContextMessage[] = [];

        const findMessagesForToolCallId = (toolCallId: string) => {
          return [...contextMessages, ...currentMessages].reduce<ContextMessage[]>((acc, message) => {
            if (message.role !== 'tool') {
              return acc;
            }

            const matchingParts = message.content.filter(
              (part) => part.type === 'tool-result' && part.toolCallId === toolCallId && part.output.type === 'json',
            );

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

        logger.info('Subagent context messages:', {
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

      try {
        task.addToolMessage(
          toolCallId,
          SUBAGENTS_TOOL_GROUP_NAME,
          SUBAGENTS_TOOL_RUN_TASK,
          {
            prompt,
            subagentId,
          },
          undefined,
          undefined,
          promptContext,
        );

        // Run the subagent with the focused context
        const subagentContextMessages =
          subagentProfile.subagent.contextMemory !== ContextMemoryMode.Off ? getSubagentContextMessages(subagentProfile.subagent.contextMemory) : [];
        const effectivePrompt =
          subagentContextMessages.length > 0
            ? `${prompt}

Make sure to reuse the previous conversation if possible.`
            : prompt;

        const subagentResultMessages = await task.runSubagent(
          subagentProfile,
          effectivePrompt,
          subagentContextMessages,
          [],
          targetSubagent.subagent.systemPrompt,
          abortSignal,
          promptContext,
        );

        // Update promptContext to finished state with success
        promptContext.group = {
          ...promptContext.group!,
          name: {
            key: 'toolMessage.subagents.groupCompleted',
            params: {
              name: targetSubagent.name,
            },
          },
          finished: true,
        };

        return {
          messages: subagentResultMessages,
          promptContext,
        };
      } catch (error) {
        const errorMessage = error instanceof Error ? error.message : String(error);
        logger.error('Error running subagent:', error);

        // Update promptContext to finished state with error
        promptContext.group = {
          ...promptContext.group!,
          name: 'toolMessage.error',
          color: 'var(--color-error-muted)',
          finished: true,
        };

        return {
          error: `Error running subagent '${targetSubagent.name}': ${errorMessage}`,
          promptContext,
        };
      }
    },
  });

  const toolSet: ToolSet = {};

  if (enabledSubagents.length > 0) {
    toolSet[`${SUBAGENTS_TOOL_GROUP_NAME}${TOOL_GROUP_NAME_SEPARATOR}${SUBAGENTS_TOOL_RUN_TASK}`] = runTaskTool;
  }

  return toolSet;
};
