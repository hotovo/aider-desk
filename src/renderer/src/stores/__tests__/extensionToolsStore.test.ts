import { beforeEach, describe, expect, it, vi } from 'vitest';
import { ExtensionToolInfo } from '@common/types';
import { ApplicationAPI } from '@common/api';

import { useExtensionToolsStore } from '../extensionToolsStore';

describe('extensionToolsStore', () => {
  const globalTools: ExtensionToolInfo[] = [
    {
      extensionId: 'ext-a',
      extensionName: 'Extension A',
      tools: [{ name: 'tool-a1', description: 'A1' }],
    },
  ];
  const projectTools: ExtensionToolInfo[] = [
    {
      extensionId: 'ext-b',
      extensionName: 'Extension B',
      tools: [{ name: 'tool-b1', description: 'B1' }],
    },
  ];

  const mockApi = {
    getExtensionToolsInfo: vi.fn(),
  } as unknown as ApplicationAPI;

  beforeEach(() => {
    vi.clearAllMocks();
    useExtensionToolsStore.setState({ toolsInfoMap: new Map(), loadingTools: new Set(), initialized: false });
  });

  it('should load and cache tools info', async () => {
    vi.mocked(mockApi.getExtensionToolsInfo).mockResolvedValue(globalTools);

    const result = await useExtensionToolsStore.getState().loadToolsInfo(mockApi);

    expect(result).toEqual(globalTools);
    expect(useExtensionToolsStore.getState().toolsInfoMap.get('global')).toEqual(globalTools);

    await useExtensionToolsStore.getState().loadToolsInfo(mockApi);

    expect(mockApi.getExtensionToolsInfo).toHaveBeenCalledTimes(1);
  });

  it('should scope cache by projectDir', async () => {
    vi.mocked(mockApi.getExtensionToolsInfo).mockImplementation((projectDir?: string) => Promise.resolve(projectDir ? projectTools : globalTools));

    await useExtensionToolsStore.getState().loadToolsInfo(mockApi, '/project');
    await useExtensionToolsStore.getState().loadToolsInfo(mockApi);

    const { toolsInfoMap } = useExtensionToolsStore.getState();
    expect(toolsInfoMap.get('/project')).toEqual(projectTools);
    expect(toolsInfoMap.get('global')).toEqual(globalTools);
  });

  it('should force refresh when requested', async () => {
    vi.mocked(mockApi.getExtensionToolsInfo).mockResolvedValue(globalTools);
    await useExtensionToolsStore.getState().loadToolsInfo(mockApi);

    const updatedTools: ExtensionToolInfo[] = [...globalTools, { extensionId: 'ext-c', extensionName: 'Extension C', tools: [] }];
    vi.mocked(mockApi.getExtensionToolsInfo).mockResolvedValue(updatedTools);

    const result = await useExtensionToolsStore.getState().loadToolsInfo(mockApi, undefined, true);

    expect(result).toEqual(updatedTools);
    expect(mockApi.getExtensionToolsInfo).toHaveBeenCalledTimes(2);
  });

  it('should refresh all cached scopes', async () => {
    vi.mocked(mockApi.getExtensionToolsInfo).mockImplementation((projectDir?: string) => Promise.resolve(projectDir ? projectTools : globalTools));

    await useExtensionToolsStore.getState().loadToolsInfo(mockApi);
    await useExtensionToolsStore.getState().loadToolsInfo(mockApi, '/project');
    vi.mocked(mockApi.getExtensionToolsInfo).mockClear();

    const refreshedTools: ExtensionToolInfo[] = [];
    vi.mocked(mockApi.getExtensionToolsInfo).mockResolvedValue(refreshedTools);

    await useExtensionToolsStore.getState().refreshAllToolsInfo(mockApi);

    expect(mockApi.getExtensionToolsInfo).toHaveBeenCalledTimes(2);
    expect(useExtensionToolsStore.getState().toolsInfoMap.get('global')).toEqual(refreshedTools);
    expect(useExtensionToolsStore.getState().toolsInfoMap.get('/project')).toEqual(refreshedTools);
  });

  it('should not cache on load failure and reset loading state', async () => {
    vi.mocked(mockApi.getExtensionToolsInfo).mockRejectedValue(new Error('load failed'));

    const result = await useExtensionToolsStore.getState().loadToolsInfo(mockApi);

    expect(result).toEqual([]);
    expect(useExtensionToolsStore.getState().toolsInfoMap.has('global')).toBe(false);
    expect(useExtensionToolsStore.getState().isLoadingTools()).toBe(false);
  });

  it('should wait for in-flight request instead of duplicating it', async () => {
    let resolveLoad: (value: ExtensionToolInfo[]) => void = () => {};
    vi.mocked(mockApi.getExtensionToolsInfo).mockImplementation(
      () =>
        new Promise((resolve) => {
          resolveLoad = resolve;
        }),
    );

    const firstLoad = useExtensionToolsStore.getState().loadToolsInfo(mockApi);
    const secondLoad = useExtensionToolsStore.getState().loadToolsInfo(mockApi);

    resolveLoad(globalTools);
    const [firstResult, secondResult] = await Promise.all([firstLoad, secondLoad]);

    expect(firstResult).toEqual(globalTools);
    expect(secondResult).toEqual(globalTools);
    expect(mockApi.getExtensionToolsInfo).toHaveBeenCalledTimes(1);
  });
});
