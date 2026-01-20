import React, { useMemo, ReactNode } from 'react';
import { IconContext as ReactIconsIconContext } from 'react-icons';

interface IconProviderProps {
  children: ReactNode;
  size?: string | number;
  color?: string;
  className?: string;
  style?: React.CSSProperties;
  attr?: React.SVGAttributes<SVGElement>;
}

export const IconProvider: React.FC<IconProviderProps> = ({ children, size = '1em', color = 'currentColor', className, style, attr }) => {
  const contextValue = useMemo(
    () => ({
      size: typeof size === 'number' ? `${size}px` : size,
      color,
      className,
      style,
      attr,
    }),
    [size, color, className, style, attr],
  );

  return <ReactIconsIconContext.Provider value={contextValue}>{children}</ReactIconsIconContext.Provider>;
};
