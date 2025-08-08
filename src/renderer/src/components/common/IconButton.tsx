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
};

export const IconButton = ({ icon, onClick, tooltip, className, tooltipId, disabled }: Props) => {
  const tooltipIdRef = useRef<string>(tooltipId || `icon-button-tooltip-${uuidv4()}`);

  const combinedClassName = clsx(
    'text-text-muted',
    'transition-opacity',
    'focus:outline-none',
    disabled ? 'cursor-not-allowed opacity-50' : 'cursor-pointer hover:text-text-tertiary',
    className,
  );

  const handleClick = (e: MouseEvent<HTMLDivElement>) => {
    e.stopPropagation();
    onClick();
  };

  const renderButton = () => (
    <div
      onClick={disabled ? undefined : handleClick}
      data-tooltip-id={tooltip ? tooltipIdRef.current : undefined}
      data-tooltip-content={typeof tooltip === 'string' && tooltipId ? tooltip : undefined}
      className={combinedClassName}
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
