import { useShallow } from 'zustand/react/shallow';
import { createWithEqualityFn } from 'zustand/traditional';
import { shallow } from 'zustand/vanilla/shallow';
import { ExtensionUIComponent, ExtensionUIRefreshData } from '@common/types';
import { ApplicationAPI } from '@common/api';

const getComponentsCacheKey = (projectDir?: string, placement?: string): string => `${projectDir || 'global'}:${placement || 'default'}`;

const getDataCacheKey = (extensionId: string, componentId: string, projectDir?: string, taskId?: string): string =>
  `${extensionId}:${componentId}:${projectDir || ''}:${taskId || ''}`;

interface ExtensionUIState {
  componentsMap: Map<string, ExtensionUIComponent[]>;
  dataMap: Map<string, unknown>;
  loadingComponents: Set<string>;
  loadingData: Set<string>;
  initialized: boolean;
}

interface ExtensionUIActions {
  loadComponents: (api: ApplicationAPI, projectDir?: string, placement?: string) => Promise<ExtensionUIComponent[]>;
  loadComponentData: (
    api: ApplicationAPI,
    extensionId: string,
    componentId: string,
    projectDir?: string,
    taskId?: string,
    forceRefresh?: boolean,
  ) => Promise<unknown>;
  loadAllComponentsData: (
    api: ApplicationAPI,
    components: ExtensionUIComponent[],
    projectDir?: string,
    taskId?: string,
    forceRefresh?: boolean,
  ) => Promise<void>;
  handleRefreshEvent: (api: ApplicationAPI, data: ExtensionUIRefreshData, projectDir?: string, taskId?: string) => void;
  invalidateComponents: (projectDir?: string, placement?: string) => void;
  invalidateData: (extensionId?: string, componentId?: string, projectDir?: string, taskId?: string) => void;
  getComponents: (projectDir?: string, placement?: string) => ExtensionUIComponent[];
  getComponentData: (extensionId: string, componentId: string, projectDir?: string, taskId?: string) => unknown;
  isLoadingComponents: (projectDir?: string, placement?: string) => boolean;
}

type ExtensionUIStore = ExtensionUIState & ExtensionUIActions;

export const useExtensionUIStore = createWithEqualityFn<ExtensionUIStore>(
  (set, get) => ({
    componentsMap: new Map(),
    dataMap: new Map(),
    loadingComponents: new Set(),
    loadingData: new Set(),
    initialized: false,

    loadComponents: async (api, projectDir, placement) => {
      const cacheKey = getComponentsCacheKey(projectDir, placement);
      const state = get();

      // Return cached if available
      const cached = state.componentsMap.get(cacheKey);
      if (cached) {
        return cached;
      }

      // Prevent duplicate requests
      if (state.loadingComponents.has(cacheKey)) {
        // Wait for existing request - poll until loaded
        return new Promise((resolve) => {
          const checkLoaded = () => {
            const currentState = get();
            if (!currentState.loadingComponents.has(cacheKey)) {
              resolve(currentState.componentsMap.get(cacheKey) || []);
            } else {
              setTimeout(checkLoaded, 50);
            }
          };
          checkLoaded();
        });
      }

      // Mark as loading
      set((state) => ({
        loadingComponents: new Set(state.loadingComponents).add(cacheKey),
      }));

      try {
        const components = await api.getExtensionUIComponents(projectDir, placement);

        set((state) => {
          const newComponentsMap = new Map(state.componentsMap);
          newComponentsMap.set(cacheKey, components);
          const newLoadingComponents = new Set(state.loadingComponents);
          newLoadingComponents.delete(cacheKey);
          return {
            componentsMap: newComponentsMap,
            loadingComponents: newLoadingComponents,
            initialized: true,
          };
        });

        return components;
      } catch (error) {
        // eslint-disable-next-line no-console
        console.error('Failed to load extension UI components:', error);

        set((state) => {
          const newLoadingComponents = new Set(state.loadingComponents);
          newLoadingComponents.delete(cacheKey);
          return { loadingComponents: newLoadingComponents };
        });

        return [];
      }
    },

    loadComponentData: async (api, extensionId, componentId, projectDir, taskId, forceRefresh = false) => {
      const cacheKey = getDataCacheKey(extensionId, componentId, projectDir, taskId);
      const state = get();
      const hasCachedData = state.dataMap.has(cacheKey);

      // Return cached if available and not forcing refresh
      if (hasCachedData && !forceRefresh) {
        return state.dataMap.get(cacheKey);
      }

      // Prevent duplicate requests (only block if no cached data to show)
      if (state.loadingData.has(cacheKey)) {
        // If we have cached data, return it immediately (stale-while-revalidate)
        if (hasCachedData) {
          return state.dataMap.get(cacheKey);
        }
        // Otherwise wait for the pending request
        return new Promise((resolve) => {
          const checkLoaded = () => {
            const currentState = get();
            if (!currentState.loadingData.has(cacheKey)) {
              resolve(currentState.dataMap.get(cacheKey));
            } else {
              setTimeout(checkLoaded, 50);
            }
          };
          checkLoaded();
        });
      }

      // Mark as loading
      set((state) => ({
        loadingData: new Set(state.loadingData).add(cacheKey),
      }));

      try {
        const data = await api.getUIExtensionData(extensionId, componentId, projectDir, taskId);

        set((state) => {
          const newDataMap = new Map(state.dataMap);
          newDataMap.set(cacheKey, data);
          const newLoadingData = new Set(state.loadingData);
          newLoadingData.delete(cacheKey);
          return {
            dataMap: newDataMap,
            loadingData: newLoadingData,
          };
        });

        return data;
      } catch (error) {
        // eslint-disable-next-line no-console
        console.error(`Failed to load extension UI data for ${extensionId}/${componentId}:`, error);

        set((state) => {
          const newLoadingData = new Set(state.loadingData);
          newLoadingData.delete(cacheKey);
          return { loadingData: newLoadingData };
        });

        // Return cached data on error if available
        return hasCachedData ? get().dataMap.get(cacheKey) : undefined;
      }
    },

    loadAllComponentsData: async (api, components, projectDir, taskId, forceRefresh = false) => {
      const componentsWithData = components.filter((comp) => comp.loadData);
      if (componentsWithData.length === 0) {
        return;
      }

      await Promise.all(componentsWithData.map((comp) => get().loadComponentData(api, comp.extensionId, comp.componentId, projectDir, taskId, forceRefresh)));
    },

    handleRefreshEvent: (_api, data, currentProjectDir, _currentTaskId) => {
      // Only handle component reloads - data refresh is handled by forceRefresh in loadComponentData
      // We don't invalidate data cache to avoid flicker (stale-while-revalidate pattern)
      if (!data.reloadComponents) {
        return;
      }

      if (data.projectDir !== undefined && data.projectDir !== currentProjectDir) {
        return;
      }

      const state = get();

      // Find all matching component cache keys to invalidate
      const keysToInvalidate: string[] = [];
      state.componentsMap.forEach((components, key) => {
        if (data.extensionId !== undefined && !components.some((c) => c.extensionId === data.extensionId)) {
          return;
        }
        keysToInvalidate.push(key);
      });

      if (keysToInvalidate.length > 0) {
        set((state) => {
          const newComponentsMap = new Map(state.componentsMap);
          keysToInvalidate.forEach((key) => newComponentsMap.delete(key));
          return { componentsMap: newComponentsMap };
        });
      }
    },

    invalidateComponents: (projectDir, placement) => {
      if (projectDir === undefined && placement === undefined) {
        // Clear all
        set({ componentsMap: new Map() });
        return;
      }

      const cacheKey = getComponentsCacheKey(projectDir, placement);
      set((state) => {
        const newComponentsMap = new Map(state.componentsMap);
        newComponentsMap.delete(cacheKey);
        return { componentsMap: newComponentsMap };
      });
    },

    invalidateData: (extensionId, componentId, projectDir, taskId) => {
      if (extensionId === undefined && componentId === undefined && projectDir === undefined && taskId === undefined) {
        // Clear all
        set({ dataMap: new Map() });
        return;
      }

      const cacheKey = getDataCacheKey(extensionId || '', componentId || '', projectDir, taskId);
      set((state) => {
        const newDataMap = new Map(state.dataMap);
        // If partial key, find all matching
        if (!extensionId || !componentId) {
          newDataMap.forEach((_, key) => {
            if ((extensionId === undefined || key.startsWith(extensionId + ':')) && (componentId === undefined || key.includes(':' + componentId + ':'))) {
              newDataMap.delete(key);
            }
          });
        } else {
          newDataMap.delete(cacheKey);
        }
        return { dataMap: newDataMap };
      });
    },

    getComponents: (projectDir, placement) => {
      const cacheKey = getComponentsCacheKey(projectDir, placement);
      return get().componentsMap.get(cacheKey) || [];
    },

    getComponentData: (extensionId, componentId, projectDir, taskId) => {
      const cacheKey = getDataCacheKey(extensionId, componentId, projectDir, taskId);
      return get().dataMap.get(cacheKey);
    },

    isLoadingComponents: (projectDir, placement) => {
      const cacheKey = getComponentsCacheKey(projectDir, placement);
      return get().loadingComponents.has(cacheKey);
    },
  }),
  shallow,
);

// Selector hooks for optimized re-renders
export const useExtensionComponents = (projectDir?: string, placement?: string): ExtensionUIComponent[] => {
  const cacheKey = getComponentsCacheKey(projectDir, placement);
  return useExtensionUIStore(useShallow((state) => state.componentsMap.get(cacheKey) || []));
};

export const useExtensionComponentData = (extensionId: string, componentId: string, projectDir?: string, taskId?: string): unknown => {
  const cacheKey = getDataCacheKey(extensionId, componentId, projectDir, taskId);
  return useExtensionUIStore((state) => state.dataMap.get(cacheKey));
};

export const useIsLoadingComponents = (projectDir?: string, placement?: string): boolean => {
  const cacheKey = getComponentsCacheKey(projectDir, placement);
  return useExtensionUIStore((state) => state.loadingComponents.has(cacheKey));
};
