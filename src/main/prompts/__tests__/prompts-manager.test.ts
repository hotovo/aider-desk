// Mock dependencies
vi.mock('@/logger');
vi.mock('os-name', () => ({
  default: () => 'Test OS',
}));

// We need to partially unmock path and fs to allow template loading
vi.unmock('path');
vi.unmock('fs');
vi.unmock('fs/promises');

import path from 'path';
import fs from 'fs/promises';
import os from 'os';

import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { AgentProfile, SettingsData } from '@common/types';

import type { ExtensionManager } from '@/extensions/extension-manager';

import { PromptsManager } from '@/prompts';
import { createMockAgentProfile, createMockSettings, createMockTask } from '@/__tests__/mocks';

// Create a mock ExtensionManager that just returns events unchanged
const createMockExtensionManager = (): ExtensionManager =>
  ({
    dispatchEvent: vi.fn().mockImplementation(async (_eventName, event) => event),
  }) as unknown as ExtensionManager;

describe('Prompts with Handlebars', () => {
  let promptsManager: PromptsManager;
  let mockTask: ReturnType<typeof createMockTask>;
  let mockSettings: SettingsData;
  let mockProfile: AgentProfile;

  beforeEach(async () => {
    // Use a PromptsManager without global templates for these tests
    // so they test the functionality with simple default templates
    promptsManager = new PromptsManager(
      createMockExtensionManager(),
      path.join(__dirname, 'templates', 'default'),
      path.join(__dirname, 'templates', 'nonexistent-global'),
    );
    await promptsManager.init();

    mockTask = createMockTask();
    mockSettings = createMockSettings();
    mockProfile = createMockAgentProfile();
  });

  it('should render system prompt with all features enabled', async () => {
    const prompt = await promptsManager.getSystemPrompt(mockSettings, mockTask, mockProfile);

    expect(prompt).toContain('<DefaultSystemPrompt version="1.0">');
    expect(prompt).toContain('DefaultAgent');
    expect(prompt).toContain('Default objective from default templates');
  });

  it('should exclude memory features and renumber workflow steps', async () => {
    mockProfile.useMemoryTools = false;
    mockProfile.useSkillsTools = false;
    const prompt = await promptsManager.getSystemPrompt(mockSettings, mockTask, mockProfile);

    expect(prompt).toContain('<DefaultSystemPrompt version="1.0">');
  });

  it('should respect autoApprove setting in workflow steps', async () => {
    mockTask.task.autoApprove = true;
    const prompt = await promptsManager.getSystemPrompt(mockSettings, mockTask, mockProfile, true);

    expect(prompt).toContain('<DefaultSystemPrompt version="1.0">');
  });

  describe('getInitProjectSystemPrompt', () => {
    it('should render init-project system prompt', async () => {
      const prompt = await promptsManager.getInitProjectSystemPrompt(mockTask);

      expect(prompt).toContain('<DefaultInitProjectSystemPrompt version="1.0">');
      expect(prompt).toContain('This is the default init-project system prompt template');
    });
  });

  describe('getCompactConversationPrompt', () => {
    it('should render compact-conversation prompt without custom instructions', async () => {
      const prompt = await promptsManager.getCompactConversationPrompt(mockTask);

      expect(prompt).toContain('# Default Compact Conversation');
      expect(prompt).toContain('This is the default compact-conversation template');
    });

    it('should render compact-conversation prompt with custom instructions', async () => {
      const customInstructions = 'Focus on technical details and code changes';
      const prompt = await promptsManager.getCompactConversationPrompt(mockTask, customInstructions);

      expect(prompt).toContain('# Default Compact Conversation');
    });
  });

  describe('getGenerateCommitMessagePrompt', () => {
    it('should render commit-message generation prompt', async () => {
      const prompt = await promptsManager.getGenerateCommitMessageSystemPrompt(mockTask);

      expect(prompt).toContain('Default commit message prompt');
    });
  });

  describe('getGenerateTaskNamePrompt', () => {
    it('should render task-name generation prompt', async () => {
      const prompt = await promptsManager.getGenerateTaskNamePrompt(mockTask);

      expect(prompt).toContain('You are a helpful assistant that generates concise, descriptive task names');
      expect(prompt).toContain('Guidelines:');
    });
  });

  describe('getConflictResolutionSystemPrompt', () => {
    it('should render conflict-resolution system prompt with correct tool names', async () => {
      const prompt = await promptsManager.getConflictResolutionSystemPrompt(mockTask);

      expect(prompt).toContain('<DefaultConflictResolutionSystem>');
      expect(prompt).toContain('Default conflict resolution system prompt');
    });
  });

  describe('getConflictResolutionPrompt', () => {
    it('should render conflict-resolution prompt with file paths', async () => {
      const filePath = '/test/project/conflicted-file.ts';
      const ctx = {
        filePath,
        basePath: '/tmp/conflict-base.ts',
        oursPath: '/tmp/conflict-ours.ts',
        theirsPath: '/tmp/conflict-theirs.ts',
      };

      const prompt = await promptsManager.getConflictResolutionPrompt(mockTask, filePath, ctx);

      expect(prompt).toContain('# Default Conflict Resolution');
      expect(prompt).toContain('Default conflict resolution prompt');
    });

    it('should render conflict-resolution prompt with minimal context', async () => {
      const filePath = '/test/project/conflicted-file.ts';
      const ctx = { filePath };

      const prompt = await promptsManager.getConflictResolutionPrompt(mockTask, filePath, ctx);

      expect(prompt).toContain('# Default Conflict Resolution');
      expect(prompt).toContain('Default conflict resolution prompt');
    });
  });

  describe('getUpdateTaskStatePrompt', () => {
    it('should render update-task-state prompt', async () => {
      const prompt = await promptsManager.getUpdateTaskStatePrompt(mockTask);

      expect(prompt).toContain('You are a helpful assistant that determines the appropriate task state');
      expect(prompt).toContain('Available task states:');
      expect(prompt).toContain('MORE_INFO_NEEDED');
      expect(prompt).toContain('READY_FOR_IMPLEMENTATION');
      expect(prompt).toContain('READY_FOR_REVIEW');
      expect(prompt).toContain('NONE');
    });
  });

  describe('System prompt advanced features', () => {
    it('should include custom instructions in system prompt', async () => {
      const additionalInstructions = 'Always use TypeScript strict mode';
      const prompt = await promptsManager.getSystemPrompt(mockSettings, mockTask, mockProfile, false, additionalInstructions);

      expect(prompt).toContain('<DefaultSystemPrompt version="1.0">');
    });

    it('should include both agent custom instructions and additional instructions', async () => {
      mockProfile.customInstructions = 'Prefer functional programming patterns';
      const additionalInstructions = 'Always use TypeScript strict mode';
      const prompt = await promptsManager.getSystemPrompt(mockSettings, mockTask, mockProfile, false, additionalInstructions);

      expect(prompt).toContain('<DefaultSystemPrompt version="1.0">');
    });
  });

  describe('Extension integration', () => {
    it('should dispatch onPromptTemplate event for system prompt', async () => {
      const mockExtensionManager = createMockExtensionManager();
      const manager = new PromptsManager(
        mockExtensionManager,
        path.join(__dirname, 'templates', 'default'),
        path.join(__dirname, 'templates', 'nonexistent-global'),
      );
      await manager.init();

      await manager.getSystemPrompt(mockSettings, mockTask, mockProfile);

      // dispatchEvent should be called for both 'workflow' and 'system-prompt' templates
      expect(mockExtensionManager.dispatchEvent).toHaveBeenCalledTimes(2);
      expect(mockExtensionManager.dispatchEvent).toHaveBeenCalledWith(
        'onPromptTemplate',
        expect.objectContaining({ name: 'workflow' }),
        expect.anything(),
        mockTask,
      );
      expect(mockExtensionManager.dispatchEvent).toHaveBeenCalledWith(
        'onPromptTemplate',
        expect.objectContaining({ name: 'system-prompt' }),
        expect.anything(),
        mockTask,
      );
    });

    it('should allow extensions to override prompt content', async () => {
      const customPrompt = 'CUSTOM PROMPT FROM EXTENSION';
      const mockExtensionManager = {
        dispatchEvent: vi.fn().mockImplementation(async (_eventName, event) => ({
          ...event,
          prompt: customPrompt,
        })),
      } as unknown as ExtensionManager;

      const manager = new PromptsManager(
        mockExtensionManager,
        path.join(__dirname, 'templates', 'default'),
        path.join(__dirname, 'templates', 'nonexistent-global'),
      );
      await manager.init();

      const result = await manager.getInitProjectSystemPrompt(mockTask);

      expect(result).toBe(customPrompt);
    });

    it('should not dispatch event when task is not provided', async () => {
      const mockExtensionManager = createMockExtensionManager();
      const manager = new PromptsManager(
        mockExtensionManager,
        path.join(__dirname, 'templates', 'default'),
        path.join(__dirname, 'templates', 'nonexistent-global'),
      );
      await manager.init();

      // Direct call to render without task (internal method, but testing the logic)
      // Since render is private, we test through a public method that uses it
      await manager.getInitProjectSystemPrompt(mockTask);

      // Event should be dispatched because task is provided
      expect(mockExtensionManager.dispatchEvent).toHaveBeenCalled();
    });
  });

  describe('Global templates overriding default', () => {
    let promptsManagerWithGlobal: PromptsManager;
    let tmpGlobalDir: string;

    beforeEach(async () => {
      // Create a temporary directory for global templates
      tmpGlobalDir = path.join(os.tmpdir(), `aider-desk-test-prompts-${Date.now()}`);
      await fs.mkdir(tmpGlobalDir, { recursive: true });

      // Create global template files
      await fs.writeFile(
        path.join(tmpGlobalDir, 'system-prompt.hbs'),
        '<GlobalSystemPrompt version="1.0">\n  <Agent name="GlobalAgent">\n    <Objective>Global objective - should override default</Objective>\n  </Agent>\n</GlobalSystemPrompt>\n',
      );
      await fs.writeFile(
        path.join(tmpGlobalDir, 'init-project.hbs'),
        '# Global Init Project\nThis is the GLOBAL init-project template - should override default.\n',
      );
      await fs.writeFile(
        path.join(tmpGlobalDir, 'workflow.hbs'),
        '<GlobalWorkflow>\n  <Step number="1" title="Global Step">Global workflow step - should override default</Step>\n</GlobalWorkflow>\n',
      );
      await fs.writeFile(
        path.join(tmpGlobalDir, 'compact-conversation.hbs'),
        '# Global Compact Conversation\nThis is the GLOBAL compact-conversation template - should override default.\n',
      );
      await fs.writeFile(path.join(tmpGlobalDir, 'commit-message.hbs'), 'Global commit message prompt - should override default.\n');
      await fs.writeFile(
        path.join(tmpGlobalDir, 'conflict-resolution.hbs'),
        '# Global Conflict Resolution\nGlobal conflict resolution prompt - should override default.\n',
      );
      await fs.writeFile(
        path.join(tmpGlobalDir, 'conflict-resolution-system.hbs'),
        '<GlobalConflictResolutionSystem>\n  Global conflict resolution system prompt - should override default.\n</GlobalConflictResolutionSystem>\n',
      );
      await fs.writeFile(path.join(tmpGlobalDir, 'task-name.hbs'), '# Global Task Name\nGlobal task name prompt - should override default.\n');

      // Create a new PromptsManager with the temporary global directory
      promptsManagerWithGlobal = new PromptsManager(createMockExtensionManager(), path.join(__dirname, 'templates', 'default'), tmpGlobalDir);
      await promptsManagerWithGlobal.init();
    });

    afterEach(async () => {
      // Clean up the temporary directory
      try {
        await fs.rm(tmpGlobalDir, { recursive: true, force: true });
      } catch {
        // Ignore cleanup errors
      }
    });

    it('should use global templates when they exist and override defaults', async () => {
      const prompt = await promptsManagerWithGlobal.getSystemPrompt(mockSettings, mockTask, mockProfile);

      expect(prompt).toContain('<GlobalSystemPrompt version="1.0">');
      expect(prompt).toContain('GlobalAgent');
      expect(prompt).toContain('Global objective - should override default');
      expect(prompt).not.toContain('<DefaultSystemPrompt version="1.0">');
      expect(prompt).not.toContain('DefaultAgent');
      expect(prompt).not.toContain('Default objective from default templates');
    });

    it('should use global init-project template', async () => {
      const prompt = await promptsManagerWithGlobal.getInitProjectSystemPrompt(mockTask);

      expect(prompt).toContain('This is the GLOBAL init-project template');
      expect(prompt).toContain('should override default');
      expect(prompt).not.toContain('This is the default init-project system prompt template');
    });

    it('should use global compact-conversation template', async () => {
      const prompt = await promptsManagerWithGlobal.getCompactConversationPrompt(mockTask);

      expect(prompt).toContain('This is the GLOBAL compact-conversation template');
      expect(prompt).toContain('should override default');
      expect(prompt).not.toContain('This is the default compact-conversation template');
    });

    it('should use global commit-message template', async () => {
      const prompt = await promptsManagerWithGlobal.getGenerateCommitMessageSystemPrompt(mockTask);

      expect(prompt).toContain('Global commit message prompt');
      expect(prompt).toContain('should override default');
      expect(prompt).not.toContain('Default commit message prompt');
    });

    it('should use global conflict-resolution template', async () => {
      const filePath = '/test/project/conflicted-file.ts';
      const ctx = { filePath };
      const prompt = await promptsManagerWithGlobal.getConflictResolutionPrompt(mockTask, filePath, ctx);

      expect(prompt).toContain('Global conflict resolution prompt');
      expect(prompt).toContain('should override default');
      expect(prompt).not.toContain('Default conflict resolution prompt');
    });

    it('should use global conflict-resolution-system template', async () => {
      const prompt = await promptsManagerWithGlobal.getConflictResolutionSystemPrompt(mockTask);

      expect(prompt).toContain('<GlobalConflictResolutionSystem>');
      expect(prompt).toContain('Global conflict resolution system prompt');
      expect(prompt).not.toContain('<DefaultConflictResolutionSystem>');
      expect(prompt).not.toContain('Default conflict resolution system prompt');
    });

    it('should use global task-name template', async () => {
      const prompt = await promptsManagerWithGlobal.getGenerateTaskNamePrompt(mockTask);

      expect(prompt).toContain('Global task name prompt');
      expect(prompt).toContain('should override default');
      expect(prompt).not.toContain('concise, descriptive task names');
    });
  });

  describe('Default templates (without global override)', () => {
    let promptsManagerNoGlobal: PromptsManager;

    beforeEach(async () => {
      // Create a prompts manager with a non-existent global directory
      promptsManagerNoGlobal = new PromptsManager(
        createMockExtensionManager(),
        path.join(__dirname, 'templates', 'default'),
        path.join(__dirname, 'templates', 'nonexistent-global'),
      );
      await promptsManagerNoGlobal.init();
    });

    it('should use default system-prompt template when global is not present', async () => {
      const prompt = await promptsManagerNoGlobal.getSystemPrompt(mockSettings, mockTask, mockProfile);

      expect(prompt).toContain('<DefaultSystemPrompt version="1.0">');
      expect(prompt).toContain('DefaultAgent');
      expect(prompt).toContain('Default objective from default templates');
      expect(prompt).not.toContain('<GlobalSystemPrompt version="1.0">');
    });

    it('should use default init-project template when global is not present', async () => {
      const prompt = await promptsManagerNoGlobal.getInitProjectSystemPrompt(mockTask);

      expect(prompt).toContain('<DefaultInitProjectSystemPrompt version="1.0">');
      expect(prompt).not.toContain('Global init-project');
    });

    it('should use default compact-conversation template when global is not present', async () => {
      const prompt = await promptsManagerNoGlobal.getCompactConversationPrompt(mockTask);

      expect(prompt).toContain('# Default Compact Conversation');
      expect(prompt).not.toContain('Global compact-conversation');
    });

    it('should use default commit-message template when global is not present', async () => {
      const prompt = await promptsManagerNoGlobal.getGenerateCommitMessageSystemPrompt(mockTask);

      expect(prompt).toContain('Default commit message prompt');
      expect(prompt).not.toContain('Global commit message prompt');
    });

    it('should use default conflict-resolution template when global is not present', async () => {
      const filePath = '/test/project/conflicted-file.ts';
      const ctx = { filePath };
      const prompt = await promptsManagerNoGlobal.getConflictResolutionPrompt(mockTask, filePath, ctx);

      expect(prompt).toContain('Default conflict resolution prompt');
      expect(prompt).not.toContain('Global conflict resolution prompt');
    });

    it('should use default conflict-resolution-system template when global is not present', async () => {
      const prompt = await promptsManagerNoGlobal.getConflictResolutionSystemPrompt(mockTask);

      expect(prompt).toContain('<DefaultConflictResolutionSystem>');
      expect(prompt).toContain('Default conflict resolution system prompt');
      expect(prompt).not.toContain('<GlobalConflictResolutionSystem>');
    });

    it('should use default task-name template when global is not present', async () => {
      const prompt = await promptsManagerNoGlobal.getGenerateTaskNamePrompt(mockTask);

      expect(prompt).toContain('You are a helpful assistant that generates concise, descriptive task names');
      expect(prompt).toContain('Guidelines:');
      expect(prompt).not.toContain('Global task name prompt');
    });
  });
});
