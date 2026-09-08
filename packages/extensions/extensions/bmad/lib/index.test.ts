import fs from 'fs';
import os from 'os';
import path from 'path';
import { describe, expect, it, vi } from 'vitest';

import BmadExtension from '../index';
import { createBmadInstallFixture } from './install-fixture';

const tmpProject = (withBmad: boolean): string => {
  const dir = fs.mkdtempSync(path.join(os.tmpdir(), 'bmad-ui-gate-'));
  if (withBmad) {
    // Standard installation marker: the installer manifest (any module set)
    fs.mkdirSync(path.join(dir, '_bmad', '_config'), { recursive: true });
    fs.writeFileSync(path.join(dir, '_bmad', '_config', 'manifest.yaml'), 'installation:\n  version: 6.11.0\nmodules:\n  - name: bmm\nides:\n  - amp\n');
    const skillDir = path.join(dir, '.agents', 'skills', 'bmad-help');
    fs.mkdirSync(skillDir, { recursive: true });
    fs.writeFileSync(path.join(skillDir, 'SKILL.md'), '# bmad-help\n');
  }
  return dir;
};

const context = (projectDir: string | undefined, currentMode?: string): any => ({
  getProjectDir: () => projectDir,
  getTaskContext: () => ({ data: currentMode ? { currentMode } : {} }),
  log: () => {},
});

describe('getUIComponents gate', () => {
  it('returns the mode switcher for a project without BMAD installed (non-BMAD mode)', () => {
    const ext: any = new BmadExtension();
    expect(ext.getUIComponents(context(tmpProject(false))).map((c: any) => c.id)).toEqual(['bmad-mode-switcher']);
  });

  it('returns the welcome page (install prompt) in bmad mode even without installation', () => {
    const ext: any = new BmadExtension();
    expect(ext.getUIComponents(context(tmpProject(false), 'bmad')).map((c: any) => c.id)).toEqual(['bmad-welcome-page']);
  });

  it('returns the mode switcher in agent/code mode without installation', () => {
    const ext: any = new BmadExtension();
    expect(ext.getUIComponents(context(tmpProject(false), 'agent')).map((c: any) => c.id)).toEqual(['bmad-mode-switcher']);
    expect(ext.getUIComponents(context(tmpProject(false), 'code')).map((c: any) => c.id)).toEqual(['bmad-mode-switcher']);
  });

  it('returns [] when no project directory is available', () => {
    const ext: any = new BmadExtension();
    expect(ext.getUIComponents(context(undefined))).toEqual([]);
  });

  it('returns welcome page + task actions for a BMAD project without an active task mode', () => {
    const ext: any = new BmadExtension();
    const components = ext.getUIComponents(context(tmpProject(true)));
    expect(components.map((c: any) => c.id)).toEqual(['bmad-welcome-page', 'bmad-task-actions']);
  });

  it('returns components regardless of the active task mode (agent/code)', () => {
    const ext: any = new BmadExtension();
    expect(ext.getUIComponents(context(tmpProject(true), 'agent')).length).toBe(2);
    expect(ext.getUIComponents(context(tmpProject(true), 'code')).length).toBe(2);
  });

  it('registers no agent profiles (v2 removed the persona layer)', () => {
    const ext: any = new BmadExtension();
    expect(ext.getAgents).toBeUndefined();
  });

  it('keeps working after onUnload cleared its caches (managers rebuild lazily)', () => {
    const dir = tmpProject(true);
    const ext: any = new BmadExtension();
    expect(ext.getUIComponents(context(dir)).length).toBe(2);
    expect(() => ext.onUnload()).not.toThrow();
    expect(ext.getUIComponents(context(dir)).length).toBe(2);
  });
});

describe('switch-to-bmad mode switch', () => {
  it('switches the task mode to bmad via TaskContext.updateTask', async () => {
    const ext: any = new BmadExtension();
    const updateTask = vi.fn().mockResolvedValue({});
    const reload = vi.fn();
    const ctx: any = {
      ...context(tmpProject(false), 'agent'),
      triggerUIComponentsReload: reload,
      getTaskContext: () => ({ data: { currentMode: 'agent' }, updateTask }),
    };
    const result = await ext.executeUIExtensionAction('bmad-mode-switcher', 'switch-to-bmad', [], ctx);
    expect(result).toEqual({ success: true });
    expect(updateTask).toHaveBeenCalledWith({ currentMode: 'bmad' });
    expect(reload).toHaveBeenCalled();
  });

  it('reports failure when no task context is available', async () => {
    const ext: any = new BmadExtension();
    const ctx: any = {
      ...context(tmpProject(false), 'agent'),
      getTaskContext: () => null,
    };
    const result = await ext.executeUIExtensionAction('bmad-mode-switcher', 'switch-to-bmad', [], ctx);
    expect(result).toEqual({ success: false, error: 'Task context is required' });
  });
});

describe('execute-workflow / change-workflow against the installed catalog', () => {
  const catalogProject = (): string => {
    const dir = tmpProject(true);
    createBmadInstallFixture(dir, {
      version: '6.11.0',
      modules: [
        {
          code: 'bmm',
          configYaml: 'output_folder: _bmad-output\n',
          helpRows: [{ skill: 'bmad-prd', 'display-name': 'Create PRD', 'menu-code': 'PRD', phase: 'plan' }],
        },
      ],
      skills: [{ id: 'bmad-prd', module: 'bmm' }],
    });
    return dir;
  };

  it('rejects change-workflow for ids that are not part of the installed method (clean break)', async () => {
    const ext: any = new BmadExtension();
    const updateTask = vi.fn().mockResolvedValue({});
    const ctx: any = {
      ...context(catalogProject(), 'bmad'),
      triggerUIDataRefresh: () => {},
      getTaskContext: () => ({ data: { metadata: {} }, updateTask }),
    };
    const result = await ext.executeUIExtensionAction('x', 'change-workflow', ['create-prd'], ctx);
    expect(result.success).toBe(false);
    expect(updateTask).not.toHaveBeenCalled();
  });

  it('accepts change-workflow for installed catalog entries', async () => {
    const ext: any = new BmadExtension();
    const updateTask = vi.fn().mockResolvedValue({});
    const refresh = vi.fn();
    const ctx: any = {
      ...context(catalogProject(), 'bmad'),
      triggerUIDataRefresh: refresh,
      getTaskContext: () => ({ data: { metadata: {} }, updateTask }),
    };
    const result = await ext.executeUIExtensionAction('x', 'change-workflow', ['bmad-prd'], ctx);
    expect(result).toEqual({ success: true });
    expect(updateTask).toHaveBeenCalledWith(
      expect.objectContaining({ metadata: expect.objectContaining({ bmadWorkflowId: 'bmad-prd', bmadSkillId: '' }) }),
    );
    expect(refresh).toHaveBeenCalled();
  });

  it('starts workflows via executeWorkflow of the manager (catalog id)', async () => {
    const ext: any = new BmadExtension();
    const runPromptInAgent = vi.fn().mockResolvedValue([]);
    const loadContextMessages = vi.fn().mockResolvedValue(undefined);
    const profile = { id: 'task-agent', name: 'Task Agent' };
    const ctx: any = {
      ...context(catalogProject(), 'bmad'),
      triggerUIDataRefresh: () => {},
      getProjectContext: () => { throw new Error('not used'); },
      getTaskContext: () => ({
        data: { metadata: {}, name: '' },
        getTaskAgentProfile: vi.fn().mockResolvedValue(profile),
        loadContextMessages,
        updateTask: vi.fn().mockResolvedValue({}),
        addLoadingMessage: () => {},
        runPromptInAgent,
      }),
    };
    const result = await ext.executeUIExtensionAction('x', 'execute-workflow', ['bmad-prd', 'task-1'], ctx);
    expect(result.success).toBe(true);
    expect(loadContextMessages).toHaveBeenCalledTimes(1);
    const messages = loadContextMessages.mock.calls[0][0];
    const firstContent = String(messages[0].content);
    expect(firstContent).toContain('.agents/skills/bmad-prd/SKILL.md');
    expect(runPromptInAgent).toHaveBeenCalledTimes(1);
    const [usedProfile, mode] = runPromptInAgent.mock.calls[0];
    expect(usedProfile).toBe(profile);
    expect(mode).toBe('bmad');
  });
});
