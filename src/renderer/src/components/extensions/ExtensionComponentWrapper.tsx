import { memo, useCallback, useEffect, useMemo, useRef, useState } from 'react';
import StringToReactComponent from 'string-to-react-component';
import { ExtensionUIComponent } from '@common/types';
import { twMerge } from 'tailwind-merge';

import { ExtensionUIErrorBoundary } from '@/components/extensions/ExtensionUIErrorBoundary';
import { useApi } from '@/contexts/ApiContext';
import { useExtensions } from '@/contexts/ExtensionsContext';
import { useExtensionUIStore, useExtensionComponents } from '@/stores/extensionUIStore';

type Props = {
  placement: string;
  className?: string;
  direction?: 'horizontal' | 'vertical';
  additionalProps?: Record<string, unknown>;
};

const ExtensionComponentWrapperInner = ({ placement, className, direction = 'horizontal', additionalProps }: Props) => {
  const { componentProps } = useExtensions();
  const api = useApi();
  const store = useExtensionUIStore();

  // Use cached components from store
  const components = useExtensionComponents(componentProps.projectDir, placement);

  // Load components on mount or when cache is empty
  useEffect(() => {
    if (components.length === 0) {
      void store.loadComponents(api, componentProps.projectDir, placement);
    }
  }, [api, componentProps.projectDir, placement, components.length, store]);

  // Load data for all components that need it
  useEffect(() => {
    if (components.length > 0) {
      void store.loadAllComponentsData(api, components, componentProps.projectDir, componentProps.task?.id);
    }
  }, [api, componentProps.projectDir, componentProps.task?.id, components, store]);

  // Handle refresh events
  useEffect(() => {
    return api.onExtensionUIRefresh((data) => {
      const currentProjectDir = componentProps.projectDir;
      const currentTaskId = componentProps.task?.id;

      // Filter by project
      if (data.projectDir !== undefined && data.projectDir !== currentProjectDir) {
        return;
      }

      if (data.reloadComponents) {
        // Handle component reload via store
        store.handleRefreshEvent(api, data, currentProjectDir, currentTaskId);
        void store.loadComponents(api, currentProjectDir, placement);
      } else {
        // Filter by task for data refresh
        if (data.taskId !== undefined && data.taskId !== currentTaskId) {
          return;
        }

        // Reload data for affected components (stale-while-revalidate)
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
        React: {
          useState,
          useEffect,
          useMemo,
          useCallback,
          useRef,
        },
        ...componentProps,
        ...additionalProps,
        executeExtensionAction,
        data: store.getComponentData(comp.extensionId, comp.componentId, componentProps.projectDir, componentProps.task?.id),
      };
    },
    [api, componentProps, additionalProps, store],
  );

  const renderComponent = useCallback(
    (comp: ExtensionUIComponent) => {
      return (
        <ExtensionUIErrorBoundary key={`${comp.extensionId}-${comp.componentId}`} extensionId={comp.extensionId} componentId={comp.componentId}>
          <StringToReactComponent data={getComponentData(comp)}>{comp.jsx}</StringToReactComponent>
        </ExtensionUIErrorBoundary>
      );
    },
    [getComponentData],
  );

  if (components.length === 0) {
    return null;
  }

  return (
    <div className={twMerge('flex items-center gap-2 flex-wrap', direction === 'horizontal' ? 'flex-row' : 'flex-col', className)}>
      {components.map(renderComponent)}
    </div>
  );
};

export const ExtensionComponentWrapper = memo(ExtensionComponentWrapperInner);
