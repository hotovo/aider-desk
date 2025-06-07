import { MouseEvent, ReactNode, useRef } from 'react';
import { v4 as uuidv4 } from 'uuid';
import clsx from 'clsx';

import { StyledTooltip } from './StyledTooltip';

type Props = {
  icon: ReactNode;
  onClick: () => void;
  tooltip?: ReactNode;
  className?: string;
  tooltipId?: string;
  disabled?: boolean;
  style?: React.CSSProperties;
  onMouseEnter?: (e: React.MouseEvent<HTMLDivElement>) => void;
  onMouseLeave?: (e: React.MouseEvent<HTMLDivElement>) => void;
};

export const IconButton = ({ icon, onClick, tooltip, className, tooltipId, disabled, style, onMouseEnter, onMouseLeave }: Props) => {
  const tooltipIdRef = useRef<string>(tooltipId || `icon-button-tooltip-${uuidv4()}`);

  const combinedClassName = clsx(
    'transition-colors duration-200',
    'focus:outline-none',
    disabled ? 'cursor-not-allowed opacity-50' : 'cursor-pointer',
    className,
  );
  
  const buttonStyle = {
    color: disabled ? 'var(--theme-foreground-tertiary)' : 'var(--theme-foreground-primary)',
  };

  const handleClick = (e: MouseEvent<HTMLDivElement>) => {
    e.stopPropagation();
    onClick();
  };

  const renderButton = () => (
    <div
      onClick={disabled ? undefined : handleClick}
      onMouseEnter={onMouseEnter}
      onMouseLeave={onMouseLeave}
      data-tooltip-id={tooltip ? tooltipIdRef.current : undefined}
      data-tooltip-content={typeof tooltip === 'string' && tooltipId ? tooltip : undefined}
      className={combinedClassName}
      style={{...buttonStyle, ...style}}
    >
      {icon}
    </div>
  );

  return (
    <>
      {renderButton()}
      {tooltip && !tooltipId && <StyledTooltip id={tooltipIdRef.current} content={tooltip} />}
    </>
  );
};
