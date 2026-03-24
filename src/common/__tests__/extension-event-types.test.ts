import { describe, expect, expectTypeOf, it } from 'vitest';

import type { AgentProfile, ContextFile, Mode, PromptContext, ProviderProfile, QuestionData, ResponseCompletedData, TaskData } from '@common/types';
import type {
  AgentFinishedEvent,
  AgentStartedEvent,
  AgentStepFinishedEvent,
  AiderPromptFinishedEvent,
  AiderPromptStartedEvent,
  CommandExecutedEvent,
  CustomCommandExecutedEvent,
  Extension,
  ExtensionContext,
  FilesAddedEvent,
  FilesDroppedEvent,
  HandleApprovalEvent,
  PromptFinishedEvent,
  PromptStartedEvent,
  QuestionAnsweredEvent,
  QuestionAskedEvent,
  SubagentFinishedEvent,
  SubagentStartedEvent,
  TaskClosedEvent,
  TaskCreatedEvent,
  TaskInitializedEvent,
  TaskPreparedEvent,
  ToolApprovalEvent,
  ToolCalledEvent,
  ToolFinishedEvent,
} from '@common/extensions';

describe('Event Payload Interfaces', () => {
  describe('Task Events', () => {
    it('TaskCreatedEvent should have task field', () => {
      const event: TaskCreatedEvent = { task: {} as TaskData };
      expect(event).toHaveProperty('task');
    });

    it('TaskPreparedEvent should have task field', () => {
      const event: TaskPreparedEvent = { task: {} as TaskData };
      expect(event).toHaveProperty('task');
    });

    it('TaskInitializedEvent should have task field', () => {
      const event: TaskInitializedEvent = { task: {} as TaskData };
      expect(event).toHaveProperty('task');
    });

    it('TaskClosedEvent should have task field', () => {
      const event: TaskClosedEvent = { task: {} as TaskData };
      expect(event).toHaveProperty('task');
    });
  });

  describe('Prompt Events', () => {
    it('PromptStartedEvent should have prompt, mode, and promptContext fields', () => {
      const event: PromptStartedEvent = {
        prompt: 'test prompt',
        mode: 'agent' as Mode,
        promptContext: {} as PromptContext,
      };
      expect(event).toHaveProperty('prompt');
      expect(event).toHaveProperty('mode');
      expect(event).toHaveProperty('promptContext');
    });

    it('PromptStartedEvent should support optional blocked field', () => {
      const event: PromptStartedEvent = {
        prompt: 'test prompt',
        mode: 'agent' as Mode,
        promptContext: {} as PromptContext,
        blocked: true,
      };
      expect(event.blocked).toBe(true);
    });

    it('PromptFinishedEvent should have responses field', () => {
      const event: PromptFinishedEvent = {
        responses: [] as ResponseCompletedData[],
      };
      expect(event).toHaveProperty('responses');
    });
  });

  describe('Agent Events', () => {
    it('AgentStartedEvent should have required fields', () => {
      const event: AgentStartedEvent = {
        mode: 'agent',
        agentProfile: {} as AgentProfile,
        providerProfile: {} as ProviderProfile,
        model: 'gpt-4',
        prompt: 'test prompt',
        systemPrompt: undefined,
        contextMessages: [],
        contextFiles: [],
      };
      expect(event).toHaveProperty('agentProfile');
      expect(event).toHaveProperty('prompt');
      expect(event).toHaveProperty('systemPrompt');
      expect(event).toHaveProperty('contextMessages');
      expect(event).toHaveProperty('contextFiles');
    });

    it('AgentStartedEvent should support optional promptContext and blocked fields', () => {
      const event: AgentStartedEvent = {
        mode: 'agent',
        agentProfile: {} as AgentProfile,
        providerProfile: {} as ProviderProfile,
        model: 'gpt-4',
        prompt: null,
        promptContext: {} as PromptContext,
        systemPrompt: 'system',
        contextMessages: [],
        contextFiles: [],
        blocked: true,
      };
      expect(event.promptContext).toBeDefined();
      expect(event.blocked).toBe(true);
    });

    it('AgentFinishedEvent should have resultMessages field', () => {
      const event: AgentFinishedEvent = {
        mode: 'agent',
        resultMessages: [],
        aborted: false,
        contextMessages: [],
      };
      expect(event).toHaveProperty('resultMessages');
    });

    it('AgentStepFinishedEvent should have all required fields', () => {
      const event: AgentStepFinishedEvent = {
        mode: 'agent',
        agentProfile: {} as AgentProfile,
        currentResponseId: 'response-1',
        stepResult: {} as any,
        finishReason: 'stop',
        responseMessages: [],
      };
      expect(event).toHaveProperty('agentProfile');
      expect(event).toHaveProperty('currentResponseId');
      expect(event).toHaveProperty('stepResult');
      expect(event).toHaveProperty('finishReason');
      expect(event).toHaveProperty('responseMessages');
    });
  });

  describe('Tool Events', () => {
    it('ToolApprovalEvent should have toolName and input fields', () => {
      const event: ToolApprovalEvent = { toolName: 'test-tool', input: {} };
      expect(event).toHaveProperty('toolName');
      expect(event).toHaveProperty('input');
    });

    it('ToolApprovalEvent should support optional blocked and allowed fields', () => {
      const event: ToolApprovalEvent = {
        toolName: 'test-tool',
        input: {},
        blocked: true,
        allowed: false,
      };
      expect(event.blocked).toBe(true);
      expect(event.allowed).toBe(false);
    });

    it('ToolCalledEvent should have toolName and input fields', () => {
      const event: ToolCalledEvent = {
        toolName: 'test-tool',
        input: undefined,
      };
      expect(event).toHaveProperty('toolName');
      expect(event).toHaveProperty('input');
    });

    it('ToolCalledEvent should support optional output field', () => {
      const event: ToolCalledEvent = {
        toolName: 'test-tool',
        input: {},
        output: 'result',
      };
      expect(event.output).toBe('result');
    });

    it('ToolFinishedEvent should have toolName, input, and output fields', () => {
      const event: ToolFinishedEvent = {
        toolName: 'test-tool',
        input: {},
        output: 'success',
      };
      expect(event).toHaveProperty('toolName');
      expect(event).toHaveProperty('input');
      expect(event).toHaveProperty('output');
    });
  });

  describe('File Events', () => {
    it('FilesAddedEvent should have files field', () => {
      const event: FilesAddedEvent = { files: [{} as ContextFile] };
      expect(event).toHaveProperty('files');
    });

    it('FilesAddedEvent should support empty files array', () => {
      const event: FilesAddedEvent = { files: [] };
      expect(event.files).toHaveLength(0);
    });

    it('FilesDroppedEvent should have files field', () => {
      const event: FilesDroppedEvent = { files: [{} as ContextFile] };
      expect(event).toHaveProperty('files');
    });

    it('FilesDroppedEvent should support empty files array', () => {
      const event: FilesDroppedEvent = { files: [] };
      expect(event.files).toHaveLength(0);
    });
  });

  describe('Approval Events', () => {
    it('HandleApprovalEvent should have key and text fields', () => {
      const event: HandleApprovalEvent = {
        key: 'approval-key',
        text: 'Approval text',
      };
      expect(event).toHaveProperty('key');
      expect(event).toHaveProperty('text');
    });

    it('HandleApprovalEvent should have optional subject field', () => {
      const event: HandleApprovalEvent = {
        key: 'approval-key',
        text: 'Approval text',
        subject: 'Subject',
      };
      expect(event.subject).toBe('Subject');
    });

    it('HandleApprovalEvent should support optional blocked and allowed fields', () => {
      const event: HandleApprovalEvent = {
        key: 'approval-key',
        text: 'Approval text',
        blocked: true,
        allowed: false,
      };
      expect(event.blocked).toBe(true);
      expect(event.allowed).toBe(false);
    });
  });

  describe('Subagent Events', () => {
    it('SubagentStartedEvent should have required fields', () => {
      const event: SubagentStartedEvent = {
        subagentProfile: {} as AgentProfile,
        prompt: 'test prompt',
        contextMessages: [],
        contextFiles: [],
      };
      expect(event).toHaveProperty('subagentProfile');
      expect(event).toHaveProperty('prompt');
      expect(event).toHaveProperty('contextMessages');
      expect(event).toHaveProperty('contextFiles');
    });

    it('SubagentStartedEvent should support optional fields', () => {
      const event: SubagentStartedEvent = {
        subagentProfile: {} as AgentProfile,
        prompt: 'test prompt',
        promptContext: {} as PromptContext,
        contextMessages: [],
        contextFiles: [],
        systemPrompt: 'system',
        blocked: true,
      };
      expect(event.promptContext).toBeDefined();
      expect(event.systemPrompt).toBe('system');
      expect(event.blocked).toBe(true);
    });

    it('SubagentFinishedEvent should have subagentProfile and resultMessages fields', () => {
      const event: SubagentFinishedEvent = {
        subagentProfile: {} as AgentProfile,
        resultMessages: [],
      };
      expect(event).toHaveProperty('subagentProfile');
      expect(event).toHaveProperty('resultMessages');
    });
  });

  describe('Question Events', () => {
    it('QuestionAskedEvent should have question field', () => {
      const event: QuestionAskedEvent = { question: {} as QuestionData };
      expect(event).toHaveProperty('question');
    });

    it('QuestionAskedEvent should support optional answer field', () => {
      const event: QuestionAskedEvent = {
        question: {} as QuestionData,
        answer: 'answer',
      };
      expect(event.answer).toBe('answer');
    });

    it('QuestionAnsweredEvent should have question, answer fields', () => {
      const event: QuestionAnsweredEvent = {
        question: {} as QuestionData,
        answer: 'user answer',
      };
      expect(event).toHaveProperty('question');
      expect(event).toHaveProperty('answer');
    });

    it('QuestionAnsweredEvent should have optional userInput field', () => {
      const event: QuestionAnsweredEvent = {
        question: {} as QuestionData,
        answer: 'answer',
        userInput: 'raw input',
      };
      expect(event.userInput).toBe('raw input');
    });
  });

  describe('Command Events', () => {
    it('CommandExecutedEvent should have command field', () => {
      const event: CommandExecutedEvent = { command: '/help' };
      expect(event).toHaveProperty('command');
    });

    it('CommandExecutedEvent should support optional blocked field', () => {
      const event: CommandExecutedEvent = { command: '/help', blocked: true };
      expect(event.blocked).toBe(true);
    });

    it('CustomCommandExecutedEvent should have command and mode fields', () => {
      const event: CustomCommandExecutedEvent = {
        command: {} as any,
        mode: 'agent' as Mode,
      };
      expect(event).toHaveProperty('command');
      expect(event).toHaveProperty('mode');
    });

    it('CustomCommandExecutedEvent should support optional fields', () => {
      const event: CustomCommandExecutedEvent = {
        command: {} as any,
        mode: 'agent' as Mode,
        blocked: true,
        prompt: 'custom prompt',
      };
      expect(event.blocked).toBe(true);
      expect(event.prompt).toBe('custom prompt');
    });
  });

  describe('Aider Events (Legacy)', () => {
    it('AiderPromptStartedEvent should have required fields', () => {
      const event: AiderPromptStartedEvent = {
        prompt: 'test prompt',
        mode: 'aider' as Mode,
        promptContext: {} as PromptContext,
        messages: [],
        files: [],
      };
      expect(event).toHaveProperty('prompt');
      expect(event).toHaveProperty('mode');
      expect(event).toHaveProperty('promptContext');
      expect(event).toHaveProperty('messages');
      expect(event).toHaveProperty('files');
    });

    it('AiderPromptStartedEvent should support optional fields', () => {
      const event: AiderPromptStartedEvent = {
        prompt: 'test prompt',
        mode: 'aider' as Mode,
        promptContext: {} as PromptContext,
        messages: [],
        files: [],
        blocked: true,
        autoApprove: true,
        denyCommands: true,
      };
      expect(event.blocked).toBe(true);
      expect(event.autoApprove).toBe(true);
      expect(event.denyCommands).toBe(true);
    });

    it('AiderPromptFinishedEvent should have responses field', () => {
      const event: AiderPromptFinishedEvent = {
        responses: [] as ResponseCompletedData[],
      };
      expect(event).toHaveProperty('responses');
    });
  });
});

describe('Extension Interface Event Handlers', () => {
  const mockContext = {} as ExtensionContext;

  describe('Task Events', () => {
    it('should have optional onTaskCreated handler', () => {
      const extension: Extension = {};
      expect(extension.onTaskCreated).toBeUndefined();
    });

    it('onTaskCreated should accept TaskCreatedEvent and return Promise', async () => {
      const extension: Extension = {
        async onTaskCreated(event, context) {
          expect(event.task).toBeDefined();
          expect(context).toBe(mockContext);
        },
      };
      await extension.onTaskCreated!({ task: {} as TaskData }, mockContext);
    });

    it('should have optional onTaskPrepared handler', () => {
      const extension: Extension = {};
      expect(extension.onTaskPrepared).toBeUndefined();
    });

    it('should have optional onTaskInitialized handler', () => {
      const extension: Extension = {};
      expect(extension.onTaskInitialized).toBeUndefined();
    });

    it('should have optional onTaskClosed handler', () => {
      const extension: Extension = {};
      expect(extension.onTaskClosed).toBeUndefined();
    });
  });

  describe('Prompt Events', () => {
    it('should have optional onPromptStarted handler', () => {
      const extension: Extension = {};
      expect(extension.onPromptStarted).toBeUndefined();
    });

    it('should have optional onPromptFinished handler', () => {
      const extension: Extension = {};
      expect(extension.onPromptFinished).toBeUndefined();
    });
  });

  describe('Agent Events', () => {
    it('should have optional onAgentStarted handler', () => {
      const extension: Extension = {};
      expect(extension.onAgentStarted).toBeUndefined();
    });

    it('should have optional onAgentFinished handler', () => {
      const extension: Extension = {};
      expect(extension.onAgentFinished).toBeUndefined();
    });

    it('should have optional onAgentStepFinished handler', () => {
      const extension: Extension = {};
      expect(extension.onAgentStepFinished).toBeUndefined();
    });
  });

  describe('Tool Events', () => {
    it('should have optional onToolApproval handler', () => {
      const extension: Extension = {};
      expect(extension.onToolApproval).toBeUndefined();
    });

    it('should have optional onToolCalled handler', () => {
      const extension: Extension = {};
      expect(extension.onToolCalled).toBeUndefined();
    });

    it('should have optional onToolFinished handler', () => {
      const extension: Extension = {};
      expect(extension.onToolFinished).toBeUndefined();
    });
  });

  describe('File Events', () => {
    it('should have optional onFilesAdded handler', () => {
      const extension: Extension = {};
      expect(extension.onFilesAdded).toBeUndefined();
    });

    it('should have optional onFilesDropped handler', () => {
      const extension: Extension = {};
      expect(extension.onFilesDropped).toBeUndefined();
    });
  });

  describe('Approval Events', () => {
    it('should have optional onHandleApproval handler', () => {
      const extension: Extension = {};
      expect(extension.onHandleApproval).toBeUndefined();
    });
  });

  describe('Subagent Events', () => {
    it('should have optional onSubagentStarted handler', () => {
      const extension: Extension = {};
      expect(extension.onSubagentStarted).toBeUndefined();
    });

    it('should have optional onSubagentFinished handler', () => {
      const extension: Extension = {};
      expect(extension.onSubagentFinished).toBeUndefined();
    });
  });

  describe('Question Events', () => {
    it('should have optional onQuestionAsked handler', () => {
      const extension: Extension = {};
      expect(extension.onQuestionAsked).toBeUndefined();
    });

    it('should have optional onQuestionAnswered handler', () => {
      const extension: Extension = {};
      expect(extension.onQuestionAnswered).toBeUndefined();
    });
  });

  describe('Command Events', () => {
    it('should have optional onCommandExecuted handler', () => {
      const extension: Extension = {};
      expect(extension.onCommandExecuted).toBeUndefined();
    });

    it('should have optional onCustomCommandExecuted handler', () => {
      const extension: Extension = {};
      expect(extension.onCustomCommandExecuted).toBeUndefined();
    });
  });

  describe('Aider Events (Legacy)', () => {
    it('should have optional onAiderPromptStarted handler', () => {
      const extension: Extension = {};
      expect(extension.onAiderPromptStarted).toBeUndefined();
    });

    it('should have optional onAiderPromptFinished handler', () => {
      const extension: Extension = {};
      expect(extension.onAiderPromptFinished).toBeUndefined();
    });
  });
});

describe('Event Modification Pattern', () => {
  const mockContext = {} as ExtensionContext;

  it('event handlers can return void', async () => {
    const handler = async () => {};
    const result = await handler();
    expect(result).toBeUndefined();
  });

  it('event handlers can return partial event for TaskCreatedEvent', async () => {
    const extension: Extension = {
      async onTaskCreated(event) {
        return { task: { ...event.task, id: 'modified-id' } as TaskData };
      },
    };
    const result = await extension.onTaskCreated!({ task: { id: 'original' } as TaskData }, mockContext);
    expect(result?.task?.id).toBe('modified-id');
  });

  it('event handlers can return partial event for PromptStartedEvent', async () => {
    const extension: Extension = {
      async onPromptStarted(event) {
        return { prompt: event.prompt + ' [modified]' };
      },
    };
    const result = await extension.onPromptStarted!(
      {
        prompt: 'test',
        mode: 'agent' as Mode,
        promptContext: {} as PromptContext,
      },
      mockContext,
    );
    expect(result?.prompt).toBe('test [modified]');
  });

  it('event handlers can modify responses in PromptFinishedEvent', async () => {
    const extension: Extension = {
      async onPromptFinished(event) {
        return { responses: [...event.responses, {} as ResponseCompletedData] };
      },
    };
    const result = await extension.onPromptFinished!({ responses: [] }, mockContext);
    expect(result?.responses).toHaveLength(1);
  });

  it('event handlers can modify tool result in ToolFinishedEvent', async () => {
    const extension: Extension = {
      async onToolFinished(_event) {
        return { output: 'modified result' };
      },
    };
    const result = await extension.onToolFinished!({ toolName: 'test', input: {}, output: 'original' }, mockContext);
    expect(result?.output).toBe('modified result');
  });
});

describe('Blocking Events', () => {
  const mockContext = {} as ExtensionContext;

  describe('ToolApprovalEvent', () => {
    it('should support blocked field', () => {
      const event: ToolApprovalEvent = {
        toolName: 'dangerous-tool',
        input: {},
        blocked: true,
      };
      expect(event.blocked).toBe(true);
    });

    it('extension can return blocked to prevent execution', async () => {
      const extension: Extension = {
        async onToolApproval(event): Promise<void | Partial<ToolApprovalEvent>> {
          if (event.toolName === 'dangerous-tool') {
            return { blocked: true };
          }
          return;
        },
      };
      const result = await extension.onToolApproval!({ toolName: 'dangerous-tool', input: {} }, mockContext);
      expect(result?.blocked).toBe(true);
    });
  });

  describe('PromptStartedEvent', () => {
    it('should support blocked field', () => {
      const event: PromptStartedEvent = {
        prompt: 'dangerous prompt',
        mode: 'agent' as Mode,
        promptContext: {} as PromptContext,
        blocked: true,
      };
      expect(event.blocked).toBe(true);
    });

    it('extension can return blocked to prevent prompt processing', async () => {
      const extension: Extension = {
        async onPromptStarted(event): Promise<void | Partial<PromptStartedEvent>> {
          if (event.prompt.includes('dangerous')) {
            return { blocked: true };
          }
          return;
        },
      };
      const result = await extension.onPromptStarted!(
        {
          prompt: 'dangerous prompt',
          mode: 'agent' as Mode,
          promptContext: {} as PromptContext,
        },
        mockContext,
      );
      expect(result?.blocked).toBe(true);
    });
  });

  describe('HandleApprovalEvent', () => {
    it('should support blocked field', () => {
      const event: HandleApprovalEvent = {
        key: 'approval-key',
        text: 'Approval text',
        blocked: true,
      };
      expect(event.blocked).toBe(true);
    });

    it('extension can return blocked to prevent approval handling', async () => {
      const extension: Extension = {
        async onHandleApproval(event): Promise<void | Partial<HandleApprovalEvent>> {
          if (event.key === 'restricted') {
            return { blocked: true };
          }
          return;
        },
      };
      const result = await extension.onHandleApproval!({ key: 'restricted', text: 'Approval text' }, mockContext);
      expect(result?.blocked).toBe(true);
    });
  });

  describe('SubagentStartedEvent', () => {
    it('should support blocked field', () => {
      const event: SubagentStartedEvent = {
        subagentProfile: {} as AgentProfile,
        prompt: 'test prompt',
        contextMessages: [],
        contextFiles: [],
        blocked: true,
      };
      expect(event.blocked).toBe(true);
    });

    it('extension can return blocked to prevent subagent spawning', async () => {
      const extension: Extension = {
        async onSubagentStarted(event): Promise<void | Partial<SubagentStartedEvent>> {
          if (event.subagentProfile.id === 'restricted-agent') {
            return { blocked: true };
          }
          return;
        },
      };
      const result = await extension.onSubagentStarted!(
        {
          subagentProfile: { id: 'restricted-agent' } as AgentProfile,
          prompt: 'test',
          contextMessages: [],
          contextFiles: [],
        },
        mockContext,
      );
      expect(result?.blocked).toBe(true);
    });
  });

  describe('FilesAddedEvent', () => {
    it('extension can return empty files array to prevent addition', async () => {
      const extension: Extension = {
        async onFilesAdded(_event): Promise<void | Partial<FilesAddedEvent>> {
          return { files: [] };
        },
      };
      const result = await extension.onFilesAdded!({ files: [{} as ContextFile] }, mockContext);
      expect(result?.files).toHaveLength(0);
    });

    it('extension can modify files array to filter files', async () => {
      const extension: Extension = {
        async onFilesAdded(event): Promise<void | Partial<FilesAddedEvent>> {
          return { files: event.files.filter((f) => f.path !== '/secret.txt') };
        },
      };
      const result = await extension.onFilesAdded!(
        {
          files: [{ path: '/allowed.txt' } as ContextFile, { path: '/secret.txt' } as ContextFile],
        },
        mockContext,
      );
      expect(result?.files).toHaveLength(1);
    });
  });

  describe('FilesDroppedEvent', () => {
    it('extension can return empty files array to prevent drop', async () => {
      const extension: Extension = {
        async onFilesDropped(_event): Promise<void | Partial<FilesDroppedEvent>> {
          return { files: [] };
        },
      };
      const result = await extension.onFilesDropped!({ files: [{} as ContextFile] }, mockContext);
      expect(result?.files).toHaveLength(0);
    });

    it('extension can modify files array to add more files', async () => {
      const extension: Extension = {
        async onFilesDropped(event): Promise<void | Partial<FilesDroppedEvent>> {
          return {
            files: [...event.files, { path: '/extra.txt' } as ContextFile],
          };
        },
      };
      const result = await extension.onFilesDropped!({ files: [{ path: '/original.txt' } as ContextFile] }, mockContext);
      expect(result?.files).toHaveLength(2);
    });
  });
});

describe('Return Type Validation', () => {
  it('all event handlers return Promise<void | Partial<Event>>', () => {
    type HandlerReturn<T> = Promise<void | Partial<T>>;

    expectTypeOf<TaskCreatedEvent['task']>().not.toBeAny();
    expectTypeOf<HandlerReturn<TaskCreatedEvent>>().toMatchTypeOf<Promise<void | Partial<TaskCreatedEvent>>>();
    expectTypeOf<HandlerReturn<PromptStartedEvent>>().toMatchTypeOf<Promise<void | Partial<PromptStartedEvent>>>();
    expectTypeOf<HandlerReturn<ToolApprovalEvent>>().toMatchTypeOf<Promise<void | Partial<ToolApprovalEvent>>>();
  });
});
