import { memo } from 'react';
import { twMerge } from 'tailwind-merge';

import { useExtensionComponentsWrapper } from '@/components/extensions/useExtensionComponentsWrapper';
import { useSettingsStore } from '@/stores/settingsStore';

type Props = {
  placement: string;
  className?: string;
  direction?: 'horizontal' | 'vertical';
  additionalProps?: Record<string, unknown>;
  renderNullOnEmpty?: boolean;
  projectDir?: string;
  taskId?: string;
  actionProjectDir?: string;
  actionTaskId?: string;
};

const ExtensionComponentWrapperInner = ({
  placement,
  className,
  direction = 'horizontal',
  additionalProps,
  renderNullOnEmpty = false,
  projectDir,
  taskId,
  actionProjectDir,
  actionTaskId,
}: Props) => {
  const readonlyExtensionUi = useSettingsStore((store) => store.readonlyExtensionUi);

  const { isEmpty, renderComponents } = useExtensionComponentsWrapper({ placement, additionalProps, projectDir, taskId, actionProjectDir, actionTaskId });

  if (readonlyExtensionUi === false) {
    return renderNullOnEmpty ? null : <div></div>;
  }

  if (isEmpty) {
    return renderNullOnEmpty ? null : <div></div>;
  }

  return <div className={twMerge('flex items-center flex-wrap', direction === 'horizontal' ? 'flex-row' : 'flex-col', className)}>{renderComponents()}</div>;
};

export const ExtensionComponentWrapper = memo(ExtensionComponentWrapperInner);
