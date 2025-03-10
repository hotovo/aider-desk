import { BiCopy } from 'react-icons/bi';

import { IconButton } from '../common/IconButton';

import { showInfoNotification } from '@/utils/notifications';

type Props = {
  content: string;
  className?: string;
};

export const CopyMessageButton = ({ content, className }: Props) => {
  const copyToClipboard = () => {
    navigator.clipboard.writeText(content);
    showInfoNotification('Copied to clipboard');
  };

  return (
    <IconButton
      icon={<BiCopy className={`h-4 w-4 ${className}`} />}
      onClick={copyToClipboard}
      tooltip="Copy to clipboard"
      className="opacity-0 group-hover:opacity-100"
    />
  );
};
