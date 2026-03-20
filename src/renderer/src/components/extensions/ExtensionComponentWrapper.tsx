import { memo } from 'react';
import { twMerge } from 'tailwind-merge';

import { useExtensionComponentsWrapper } from '@/components/extensions/useExtensionComponentsWrapper';

type Props = {
  placement: string;
  className?: string;
  direction?: 'horizontal' | 'vertical';
  additionalProps?: Record<string, unknown>;
  renderNullOnEmpty?: boolean;
};

const ExtensionComponentWrapperInner = ({ placement, className, direction = 'horizontal', additionalProps, renderNullOnEmpty = false }: Props) => {
  const { isEmpty, renderComponents } = useExtensionComponentsWrapper({ placement, additionalProps });

  if (isEmpty) {
    return renderNullOnEmpty ? null : <div></div>;
  }

  return <div className={twMerge('flex items-center flex-wrap', direction === 'horizontal' ? 'flex-row' : 'flex-col', className)}>{renderComponents()}</div>;
};

export const ExtensionComponentWrapper = memo(ExtensionComponentWrapperInner);
