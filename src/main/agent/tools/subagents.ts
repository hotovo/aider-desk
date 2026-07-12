import { tool, type ToolSet } from 'ai';
import { z } from 'zod';
import { AgentProfile, ContextMessage, InvocationMode, SettingsData } from '@common/types';
import { getSubagentId } from '@common/agent';
import { SUBAGENTS_TOOL_GROUP_NAME, SUBAGENTS_TOOL_RUN_TASK, TOOL_GROUP_NAME_SEPARATOR } from '@common/tools';

import { AgentProfileManager } from '@/agent/agent-profile-manager';
import { findEnabledSubagent, getEnabledSubagents, runSubagentTask } from '@/agent/subagent';
import { Task } from '@/task';

export const createSubagentsToolset = async (
  _settings: SettingsData,
  task: Task,
  agentProfileManager: AgentProfileManager,
  mainAgentProfile: AgentProfile,
  abortSignal?: AbortSignal,
  contextMessages: ContextMessage[] = [],
  currentMessages: ContextMessage[] = [],
): Promise<ToolSet> => {
  const allProfiles = agentProfileManager.getProjectProfiles(task.project);
  const enabledSubagents = getEnabledSubagents(allProfiles, mainAgentProfile);

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
      description: z
        .string()
        .optional()
        .describe(
          'A short informational message describing what the subagent is doing, in continuous present tense (e.g., "Fixing the login bug"). This will be shown to the user while the subagent is working.',
        ),
    }),
    execute: async ({ prompt, subagentId, description }, { toolCallId }) => {
      const targetSubagent = findEnabledSubagent(enabledSubagents, subagentId);
      if (!targetSubagent) {
        return `Error: Subagent with ID '${subagentId}' not found or not enabled.`;
      }

      const result = await runSubagentTask({
        task,
        targetSubagent,
        prompt,
        description,
        abortSignal,
        contextMessages,
        currentMessages,
        onStarted: (promptContext) => {
          task.addToolMessage(
            toolCallId,
            SUBAGENTS_TOOL_GROUP_NAME,
            SUBAGENTS_TOOL_RUN_TASK,
            {
              prompt,
              subagentId,
              description,
            },
            undefined,
            undefined,
            promptContext,
          );
        },
      });

      if (result.status === 'cancelled') {
        return {
          messages: result.messages,
          promptContext: result.promptContext,
          cancelled: true,
        };
      }

      if (result.status === 'error') {
        return {
          error: result.error,
          promptContext: result.promptContext,
        };
      }

      return {
        messages: result.messages,
        promptContext: result.promptContext,
      };
    },
  });

  const toolSet: ToolSet = {};

  if (enabledSubagents.length > 0) {
    toolSet[`${SUBAGENTS_TOOL_GROUP_NAME}${TOOL_GROUP_NAME_SEPARATOR}${SUBAGENTS_TOOL_RUN_TASK}`] = runTaskTool;
  }

  return toolSet;
};
