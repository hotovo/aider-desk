import { act, render } from '@testing-library/react';
import { beforeEach, describe, expect, it, vi } from 'vitest';

import { useExtensionComponentsWrapper } from '../useExtensionComponentsWrapper';

import type { ExtensionUIRefreshData } from '@common/types';

import { handleExtensionUIRefreshEvent } from '@/stores/extensionUIStore';

// Mutable componentProps consumed by the mocked ExtensionsContext hook
const mockState = vi.hoisted(() => ({
  projectDir: undefined as string | undefined,
  taskId: undefined as string | undefined,
}));

const loadExtensionComponentDataMock = vi.hoisted(() => vi.fn());

const refreshHandlerRef = vi.hoisted(() => ({ current: undefined as undefined | ((data: never) => void) }));

const apiMock = vi.hoisted(() => ({
  onExtensionUIRefresh: vi.fn((callback: (data: never) => void) => {
    refreshHandlerRef.current = callback;
    return () => undefined;
  }),
  getExtensionUIComponents: vi.fn(async () => []),
  getUIExtensionData: vi.fn(async () => undefined),
  executeUIExtensionAction: vi.fn(async () => undefined),
}));

// The wrapper under test reads componentProps.projectDir as fallback when no
// projectDir prop is given (this is what the global app-floating mount does),
// and subscribes to extension UI refresh events through the api.
vi.mock('@/contexts/ExtensionApiContext', () => ({
  useExtensionApi: () => apiMock,
}));

vi.mock('@/contexts/ExtensionsContext', () => ({
  useExtensions: () => ({
    componentProps: {
      projectDir: mockState.projectDir,
      task: mockState.taskId ? { id: mockState.taskId } : undefined,
    },
  }),
}));

vi.mock('@/utils/extension-icons', () => ({
  useReactIcons: () => ({}),
  reactIcons: {},
  iconPackStubs: {},
}));

vi.mock('@/utils/extension-library-loader', () => ({
  loadAllLibraries: vi.fn(async () => ({})),
  loadExtensionLibrary: vi.fn(async () => ({})),
  initExtensionLibraryLoader: vi.fn(async () => undefined),
}));

vi.mock('@/stores/extensionUIStore', () => ({
  useExtensionComponents: vi.fn(() => [{ extensionId: 'sound-notification', componentId: 'sound-remote-panel', loadData: true }]),
  isExtensionUIDataLoaded: vi.fn(() => false),
  loadExtensionComponentData: loadExtensionComponentDataMock,
  loadExtensionUIComponents: vi.fn(),
  handleExtensionUIRefreshEvent: vi.fn(),
}));

vi.mock('@/components/extensions/ExtensionComponentRenderer', () => ({
  ExtensionComponentRenderer: () => null,
}));

const Harness = ({ placement, projectDir, taskId }: { placement: string; projectDir?: string; taskId?: string }) => {
  useExtensionComponentsWrapper({ placement, projectDir, taskId });
  return null;
};

const emitRefresh = (data: Partial<ExtensionUIRefreshData>) => {
  act(() => {
    refreshHandlerRef.current?.(data as never);
  });
};

const PROJECT_DIR = '/projects/demo';

const refreshForProject = (): Partial<ExtensionUIRefreshData> => ({
  projectDir: PROJECT_DIR,
  extensionId: 'sound-notification',
  componentId: 'sound-remote-panel',
});

describe('useExtensionComponentsWrapper refresh routing (sound-notification: project-independent refresh delivery)', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    loadExtensionComponentDataMock.mockReset();
    mockState.projectDir = undefined;
    mockState.taskId = undefined;
  });

  it('mounts the app-floating panel (global, no projectDir) and still fetches data on mount', () => {
    render(<Harness placement="app-floating" />);

    expect(loadExtensionComponentDataMock).toHaveBeenCalledTimes(1);
    expect(loadExtensionComponentDataMock.mock.calls[0][3]).toBeUndefined();
  });

  it('delivers project-stamped refresh events to the global app-floating mount (no projectDir) — sound panel fixed to app-floating', () => {
    render(<Harness placement="app-floating" />);

    expect(loadExtensionComponentDataMock).toHaveBeenCalledTimes(1);

    emitRefresh(refreshForProject());

    // Wrappers mounted without a projectDir (the always-mounted 'app-floating'
    // panels in Home) have no project scope: a refresh stamped with a
    // project's dir (e.g. a background project's onNotification) must reach
    // them so the globally-mounted sound panel re-reads the shared queue.
    expect(loadExtensionComponentDataMock).toHaveBeenCalledTimes(2);
    expect(loadExtensionComponentDataMock.mock.calls[1][3]).toBeUndefined(); // global data slot
    expect(loadExtensionComponentDataMock.mock.calls[1][5]).toBe(true); // forceRefresh
  });

  it('forwards project-stamped reloadComponents refreshes from the global app-floating mount to the store', () => {
    render(<Harness placement="app-floating" />);

    emitRefresh({ ...refreshForProject(), reloadComponents: true });

    expect(handleExtensionUIRefreshEvent).toHaveBeenCalledWith(apiMock, { ...refreshForProject(), reloadComponents: true }, undefined, undefined);
  });

  it('delivers project-stamped refresh events to the project-floating mount (matching projectDir)', () => {
    render(<Harness placement="project-floating" projectDir={PROJECT_DIR} />);

    expect(loadExtensionComponentDataMock).toHaveBeenCalledTimes(1);

    emitRefresh(refreshForProject());

    expect(loadExtensionComponentDataMock).toHaveBeenCalledTimes(2);
    expect(loadExtensionComponentDataMock.mock.calls[1][3]).toBe(PROJECT_DIR);
    expect(loadExtensionComponentDataMock.mock.calls[1][5]).toBe(true); // forceRefresh
  });

  it('drops project-stamped refresh events for a mismatching projectDir', () => {
    render(<Harness placement="project-floating" projectDir="/projects/other" />);

    expect(loadExtensionComponentDataMock).toHaveBeenCalledTimes(1);

    emitRefresh(refreshForProject());

    expect(loadExtensionComponentDataMock).toHaveBeenCalledTimes(1);
  });

  it('drops refresh events stamped with a different taskId than the mounted task', () => {
    render(<Harness placement="project-floating" projectDir={PROJECT_DIR} taskId="task-1" />);

    expect(loadExtensionComponentDataMock).toHaveBeenCalledTimes(1);

    emitRefresh({ ...refreshForProject(), taskId: 'task-2' });

    expect(loadExtensionComponentDataMock).toHaveBeenCalledTimes(1);

    emitRefresh({ ...refreshForProject(), taskId: 'task-1' });

    expect(loadExtensionComponentDataMock).toHaveBeenCalledTimes(2);
  });
});
