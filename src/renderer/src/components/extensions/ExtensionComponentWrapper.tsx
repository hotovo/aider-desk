import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import JsxParser from 'react-jsx-parser';
import { ExtensionUIComponent } from '@common/types';
import { UIComponentProps } from '@common/extensions';
import { twMerge } from 'tailwind-merge';

import { ExtensionUIErrorBoundary } from '@/components/extensions/ExtensionUIErrorBoundary';
import { useApi } from '@/contexts/ApiContext';

type Props = {
  componentProps: UIComponentProps;
  placement: string;
  className?: string;
  direction?: 'horizontal' | 'vertical';
  additionalProps?: Record<string, unknown>;
};

export const ExtensionComponentWrapper = ({ componentProps, placement, className, direction = 'horizontal', additionalProps }: Props) => {
  const [components, setComponents] = useState<ExtensionUIComponent[]>([]);
  const [componentData, setComponentData] = useState<Record<string, unknown>>({});
  const [refreshKey, setRefreshKey] = useState(0);
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
  }, [api, componentProps.projectDir, refreshKey, placement]);

  useEffect(() => {
    const loadData = async () => {
      const newData: Record<string, unknown> = {};
      for (const comp of components) {
        try {
          newData[`${comp.extensionId}-${comp.componentId}`] = await api.getUIExtensionData(comp.extensionId, comp.componentId, componentProps.projectDir);
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
  }, [api, componentProps.projectDir, components, refreshKey]);

  useEffect(() => {
    if (!componentProps.projectDir) {
      return undefined;
    }
    return api.onExtensionUIRefresh(componentProps.projectDir, ({ componentId }) => {
      if (componentId && !components.some((c) => c.componentId === componentId)) {
        return;
      }
      setRefreshKey((prev) => prev + 1);
    });
  }, [api, componentProps.projectDir, components]);

  const getBindings = (comp: ExtensionUIComponent) => ({
    React: {
      useState,
      useEffect,
      useMemo,
      useCallback,
      useRef,
    },
    ...componentProps,
    ...additionalProps,
    data: componentData[`${comp.extensionId}-${comp.componentId}`],
  });

  if (components.length === 0) {
    return <div />;
  }

  const renderComponent = (comp: ExtensionUIComponent) => {
    const data = componentData[`${comp.extensionId}-${comp.componentId}`];
    return (
      <ExtensionUIErrorBoundary key={`${comp.extensionId}-${comp.componentId}`} extensionId={comp.extensionId} componentId={comp.componentId}>
        <JsxParser
          key={JSON.stringify(data)}
          bindings={getBindings(comp)}
          jsx={comp.jsx}
          components={{}}
          renderInWrapper={false}
          showWarnings={false}
          onError={(error: unknown) => {
            // eslint-disable-next-line no-console
            console.error(`[Extension UI Parse Error] ${comp.extensionId}/${comp.componentId}:`, error);
          }}
        />
      </ExtensionUIErrorBoundary>
    );
  };

  return (
    <div className={twMerge('flex items-center gap-2 flex-wrap', direction === 'horizontal' ? 'flex-row' : 'flex-col', className)}>
      {components.map(renderComponent)}
    </div>
  );
};
