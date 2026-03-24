import { useCallback, useEffect, useRef } from 'react';
import StringToReactComponent from 'string-to-react-component';
import { ExtensionUIComponent } from '@common/types';

import { ExtensionUIErrorBoundary } from '@/components/extensions/ExtensionUIErrorBoundary';
import { useApi } from '@/contexts/ApiContext';
import { useExtensions } from '@/contexts/ExtensionsContext';
import { useExtensionComponents, useExtensionUIStore } from '@/stores/extensionUIStore';

type UseExtensionComponentsWrapperProps = {
  placement: string;
  additionalProps?: Record<string, unknown>;
};

export const useExtensionComponentsWrapper = ({ placement, additionalProps }: UseExtensionComponentsWrapperProps) => {
  const { componentProps } = useExtensions();
  const api = useApi();
  const store = useExtensionUIStore();
  const currentProjectDir = componentProps.projectDir;
  const currentTaskId = componentProps.task?.id;

  const components = useExtensionComponents(placement, currentProjectDir, currentTaskId);

  // Track which components have been loaded in this mount to prevent infinite loops with noDataCache
  const loadedComponentsRef = useRef<Set<string>>(new Set());

  // Load components list if not yet loaded
  useEffect(() => {
    if (components === undefined) {
      void store.loadComponents(api, placement, currentProjectDir, currentTaskId);
    }
  }, [api, currentProjectDir, placement, components, store, currentTaskId]);

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
      const isLoaded = store.isDataLoaded(comp.extensionId, comp.componentId, currentProjectDir, currentTaskId);
      const hasBeenLoadedThisMount = loadedComponentsRef.current.has(componentKey);

      // For noDataCache components, only load once per mount (unless explicitly refreshed)
      // For normal components, only load if not already loaded
      const shouldLoad = comp.noDataCache ? !hasBeenLoadedThisMount : !isLoaded;

      if (shouldLoad) {
        loadedComponentsRef.current.add(componentKey);
        void store.loadComponentData(api, comp.extensionId, comp.componentId, currentProjectDir, currentTaskId, comp.noDataCache);
      }
    });
  }, [api, currentProjectDir, currentTaskId, components, store]);

  useEffect(() => {
    return api.onExtensionUIRefresh((data) => {
      if (data.projectDir !== undefined && data.projectDir !== currentProjectDir) {
        return;
      }

      if (data.reloadComponents) {
        store.handleRefreshEvent(api, data, currentProjectDir, currentTaskId);
        void store.loadComponents(api, placement, currentProjectDir);
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

            void store.loadComponentData(
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
  }, [api, currentProjectDir, currentTaskId, components, placement, store]);

  const getComponentData = useCallback(
    (comp: ExtensionUIComponent) => {
      const executeExtensionAction = async (action: string, ...args: unknown[]) => {
        return await api.executeUIExtensionAction(comp.extensionId, comp.componentId, action, args, currentProjectDir, currentTaskId);
      };

      return {
        ...componentProps,
        ...additionalProps,
        executeExtensionAction,
        data: store.getComponentData(comp.extensionId, comp.componentId, currentProjectDir, currentTaskId),
      };
    },
    [componentProps, additionalProps, store, currentProjectDir, currentTaskId, api],
  );

  const renderComponents = useCallback(() => {
    if (!components) {
      return [];
    }

    return components.map((comp) => (
      <ExtensionUIErrorBoundary key={`${comp.extensionId}-${comp.componentId}`} extensionId={comp.extensionId} componentId={comp.componentId}>
        <StringToReactComponent data={getComponentData(comp)}>{comp.jsx}</StringToReactComponent>
      </ExtensionUIErrorBoundary>
    ));
  }, [components, getComponentData]);

  return {
    components,
    renderComponents,
    isEmpty: !components || components.length === 0,
  };
};
