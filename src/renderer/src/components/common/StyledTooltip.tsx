import { ReactNode } from 'react';
import { Tooltip } from 'react-tooltip';

type Props = {
  id: string;
  content?: ReactNode;
  maxWidth?: number | string;
};

export const StyledTooltip = ({ id, content, maxWidth = '300px' }: Props) => (
  <Tooltip
    id={id}
    className="!text-2xs !py-1 !px-2 !opacity-100 !rounded-md z-50 whitespace-pre-wrap select-none"
    border={`1px solid var(--theme-border-primary)`}
    delayShow={200}
    style={{
      maxWidth,
      backgroundColor: 'var(--theme-background-tertiary)',
      color: 'var(--theme-foreground-primary)',
    }}
  >
    {content}
  </Tooltip>
);
