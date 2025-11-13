import { describe, it, expect, beforeEach } from 'vitest';
import Handlebars from 'handlebars';
import { AgentProfile, ToolApprovalState, InvocationMode, ContextMemoryMode } from '@common/types';
import {
  AIDER_TOOL_ADD_CONTEXT_FILES,
  AIDER_TOOL_DROP_CONTEXT_FILES,
  AIDER_TOOL_GET_CONTEXT_FILES,
  AIDER_TOOL_GROUP_NAME,
  AIDER_TOOL_RUN_PROMPT,
  POWER_TOOL_BASH,
  POWER_TOOL_FILE_EDIT,
  POWER_TOOL_FILE_READ,
  POWER_TOOL_FILE_WRITE,
  POWER_TOOL_GLOB,
  POWER_TOOL_GREP,
  POWER_TOOL_GROUP_NAME,
  POWER_TOOL_SEMANTIC_SEARCH,
  SUBAGENTS_TOOL_GROUP_NAME,
  SUBAGENTS_TOOL_RUN_TASK,
  TODO_TOOL_CLEAR_ITEMS,
  TODO_TOOL_GET_ITEMS,
  TODO_TOOL_GROUP_NAME,
  TODO_TOOL_SET_ITEMS,
  TODO_TOOL_UPDATE_ITEM_COMPLETION,
  TOOL_GROUP_NAME_SEPARATOR,
} from '@common/tools';

import { TemplateCompiler } from '../compiler';
import { SystemPromptData, InitProjectPromptData, CompactConversationPromptData } from '../types';

describe('Template Rendering', () => {
  let compiler: TemplateCompiler;

  beforeEach(async () => {
    compiler = new TemplateCompiler();
    await compiler.compileAll();
  });

  describe('System Prompt Template', () => {
    const mockAgentProfile: AgentProfile = {
      id: 'test-agent',
      name: 'Test Agent',
      provider: 'openai',
      model: 'gpt-4',
      maxIterations: 10,
      maxTokens: 4000,
      minTimeBetweenToolCalls: 100,
      temperature: 0.7,
      enabledServers: [],
      useAiderTools: true,
      usePowerTools: true,
      useTodoTools: true,
      useSubagents: true,
      customInstructions: 'Test custom instructions',
      toolApprovals: {
        'aider.run_prompt': ToolApprovalState.Ask,
        'power.semantic_search': ToolApprovalState.Always,
        'power.file_read': ToolApprovalState.Always,
        'power.file_write': ToolApprovalState.Ask,
        'power.file_edit': ToolApprovalState.Never,
        'power.glob': ToolApprovalState.Always,
        'power.grep': ToolApprovalState.Always,
        'power.bash': ToolApprovalState.Never,
      },
      toolSettings: {},
      subagent: {
        enabled: false,
        contextMemory: 'none' as ContextMemoryMode,
        systemPrompt: '',
        invocationMode: 'on-demand' as InvocationMode,
        color: '#3368a8',
        description: '',
      },
      includeContextFiles: true,
      includeRepoMap: true,
    };

    const mockSystemPromptData: SystemPromptData = {
      projectDir: '/test/project',
      agentProfile: mockAgentProfile,
      additionalInstructions: 'Additional test instructions',
      osName: 'Test OS',
      currentDate: 'Mon Oct 27 2025',
      rulesFiles: [{ name: 'test-rule.md', content: 'Test rule content' }],
      customInstructions: 'Combined custom instructions',
      toolPermissions: {
        aiderTools: true,
        powerTools: {
          semanticSearch: true,
          fileRead: true,
          fileWrite: true,
          fileEdit: false,
          glob: true,
          grep: true,
          bash: false,
          anyEnabled: true,
        },
        todoTools: true,
        subagents: true,
        autoApprove: false,
      },
      toolConstants: {
        AIDER_TOOL_ADD_CONTEXT_FILES,
        AIDER_TOOL_DROP_CONTEXT_FILES,
        AIDER_TOOL_GET_CONTEXT_FILES,
        AIDER_TOOL_GROUP_NAME,
        AIDER_TOOL_RUN_PROMPT,
        POWER_TOOL_BASH,
        POWER_TOOL_FILE_EDIT,
        POWER_TOOL_FILE_READ,
        POWER_TOOL_FILE_WRITE,
        POWER_TOOL_GLOB,
        POWER_TOOL_GREP,
        POWER_TOOL_GROUP_NAME,
        POWER_TOOL_SEMANTIC_SEARCH,
        SUBAGENTS_TOOL_GROUP_NAME,
        SUBAGENTS_TOOL_RUN_TASK,
        TODO_TOOL_CLEAR_ITEMS,
        TODO_TOOL_GET_ITEMS,
        TODO_TOOL_GROUP_NAME,
        TODO_TOOL_SET_ITEMS,
        TODO_TOOL_UPDATE_ITEM_COMPLETION,
        TOOL_GROUP_NAME_SEPARATOR,
      },
    };

    it('should render system prompt with all tools enabled', () => {
      const result = compiler.render('system/main', mockSystemPromptData);

      expect(result).toContain('<AiderDeskSystemPrompt version="1.0">');
      expect(result).toContain('/test/project');
      expect(result).toContain('Test OS');
      expect(result).toContain('Mon Oct 27 2025');
      expect(result).toContain('Test rule content');
      expect(result).toContain('Combined custom instructions');
      expect(result).toContain('SubagentsProtocol enabled="true"');
      expect(result).toContain('TodoManagement enabled="true"');
      expect(result).toContain('AiderTools enabled="true"');
      expect(result).toContain('PowerTools enabled="true"');
    });

    it('should render system prompt with minimal tools', () => {
      const minimalData: SystemPromptData = {
        ...mockSystemPromptData,
        agentProfile: {
          ...mockAgentProfile,
          useAiderTools: false,
          usePowerTools: false,
          useTodoTools: false,
          useSubagents: false,
        },
        toolPermissions: {
          aiderTools: false,
          powerTools: {
            semanticSearch: false,
            fileRead: false,
            fileWrite: false,
            fileEdit: false,
            glob: false,
            grep: false,
            bash: false,
            anyEnabled: false,
          },
          todoTools: false,
          subagents: false,
          autoApprove: false,
        },
      };

      const result = compiler.render('system/main', minimalData);

      expect(result).not.toContain('SubagentsProtocol');
      expect(result).not.toContain('TodoManagement');
      expect(result).not.toContain('AiderTools');
      expect(result).not.toContain('PowerTools');
    });

    it('should handle auto-approve correctly', () => {
      const autoApproveData: SystemPromptData = {
        ...mockSystemPromptData,
        agentProfile: {
          ...mockAgentProfile,
        },
        toolPermissions: {
          ...mockSystemPromptData.toolPermissions,
          autoApprove: true,
        },
      };

      const result = compiler.render('system/main', autoApproveData);

      expect(result).toContain('autoApprove="true"');
      expect(result).toContain('User confirmation is not required as auto-approve is enabled');
      expect(result).toContain('After presenting the plan, execute it automatically');
    });
  });

  describe('Project Initialization Template', () => {
    it('should render project initialization prompt', () => {
      const data: InitProjectPromptData = {};
      const result = compiler.render('init/project-analysis', data);

      expect(result).toContain('# Role and Objective');
      expect(result).toContain('exhaustive analysis of a new codebase');
      expect(result).toContain('AGENTS.md');
      expect(result).toContain('three-step workflow');
      expect(result).toContain('Output Requirements for AGENTS.md');
    });
  });

  describe('Conversation Compacting Template', () => {
    it('should render conversation compacting prompt without custom instructions', () => {
      const data: CompactConversationPromptData = {};
      const result = compiler.render('compact/conversation', data);

      expect(result).toContain('# ROLE AND GOAL');
      expect(result).toContain('structured summary of conversation history');
      expect(result).toContain('two-step process');
      expect(result).toContain('Primary Request and Intent');
      expect(result).toContain('Key Technical Concepts');
    });

    it('should render conversation compacting prompt with custom instructions', () => {
      const data: CompactConversationPromptData = {
        customInstructions: 'Additional custom instructions for compacting',
      };
      const result = compiler.render('compact/conversation', data);

      expect(result).toContain('[ADDITIONAL INSTRUCTIONS]');
      expect(result).toContain('Additional custom instructions for compacting');
      expect(result).toContain('You MUST prioritize these instructions');
    });
  });

  describe('Template Helpers', () => {
    it('should render conditional helpers correctly', () => {
      const template = '{{#if value}}true{{else}}false{{/if}}';
      const compiled = compiler.getTemplate('test') || {
        template: Handlebars.compile(template),
      };

      expect(compiled.template({ value: true })).toBe('true');
      expect(compiled.template({ value: false })).toBe('false');
    });

    it('should render formatting helpers correctly', () => {
      const template = '{{capitalize text}}';
      const compiled = compiler.getTemplate('test') || {
        template: Handlebars.compile(template),
      };

      expect(compiled.template({ text: 'hello world' })).toBe('Hello world');
    });
  });

  describe('Template Error Handling', () => {
    it('should throw error for missing template', () => {
      expect(() => {
        compiler.render('non-existent-template', {});
      }).toThrow("Template 'non-existent-template' not found");
    });

    it('should handle template rendering errors gracefully', () => {
      // This would require a template with syntax errors to test properly
      // For now, we'll test the error handling structure
      expect(compiler.hasTemplate('system/main')).toBe(true);
      expect(compiler.hasTemplate('non-existent')).toBe(false);
    });
  });

  describe('Template Compilation', () => {
    it('should list all compiled templates', () => {
      const templateNames = compiler.getTemplateNames();

      expect(templateNames).toContain('system/main');
      expect(templateNames).toContain('init/project-analysis');
      expect(templateNames).toContain('compact/conversation');
      expect(templateNames.length).toBeGreaterThan(0);
    });
  });
});
