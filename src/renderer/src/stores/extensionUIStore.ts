import { useShallow } from 'zustand/react/shallow';
import { createWithEqualityFn } from 'zustand/traditional';
import { shallow } from 'zustand/vanilla/shallow';
import { ExtensionUIComponent, ExtensionUIRefreshData } from '@common/types';
import { ApplicationAPI } from '@common/api';

const getComponentsCacheKey = (placement?: string, projectDir?: string, taskId?: string): string =>
  `${placement || 'default'}:${projectDir || 'global'}:${taskId || ''}`;

const getDataCacheKey = (extensionId: string, componentId: string, projectDir?: string, taskId?: string): string =>
  `${extensionId}:${componentId}:${projectDir || ''}:${taskId || ''}`;

interface ExtensionUIState {
  componentsMap: Map<string, ExtensionUIComponent[]>;
  dataMap: Map<string, unknown>;
  dataLoadedMap: Map<string, boolean>;
  loadingComponents: Set<string>;
  loadingData: Set<string>;
  initialized: boolean;
}

interface ExtensionUIActions {
  loadComponents: (api: ApplicationAPI, placement?: string, projectDir?: string, taskId?: string) => Promise<ExtensionUIComponent[]>;
  loadComponentData: (
    api: ApplicationAPI,
    extensionId: string,
    componentId: string,
    projectDir?: string,
    taskId?: string,
    forceRefresh?: boolean,
  ) => Promise<unknown>;
  handleRefreshEvent: (api: ApplicationAPI, data: ExtensionUIRefreshData, projectDir?: string, taskId?: string) => void;
  invalidateComponents: (placement?: string, projectDir?: string, taskId?: string) => void;
  invalidateData: (extensionId?: string, componentId?: string, projectDir?: string, taskId?: string) => void;
  getComponents: (placement?: string, projectDir?: string, taskId?: string) => ExtensionUIComponent[] | undefined;
  getComponentData: (extensionId: string, componentId: string, projectDir?: string, taskId?: string) => unknown;
  isDataLoaded: (extensionId: string, componentId: string, projectDir?: string, taskId?: string) => boolean;
  isLoadingComponents: (placement?: string, projectDir?: string, taskId?: string) => boolean;
}

type ExtensionUIStore = ExtensionUIState & ExtensionUIActions;

export const useExtensionUIStore = createWithEqualityFn<ExtensionUIStore>(
  (set, get) => ({
    componentsMap: new Map(),
    dataMap: new Map(),
    dataLoadedMap: new Map(),
    loadingComponents: new Set(),
    loadingData: new Set(),
    initialized: false,

    loadComponents: async (api, placement, projectDir, taskId) => {
      const cacheKey = getComponentsCacheKey(placement, projectDir, taskId);
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
        const components = await api.getExtensionUIComponents(placement, projectDir, taskId);

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
      const isLoaded = state.dataLoadedMap.get(cacheKey) || false;

      // Return cached if available and not forcing refresh
      if (hasCachedData && isLoaded && !forceRefresh) {
        return state.dataMap.get(cacheKey);
      }

      // Prevent duplicate requests (only block if no cached data to show)
      if (state.loadingData.has(cacheKey)) {
        // If we have cached data, return it immediately (stale-while-revalidate)
        if (hasCachedData && isLoaded) {
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
          const newDataLoadedMap = new Map(state.dataLoadedMap);
          newDataLoadedMap.set(cacheKey, true);
          const newLoadingData = new Set(state.loadingData);
          newLoadingData.delete(cacheKey);
          return {
            dataMap: newDataMap,
            dataLoadedMap: newDataLoadedMap,
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
      // Note: We invalidate keys even if they have empty arrays, because an extension
      // might now return components after settings change (e.g., toggling a feature on)
      const keysToInvalidate: string[] = [];
      state.componentsMap.forEach((components, key) => {
        // Only filter by extensionId if the cache has components to check against
        // Empty caches should still be invalidated since the extension may now return components
        if (components.length > 0 && data.extensionId !== undefined && !components.some((c) => c.extensionId === data.extensionId)) {
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

    invalidateComponents: (placement, projectDir, taskId) => {
      if (placement === undefined && projectDir === undefined && taskId === undefined) {
        // Clear all
        set({ componentsMap: new Map() });
        return;
      }

      const cacheKey = getComponentsCacheKey(placement, projectDir, taskId);
      set((state) => {
        const newComponentsMap = new Map(state.componentsMap);
        newComponentsMap.delete(cacheKey);
        return { componentsMap: newComponentsMap };
      });
    },

    invalidateData: (extensionId, componentId, projectDir, taskId) => {
      if (extensionId === undefined && componentId === undefined && projectDir === undefined && taskId === undefined) {
        // Clear all
        set({ dataMap: new Map(), dataLoadedMap: new Map() });
        return;
      }

      const cacheKey = getDataCacheKey(extensionId || '', componentId || '', projectDir, taskId);
      set((state) => {
        const newDataMap = new Map(state.dataMap);
        const newDataLoadedMap = new Map(state.dataLoadedMap);
        // If partial key, find all matching
        if (!extensionId || !componentId) {
          newDataMap.forEach((_, key) => {
            if ((extensionId === undefined || key.startsWith(extensionId + ':')) && (componentId === undefined || key.includes(':' + componentId + ':'))) {
              newDataMap.delete(key);
              newDataLoadedMap.delete(key);
            }
          });
        } else {
          newDataMap.delete(cacheKey);
          newDataLoadedMap.delete(cacheKey);
        }
        return { dataMap: newDataMap, dataLoadedMap: newDataLoadedMap };
      });
    },

    getComponents: (placement, projectDir, taskId) => {
      const cacheKey = getComponentsCacheKey(placement, projectDir, taskId);
      return get().componentsMap.get(cacheKey);
    },

    getComponentData: (extensionId, componentId, projectDir, taskId) => {
      const cacheKey = getDataCacheKey(extensionId, componentId, projectDir, taskId);
      const state = get();
      const isLoaded = state.dataLoadedMap.get(cacheKey) || false;

      if (!isLoaded) {
        return undefined;
      }

      return state.dataMap.get(cacheKey);
    },

    isDataLoaded: (extensionId, componentId, projectDir, taskId) => {
      const cacheKey = getDataCacheKey(extensionId, componentId, projectDir, taskId);
      return get().dataLoadedMap.get(cacheKey) || false;
    },

    isLoadingComponents: (placement, projectDir, taskId) => {
      const cacheKey = getComponentsCacheKey(placement, projectDir, taskId);
      return get().loadingComponents.has(cacheKey);
    },
  }),
  shallow,
);

// Selector hooks for optimized re-renders
export const useExtensionComponents = (placement?: string, projectDir?: string, taskId?: string): ExtensionUIComponent[] | undefined => {
  const cacheKey = getComponentsCacheKey(placement, projectDir, taskId);
  return useExtensionUIStore(useShallow((state) => state.componentsMap.get(cacheKey)));
};

export const useExtensionComponentData = (extensionId: string, componentId: string, projectDir?: string, taskId?: string): unknown => {
  const cacheKey = getDataCacheKey(extensionId, componentId, projectDir, taskId);
  return useExtensionUIStore((state) => state.dataMap.get(cacheKey));
};

export const useIsLoadingComponents = (placement?: string, projectDir?: string, taskId?: string): boolean => {
  const cacheKey = getComponentsCacheKey(placement, projectDir, taskId);
  return useExtensionUIStore((state) => state.loadingComponents.has(cacheKey));
};
