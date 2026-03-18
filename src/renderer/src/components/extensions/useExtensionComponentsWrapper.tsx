import { useCallback, useEffect } from 'react';
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

  const components = useExtensionComponents(placement, componentProps.projectDir);

  useEffect(() => {
    if (components.length === 0) {
      void store.loadComponents(api, placement, componentProps.projectDir);
    }
  }, [api, componentProps.projectDir, placement, components.length, store]);

  useEffect(() => {
    if (components.length > 0) {
      void store.loadAllComponentsData(api, components, componentProps.projectDir, componentProps.task?.id);
    }
  }, [api, componentProps.projectDir, componentProps.task?.id, components, store]);

  useEffect(() => {
    return api.onExtensionUIRefresh((data) => {
      const currentProjectDir = componentProps.projectDir;
      const currentTaskId = componentProps.task?.id;

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
          void store.loadAllComponentsData(api, affectedComponents, currentProjectDir, currentTaskId, true);
        }
      }
    });
  }, [api, componentProps.projectDir, componentProps.task?.id, components, placement, store]);

  const getComponentData = useCallback(
    (comp: ExtensionUIComponent) => {
      const executeExtensionAction = async (action: string, ...args: unknown[]) => {
        return await api.executeUIExtensionAction(comp.extensionId, comp.componentId, action, args, componentProps.projectDir, componentProps.task?.id);
      };

      return {
        ...componentProps,
        ...additionalProps,
        executeExtensionAction,
        data: store.getComponentData(comp.extensionId, comp.componentId, componentProps.projectDir, componentProps.task?.id),
      };
    },
    [api, componentProps, additionalProps, store],
  );

  const renderComponents = useCallback(() => {
    return components.map((comp) => (
      <ExtensionUIErrorBoundary key={`${comp.extensionId}-${comp.componentId}`} extensionId={comp.extensionId} componentId={comp.componentId}>
        <StringToReactComponent data={getComponentData(comp)}>{comp.jsx}</StringToReactComponent>
      </ExtensionUIErrorBoundary>
    ));
  }, [components, getComponentData]);

  return {
    components,
    renderComponents,
    isEmpty: components.length === 0,
  };
};
