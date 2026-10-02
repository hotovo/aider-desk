import { useShallow } from 'zustand/react/shallow';
import { createWithEqualityFn } from 'zustand/traditional';
import { devtools } from 'zustand/middleware';
import { shallow } from 'zustand/vanilla/shallow';
import { ExtensionToolInfo } from '@common/types';
import { ApplicationAPI } from '@common/api';

const getToolsCacheKey = (projectDir?: string): string => projectDir || 'global';

interface ExtensionToolsState {
  toolsInfoMap: Map<string, ExtensionToolInfo[]>;
  loadingTools: Set<string>;
  initialized: boolean;
}

interface ExtensionToolsActions {
  loadToolsInfo: (api: ApplicationAPI, projectDir?: string, forceRefresh?: boolean) => Promise<ExtensionToolInfo[]>;
  refreshAllToolsInfo: (api: ApplicationAPI) => Promise<ExtensionToolInfo[]>;
  getToolsInfo: (projectDir?: string) => ExtensionToolInfo[] | undefined;
  isLoadingTools: (projectDir?: string) => boolean;
}

type ExtensionToolsStore = ExtensionToolsState & ExtensionToolsActions;

const DEVTOOLS_OPTIONS = {
  name: 'ExtensionToolsStore',
  enabled: import.meta.env.DEV,
  serialize: {
    options: {
      map: true,
      set: true,
    },
  },
};

export const useExtensionToolsStore = createWithEqualityFn<ExtensionToolsStore>()(
  devtools(
    (set, get) => ({
      toolsInfoMap: new Map(),
      loadingTools: new Set(),
      initialized: false,

      loadToolsInfo: async (api, projectDir, forceRefresh = false) => {
        const cacheKey = getToolsCacheKey(projectDir);
        const state = get();
        const hasCachedData = state.toolsInfoMap.has(cacheKey);

        // Return cached if available and not forcing refresh
        if (hasCachedData && !forceRefresh) {
          return state.toolsInfoMap.get(cacheKey);
        }

        // If a request is already in flight, return cached data immediately or wait for it
        if (state.loadingTools.has(cacheKey)) {
          if (hasCachedData) {
            return state.toolsInfoMap.get(cacheKey);
          }
          return new Promise((resolve) => {
            const checkLoaded = () => {
              const currentState = get();
              if (!currentState.loadingTools.has(cacheKey)) {
                resolve(currentState.toolsInfoMap.get(cacheKey) || []);
              } else {
                setTimeout(checkLoaded, 50);
              }
            };
            checkLoaded();
          });
        }

        set((state) => ({
          loadingTools: new Set(state.loadingTools).add(cacheKey),
        }));

        try {
          const toolsInfo = await api.getExtensionToolsInfo(projectDir);

          set((state) => {
            const newToolsInfoMap = new Map(state.toolsInfoMap);
            newToolsInfoMap.set(cacheKey, toolsInfo);
            const newLoadingTools = new Set(state.loadingTools);
            newLoadingTools.delete(cacheKey);
            return {
              toolsInfoMap: newToolsInfoMap,
              loadingTools: newLoadingTools,
              initialized: true,
            };
          });

          return toolsInfo;
        } catch (error) {
          // eslint-disable-next-line no-console
          console.error('Failed to load extension tools info:', error);

          set((state) => {
            const newLoadingTools = new Set(state.loadingTools);
            newLoadingTools.delete(cacheKey);
            return { loadingTools: newLoadingTools };
          });

          return [];
        }
      },

      refreshAllToolsInfo: async (api) => {
        const cacheKeys = [...get().toolsInfoMap.keys()];
        if (cacheKeys.length === 0) {
          return [];
        }

        const results = await Promise.all(
          cacheKeys.map((cacheKey) => {
            const projectDir = cacheKey === 'global' ? undefined : cacheKey;
            return get().loadToolsInfo(api, projectDir, true);
          }),
        );

        return results.flat();
      },

      getToolsInfo: (projectDir) => get().toolsInfoMap.get(getToolsCacheKey(projectDir)),

      isLoadingTools: (projectDir) => get().loadingTools.has(getToolsCacheKey(projectDir)),
    }),
    DEVTOOLS_OPTIONS,
  ),
  shallow,
);

export const useExtensionToolsInfo = (projectDir?: string): ExtensionToolInfo[] =>
  useExtensionToolsStore(useShallow((state) => state.toolsInfoMap.get(getToolsCacheKey(projectDir)) || []));

export const useExtensionToolsLoading = (projectDir?: string): boolean =>
  useExtensionToolsStore((state) => state.loadingTools.has(getToolsCacheKey(projectDir)));
