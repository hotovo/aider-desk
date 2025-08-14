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
    className="!bg-bg-primary-light !text-text-secondary !text-2xs !py-1 !px-2 !opacity-100 !rounded-md z-50 whitespace-pre-wrap select-none"
    border="1px solid #495057"
    delayShow={200}
    style={{
      maxWidth,
    }}
  >
    {content}
  </Tooltip>
);
