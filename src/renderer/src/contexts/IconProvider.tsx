import React, { createContext, useContext, useMemo, ReactNode } from 'react';
import { IconContext as ReactIconsIconContext } from 'react-icons';

const IconProviderContext = createContext<React.ContextType<typeof ReactIconsIconContext> | undefined>(undefined);

interface IconProviderProps {
  children: ReactNode;
  size?: string | number;
  color?: string;
  className?: string;
  style?: React.CSSProperties;
  attr?: React.SVGAttributes<SVGElement>;
}

export const IconProvider: React.FC<IconProviderProps> = ({
  children,
  size = '1em',
  color = 'currentColor',
  className,
  style,
  attr,
}) => {
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

  return <IconProviderContext.Provider value={contextValue}>{children}</IconProviderContext.Provider>;
};

export const useIconContext = () => useContext(IconProviderContext);
