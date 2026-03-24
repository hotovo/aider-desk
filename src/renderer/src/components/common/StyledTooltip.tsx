import { ReactNode } from 'react';

type Props = {
  id: string;

  content?: ReactNode;

  maxWidth?: number | string;
};

/**
 * @deprecated Use the new Tooltip component directly instead
 */
export const StyledTooltip = ({
  id: _id,

  content: _content,

  maxWidth: _maxWidth = '300px',
}: Props) => {
  // The new Tooltip component doesn't use ids, so this is a no-op
  // The actual tooltip rendering is handled by the components that wrap
  // their elements with <Tooltip content={...}>
  return null;
};
