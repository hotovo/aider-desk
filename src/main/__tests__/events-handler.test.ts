import { beforeEach, describe, expect, it, vi } from 'vitest';

import { EventsHandler } from '../events-handler';

import type { AgentProfileManager } from '@/agent';
import type { EventManager } from '@/events/event-manager';
import type { Store } from '@/store';
import type { ModelManager } from '@/models';
import type { TelemetryManager } from '@/telemetry';
import type { ProjectData } from '@common/types';

const createEventsHandler = (
  store: Store,
  eventManager: EventManager,
  telemetryManager: TelemetryManager,
  agentProfileManager: AgentProfileManager,
  modelManager: ModelManager = {} as ModelManager,
) =>
  new EventsHandler(
    {} as never,
    store,
    {} as never,
    {} as never,
    {} as never,
    modelManager,
    telemetryManager,
    {} as never,
    {} as never,
    {} as never,
    eventManager,
    agentProfileManager,
    {} as never,
    {} as never,
    {} as never,
    {} as never,
  );

describe('EventsHandler', () => {
  let store: Store;
  let eventManager: EventManager;
  let telemetryManager: TelemetryManager;
  let agentProfileManager: AgentProfileManager;

  beforeEach(() => {
    store = {
      getOpenProjects: vi.fn(() => []),
      setOpenProjects: vi.fn(),
      addRecentProject: vi.fn(),
      getSettings: vi.fn(() => ({ aider: { options: '' } })),
      getProviders: vi.fn(() => []),
    } as unknown as Store;
    eventManager = {
      sendExtensionUIRefresh: vi.fn(),
    } as unknown as EventManager;
    telemetryManager = {
      captureProjectOpened: vi.fn(),
      captureProjectClosed: vi.fn(),
    } as unknown as TelemetryManager;
    agentProfileManager = {
      getDefaultAgentProfileId: vi.fn(() => 'default-profile'),
      getProfile: vi.fn(() => undefined),
    } as unknown as AgentProfileManager;
    vi.clearAllMocks();
  });

  it('uses the default agent profile when the active project profile is scoped to another project', async () => {
    const activeProject = {
      baseDir: '/previous-project',
      active: true,
      settings: {
        agentProfileId: 'previous-project-profile',
      },
    } as unknown as ProjectData;
    (store.getOpenProjects as ReturnType<typeof vi.fn>).mockImplementation(() => [activeProject]);
    const modelManager = {
      getProviderModels: vi.fn().mockResolvedValue({ models: [] }),
    } as unknown as ModelManager;
    (agentProfileManager.getProfile as ReturnType<typeof vi.fn>).mockReturnValue({ id: 'previous-project-profile', projectDir: '/previous-project' });
    const eventsHandler = createEventsHandler(store, eventManager, telemetryManager, agentProfileManager, modelManager);

    await eventsHandler.addOpenProject('/new-project');

    expect(store.setOpenProjects).toHaveBeenCalledWith([
      { ...activeProject, active: false },
      expect.objectContaining({
        baseDir: '/new-project',
        active: true,
        settings: expect.objectContaining({ agentProfileId: 'default-profile' }),
      }),
    ]);
  });

  it('sends exactly one extension UI refresh when adding a project to an empty list', async () => {
    const modelManager = {
      getProviderModels: vi.fn().mockResolvedValue({ models: [] }),
    } as unknown as ModelManager;
    const eventsHandler = createEventsHandler(store, eventManager, telemetryManager, agentProfileManager, modelManager);

    await eventsHandler.addOpenProject('/new-project');

    expect(store.setOpenProjects).toHaveBeenCalledWith([expect.objectContaining({ baseDir: '/new-project', active: true })]);
    expect(eventManager.sendExtensionUIRefresh).toHaveBeenCalledTimes(1);
    expect(eventManager.sendExtensionUIRefresh).toHaveBeenCalledWith({});
  });

  it('sends exactly one extension UI refresh when closing the active project and another remains', () => {
    const projectA = { baseDir: '/project-a', active: false } as unknown as ProjectData;
    const projectB = { baseDir: '/project-b', active: true } as unknown as ProjectData;
    (store.getOpenProjects as ReturnType<typeof vi.fn>).mockReturnValue([projectA, projectB]);
    const eventsHandler = createEventsHandler(store, eventManager, telemetryManager, agentProfileManager);

    const result = eventsHandler.removeOpenProject('/project-b');

    // The remaining project is auto-activated and must be a NEW object (not a mutated shared reference)
    expect(store.setOpenProjects).toHaveBeenCalledWith([{ baseDir: '/project-a', active: true }]);
    const calls = vi.mocked(store.setOpenProjects).mock.calls;
    const saved = calls[calls.length - 1][0];
    // The saved list must not reuse the original project object from the store
    expect(saved[0]).not.toBe(projectA);
    expect(result).toEqual([{ baseDir: '/project-a', active: true }]);
    expect(eventManager.sendExtensionUIRefresh).toHaveBeenCalledTimes(1);
    expect(eventManager.sendExtensionUIRefresh).toHaveBeenCalledWith({});
  });

  it('emits a refresh when a project list changes even if the active project is unchanged', () => {
    // Removing an inactive project changes the membership of the open list,
    // so extension UIs must refresh even though the active project is unchanged
    const projectA = { baseDir: '/project-a', active: true } as unknown as ProjectData;
    const projectB = { baseDir: '/project-b', active: false } as unknown as ProjectData;
    (store.getOpenProjects as ReturnType<typeof vi.fn>).mockReturnValue([projectA, projectB]);
    const eventsHandler = createEventsHandler(store, eventManager, telemetryManager, agentProfileManager);

    eventsHandler.removeOpenProject('/project-b');

    expect(store.setOpenProjects).toHaveBeenCalledWith([projectA]);
    expect(eventManager.sendExtensionUIRefresh).toHaveBeenCalledTimes(1);
    expect(eventManager.sendExtensionUIRefresh).toHaveBeenCalledWith({});
  });

  it('emits a refresh when the active project is removed and a fallback becomes active', () => {
    // Removing the active FIRST project falls back to activating the last remaining one
    const projectA = { baseDir: '/project-a', active: true } as unknown as ProjectData;
    const projectB = { baseDir: '/project-b', active: false } as unknown as ProjectData;
    (store.getOpenProjects as ReturnType<typeof vi.fn>).mockReturnValue([projectA, projectB]);
    const eventsHandler = createEventsHandler(store, eventManager, telemetryManager, agentProfileManager);

    eventsHandler.removeOpenProject('/project-a');

    expect(store.setOpenProjects).toHaveBeenCalledWith([{ baseDir: '/project-b', active: true }]);
    expect(eventManager.sendExtensionUIRefresh).toHaveBeenCalledTimes(1);
    expect(eventManager.sendExtensionUIRefresh).toHaveBeenCalledWith({});
  });

  it('activates the matching project and emits a refresh when setActiveProject finds the target', async () => {
    const projectA = { baseDir: '/project-a', active: true } as unknown as ProjectData;
    const projectB = { baseDir: '/project-b', active: false } as unknown as ProjectData;
    (store.getOpenProjects as ReturnType<typeof vi.fn>).mockReturnValue([projectA, projectB]);
    const eventsHandler = createEventsHandler(store, eventManager, telemetryManager, agentProfileManager);

    const result = await eventsHandler.setActiveProject('/project-b');

    expect(store.setOpenProjects).toHaveBeenCalledWith([
      { baseDir: '/project-a', active: false },
      { baseDir: '/project-b', active: true },
    ]);
    expect(eventManager.sendExtensionUIRefresh).toHaveBeenCalledTimes(1);
    expect(eventManager.sendExtensionUIRefresh).toHaveBeenCalledWith({});
    expect(result).toEqual(expect.arrayContaining([expect.objectContaining({ baseDir: '/project-b', active: true })]));
  });

  it('does not modify active projects when the target project is not open', async () => {
    // An unknown baseDir must not wipe the active flags of currently open projects
    const projectA = { baseDir: '/project-a', active: false } as unknown as ProjectData;
    const projectB = { baseDir: '/project-b', active: true } as unknown as ProjectData;
    (store.getOpenProjects as ReturnType<typeof vi.fn>).mockReturnValue([projectA, projectB]);
    const eventsHandler = createEventsHandler(store, eventManager, telemetryManager, agentProfileManager);

    const result = await eventsHandler.setActiveProject('/nonexistent');

    expect(store.setOpenProjects).not.toHaveBeenCalled();
    expect(eventManager.sendExtensionUIRefresh).not.toHaveBeenCalled();
    expect(result).toEqual([
      { baseDir: '/project-a', active: false },
      { baseDir: '/project-b', active: true },
    ]);
  });

  it('emits a refresh when the only open project is closed', () => {
    // Closing the last project transitions the active dir from /only-project to undefined
    const project = { baseDir: '/only-project', active: true } as unknown as ProjectData;
    (store.getOpenProjects as ReturnType<typeof vi.fn>).mockReturnValue([project]);
    const eventsHandler = createEventsHandler(store, eventManager, telemetryManager, agentProfileManager);

    eventsHandler.removeOpenProject('/only-project');

    expect(store.setOpenProjects).toHaveBeenCalledWith([]);
    expect(eventManager.sendExtensionUIRefresh).toHaveBeenCalledTimes(1);
    expect(eventManager.sendExtensionUIRefresh).toHaveBeenCalledWith({});
  });
});
