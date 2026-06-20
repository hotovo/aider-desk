import { memo, useCallback, useMemo } from 'react';
import { ApplicationAPI } from '@common/api';
import { UIComponentProps } from '@common/extensions';
import { ExtensionUIComponent } from '@common/types';

import StringToReactComponent from './StringToReactComponent';

import { ExtensionUIErrorBoundary } from '@/components/extensions/ExtensionUIErrorBoundary';
import { useExtensionComponentData } from '@/stores/extensionUIStore';

type Props = {
  comp: ExtensionUIComponent;
  componentProps: UIComponentProps;
  additionalProps?: Record<string, unknown>;
  libraries: Record<string, Record<string, unknown>>;
  currentProjectDir?: string;
  currentTaskId?: string;
  currentActionProjectDir?: string;
  currentActionTaskId?: string;
  api: ApplicationAPI;
};

const ExtensionComponentRendererInner = ({
  comp,
  componentProps,
  additionalProps,
  libraries,
  currentProjectDir,
  currentTaskId,
  currentActionProjectDir,
  currentActionTaskId,
  api,
}: Props) => {
  const data = useExtensionComponentData(comp.extensionId, comp.componentId, currentProjectDir, currentTaskId);

  const executeExtensionAction = useCallback(
    async (action: string, ...args: unknown[]) => {
      return await api.executeUIExtensionAction(comp.extensionId, comp.componentId, action, args, currentActionProjectDir, currentActionTaskId);
    },
    [api, comp.extensionId, comp.componentId, currentActionProjectDir, currentActionTaskId],
  );

  const componentData = useMemo(
    () => ({
      ...componentProps,
      ...additionalProps,
      executeExtensionAction,
      libraries,
      data,
    }),
    [componentProps, additionalProps, libraries, data, executeExtensionAction],
  );

  return (
    <ExtensionUIErrorBoundary extensionId={comp.extensionId} componentId={comp.componentId}>
      <StringToReactComponent data={componentData}>{comp.jsx}</StringToReactComponent>
    </ExtensionUIErrorBoundary>
  );
};

export const ExtensionComponentRenderer = memo(ExtensionComponentRendererInner);
