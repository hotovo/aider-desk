import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import StringToReactComponent from 'string-to-react-component';
import { ExtensionUIComponent } from '@common/types';
import { twMerge } from 'tailwind-merge';

import { ExtensionUIErrorBoundary } from '@/components/extensions/ExtensionUIErrorBoundary';
import { useApi } from '@/contexts/ApiContext';
import { useExtensions } from '@/contexts/ExtensionsContext';

type Props = {
  placement: string;
  className?: string;
  direction?: 'horizontal' | 'vertical';
  additionalProps?: Record<string, unknown>;
};

export const ExtensionComponentWrapper = ({ placement, className, direction = 'horizontal', additionalProps }: Props) => {
  const { componentProps } = useExtensions();
  const [components, setComponents] = useState<ExtensionUIComponent[]>([]);
  const [componentData, setComponentData] = useState<Record<string, unknown>>({});
  const [refreshKey, setRefreshKey] = useState(0);
  const [componentsReloadKey, setComponentsReloadKey] = useState(0);
  const api = useApi();

  useEffect(() => {
    const loadComponents = async () => {
      try {
        const uiComponents = await api.getExtensionUIComponents(componentProps.projectDir, placement);
        setComponents(uiComponents);
      } catch (error) {
        // eslint-disable-next-line no-console
        console.error('Failed to load extension UI components:', error);
      }
    };

    void loadComponents();
  }, [api, componentProps.projectDir, placement, componentsReloadKey]);

  useEffect(() => {
    const loadData = async () => {
      const newData: Record<string, unknown> = {};
      for (const comp of components) {
        if (!comp.loadData) {
          continue;
        }
        try {
          newData[`${comp.extensionId}-${comp.componentId}`] = await api.getUIExtensionData(
            comp.extensionId,
            comp.componentId,
            componentProps.projectDir,
            componentProps.task?.id,
          );
        } catch (error) {
          // eslint-disable-next-line no-console
          console.error(`Failed to load extension UI data for ${comp.extensionId}/${comp.componentId}:`, error);
        }
      }
      setComponentData(newData);
    };

    if (components.length > 0) {
      void loadData();
    }
  }, [api, componentProps.projectDir, componentProps.task?.id, components, refreshKey]);

  useEffect(() => {
    return api.onExtensionUIRefresh((data) => {
      const currentProjectDir = componentProps.projectDir;
      const currentTaskId = componentProps.task?.id;

      if (data.reloadComponents) {
        if (data.projectDir !== undefined && data.projectDir !== currentProjectDir) {
          return;
        }
        if (data.extensionId !== undefined && !components.some((c) => c.extensionId === data.extensionId)) {
          return;
        }
        setComponentsReloadKey((prev) => prev + 1);
        return;
      }

      if (data.projectDir !== undefined && data.projectDir !== currentProjectDir) {
        return;
      }
      if (data.taskId !== undefined && data.taskId !== currentTaskId) {
        return;
      }
      if (data.extensionId !== undefined && !components.some((c) => c.extensionId === data.extensionId)) {
        return;
      }
      if (data.componentId !== undefined && !components.some((c) => c.componentId === data.componentId)) {
        return;
      }
      setRefreshKey((prev) => prev + 1);
    });
  }, [api, componentProps.projectDir, componentProps.task?.id, components]);

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
        data: componentData[`${comp.extensionId}-${comp.componentId}`],
      };
    },
    [api, componentProps, additionalProps, componentData],
  );

  if (components.length === 0) {
    return <div />;
  }

  const renderComponent = (comp: ExtensionUIComponent) => {
    return (
      <ExtensionUIErrorBoundary key={`${comp.extensionId}-${comp.componentId}`} extensionId={comp.extensionId} componentId={comp.componentId}>
        <StringToReactComponent data={getComponentData(comp)}>{comp.jsx}</StringToReactComponent>
      </ExtensionUIErrorBoundary>
    );
  };

  return (
    <div className={twMerge('flex items-center gap-2 flex-wrap', direction === 'horizontal' ? 'flex-row' : 'flex-col', className)}>
      {components.map(renderComponent)}
    </div>
  );
};
