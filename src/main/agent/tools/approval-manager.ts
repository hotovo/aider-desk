import { AgentProfile, AutonomyMode, BashToolSettings, QuestionData, ToolApprovalState } from '@common/types';
import { ProviderToolApprovalHandler } from '@common/extensions';
import { POWER_TOOL_BASH, POWER_TOOL_GROUP_NAME, TOOL_GROUP_NAME_SEPARATOR } from '@common/tools';

import type { ToolSet } from 'ai';

import { Task } from '@/task';

const isAutoApprove = (task: Task): boolean => {
  return task.task.autonomyMode !== AutonomyMode.Manual;
};

export class ApprovalManager {
  private alwaysApproveForRunKeys: Set<string> = new Set();

  constructor(
    private readonly task: Task,
    private readonly profile: AgentProfile,
  ) {}

  createProviderToolApprovalHandler(tools: ToolSet): ProviderToolApprovalHandler {
    return async (toolName, input, text, subject) => {
      if (!tools[toolName] || this.profile.toolApprovals[toolName] === ToolApprovalState.Never) {
        return [false, `Tool '${toolName}' is disabled.`];
      }
      let approvedBySettings = false;
      if (toolName === `${POWER_TOOL_GROUP_NAME}${TOOL_GROUP_NAME_SEPARATOR}${POWER_TOOL_BASH}`) {
        if (typeof input.command !== 'string') {
          return [false, 'A bash command is required.'];
        }
        const command = input.command;
        const settings = this.profile.toolSettings?.[toolName] as BashToolSettings | undefined;
        const matches = (patterns?: string) =>
          patterns
            ?.split(';')
            .filter(Boolean)
            .some((pattern) => new RegExp(pattern).test(command));
        if (matches(settings?.deniedPattern)) {
          return [false, 'Bash command denied by Power bash settings. Do not work around this rejection.'];
        }
        approvedBySettings = !!matches(settings?.allowedPattern);
      }
      return this.handleToolApproval(toolName, input, toolName, text, subject, approvedBySettings);
    };
  }

  async handleToolApproval(
    toolName: string,
    input: Record<string, unknown> | undefined,
    key: string,
    text: string,
    subject?: string,
    approvedBySettings = false,
  ): Promise<[boolean, string | undefined]> {
    const extensionResult = await this.task.dispatchExtensionEvent('onToolApproval', { toolName, input });
    if (extensionResult.blocked) {
      return [false, typeof extensionResult.blocked === 'string' ? extensionResult.blocked : undefined];
    }
    if (extensionResult.allowed) {
      return [true, undefined];
    }

    return this.handleApproval(key, text, subject, approvedBySettings);
  }

  async handleApproval(key: string, text: string, subject?: string, approvedBySettings = false): Promise<[boolean, string | undefined]> {
    const extensionResult = await this.task.dispatchExtensionEvent('onHandleApproval', { key, text, subject });
    if (extensionResult.blocked) {
      return [false, undefined];
    }
    if (extensionResult.allowed) {
      return [true, undefined];
    }
    key = extensionResult.key;
    text = extensionResult.text;
    subject = extensionResult.subject;

    if (approvedBySettings || isAutoApprove(this.task)) {
      return [true, undefined]; // Auto-approve
    }

    const isApprovedFromSet =
      this.alwaysApproveForRunKeys.has(key) || (this.profile.toolApprovals[key] || ToolApprovalState.Always) === ToolApprovalState.Always;
    if (isApprovedFromSet) {
      return [true, undefined]; // Pre-approved
    }

    const questionData: QuestionData = {
      baseDir: this.task.getProjectDir(),
      taskId: this.task.taskId,
      text,
      subject,
      defaultAnswer: 'y',
      answers: [
        { text: '(Y)es', shortkey: 'y' },
        { text: '(N)o', shortkey: 'n' },
        { text: '(A)lways', shortkey: 'a' },
        { text: 'Always for This (R)un', shortkey: 'r' },
      ],
      key,
    };

    const [answer, userInput] = await this.task.askQuestion(questionData);

    if (answer === 'r') {
      this.alwaysApproveForRunKeys.add(key);
      return [true, undefined]; // Approved and remember for this run
    }

    if (answer === 'y' || answer === 'a') {
      return [true, undefined]; // Approved for this instance
    }

    return [false, userInput]; // Not approved
  }
}
