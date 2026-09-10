import { describe, it, expect, vi } from 'vitest';

import { ProjectContextImpl } from '../project-context';
import { DisposableStore } from '../disposable-store';

import type { Project } from '@/project';
import type { SkillsContext } from '@common/extensions';

const createMockProject = (): Project => {
  return {
    baseDir: '/project/path',
  } as unknown as Project;
};

describe('ProjectContextImpl.getSkillContext', () => {
  it('should throw error when skills context is not available', () => {
    const context = new ProjectContextImpl(createMockProject(), new DisposableStore('Test Extension'));

    expect(() => context.getSkillContext()).toThrow('SkillManager not available');
  });

  it('should return the provided skills context', () => {
    const mockSkillsContext = { listSkills: vi.fn() } as unknown as SkillsContext;

    const context = new ProjectContextImpl(createMockProject(), new DisposableStore('Test Extension'), mockSkillsContext);

    expect(context.getSkillContext()).toBe(mockSkillsContext);
  });
});
