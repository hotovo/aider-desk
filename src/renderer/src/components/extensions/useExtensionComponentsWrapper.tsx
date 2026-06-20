import { useCallback, useEffect, useMemo, useRef, useState } from 'react';

import { ExtensionComponentRenderer } from './ExtensionComponentRenderer';

import { useApi } from '@/contexts/ApiContext';
import { useExtensions } from '@/contexts/ExtensionsContext';
import {
  handleExtensionUIRefreshEvent,
  isExtensionUIDataLoaded,
  loadExtensionComponentData,
  loadExtensionUIComponents,
  useExtensionComponents,
} from '@/stores/extensionUIStore';
import { useReactIcons } from '@/utils/extension-icons';
import { loadAllLibraries } from '@/utils/extension-library-loader';

type UseExtensionComponentsWrapperProps = {
  placement: string;
  additionalProps?: Record<string, unknown>;
  projectDir?: string;
  taskId?: string;
  actionProjectDir?: string;
  actionTaskId?: string;
};

export const useExtensionComponentsWrapper = ({
  placement,
  additionalProps,
  projectDir,
  taskId,
  actionProjectDir,
  actionTaskId,
}: UseExtensionComponentsWrapperProps) => {
  const { componentProps } = useExtensions();
  const api = useApi();
  const icons = useReactIcons();
  const currentProjectDir = projectDir ?? componentProps.projectDir;
  const currentTaskId = taskId ?? componentProps.task?.id;
  const currentActionProjectDir = actionProjectDir ?? currentProjectDir;
  const currentActionTaskId = actionTaskId ?? currentTaskId;

  const components = useExtensionComponents(placement, currentProjectDir, currentTaskId);

  // Track which components have been loaded in this mount to prevent infinite loops with noDataCache
  const loadedComponentsRef = useRef<Set<string>>(new Set());

  // Load libraries for all components that declare them
  const [libraries, setLibraries] = useState<Record<string, Record<string, unknown>>>({});

  useEffect(() => {
    if (!components) {
      return;
    }

    const mergedLibraries: Record<string, string> = {};
    for (const comp of components) {
      if (comp.libraries) {
        Object.assign(mergedLibraries, comp.libraries);
      }
    }
    if (Object.keys(mergedLibraries).length === 0) {
      return;
    }

    let cancelled = false;
    void loadAllLibraries(api, mergedLibraries)
      .then((loaded) => {
        if (!cancelled) {
          setLibraries(loaded);
        }
      })
      .catch((err) => {
        // eslint-disable-next-line no-console
        console.error('[ExtensionLibLoader] Failed to load libraries:', err);
      });

    return () => {
      cancelled = true;
    };
  }, [api, components]);

  // Load components list if not yet loaded
  useEffect(() => {
    if (components === undefined) {
      void loadExtensionUIComponents(api, placement, currentProjectDir, currentTaskId);
    }
  }, [api, currentProjectDir, placement, components, currentTaskId]);

  // Reset loaded components tracking when components list changes
  useEffect(() => {
    loadedComponentsRef.current = new Set();
  }, [components]);

  // Load data for each component individually
  useEffect(() => {
    if (!components) {
      return;
    }

    const componentsWithData = components.filter((comp) => comp.loadData);

    componentsWithData.forEach((comp) => {
      const componentKey = `${comp.extensionId}:${comp.componentId}:${currentProjectDir}:${currentTaskId}`;
      const isLoaded = isExtensionUIDataLoaded(comp.extensionId, comp.componentId, currentProjectDir, currentTaskId);
      const hasBeenLoadedThisMount = loadedComponentsRef.current.has(componentKey);

      // For noDataCache components, only load once per mount (unless explicitly refreshed)
      // For normal components, only load if not already loaded
      const shouldLoad = comp.noDataCache ? !hasBeenLoadedThisMount : !isLoaded;

      if (shouldLoad) {
        loadedComponentsRef.current.add(componentKey);
        void loadExtensionComponentData(api, comp.extensionId, comp.componentId, currentProjectDir, currentTaskId, comp.noDataCache);
      }
    });
  }, [api, currentProjectDir, currentTaskId, components]);

  useEffect(() => {
    return api.onExtensionUIRefresh((data) => {
      if (data.projectDir !== undefined && data.projectDir !== currentProjectDir) {
        return;
      }

      if (data.reloadComponents) {
        handleExtensionUIRefreshEvent(api, data, currentProjectDir, currentTaskId);
        void loadExtensionUIComponents(api, placement, currentProjectDir);
      } else {
        if (data.taskId !== undefined && data.taskId !== currentTaskId) {
          return;
        }

        if (!components) {
          return;
        }

        const affectedComponents = components.filter((c) => {
          if (data.extensionId !== undefined && data.extensionId !== c.extensionId) {
            return false;
          }
          if (data.componentId !== undefined && data.componentId !== c.componentId) {
            return false;
          }
          return c.loadData;
        });

        if (affectedComponents.length > 0) {
          affectedComponents.forEach((comp) => {
            const componentKey = `${comp.extensionId}:${comp.componentId}:${currentProjectDir}:${currentTaskId}`;
            // Remove from tracking so it can be loaded again
            loadedComponentsRef.current.delete(componentKey);

            void loadExtensionComponentData(
              api,
              comp.extensionId,
              comp.componentId,
              currentProjectDir,
              currentTaskId,
              true, // forceRefresh
            );
          });
        }
      }
    });
  }, [api, currentProjectDir, currentTaskId, components, placement]);

  const componentLibraries = useMemo(() => ({ ...componentProps.libraries, ...libraries }), [componentProps.libraries, libraries]);

  const renderComponents = useCallback(() => {
    if (!components) {
      return [];
    }

    if (!icons) {
      return [];
    }

    return components.map((comp) => (
      <ExtensionComponentRenderer
        key={`${comp.extensionId}-${comp.componentId}`}
        comp={comp}
        componentProps={componentProps}
        additionalProps={additionalProps}
        libraries={componentLibraries}
        currentProjectDir={currentProjectDir}
        currentTaskId={currentTaskId}
        currentActionProjectDir={currentActionProjectDir}
        currentActionTaskId={currentActionTaskId}
        api={api}
      />
    ));
  }, [
    components,
    componentProps,
    additionalProps,
    componentLibraries,
    currentProjectDir,
    currentTaskId,
    currentActionProjectDir,
    currentActionTaskId,
    api,
    icons,
  ]);

  return {
    components,
    renderComponents,
    isEmpty: !components || components.length === 0,
  };
};
