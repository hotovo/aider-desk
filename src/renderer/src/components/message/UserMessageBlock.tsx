import { CgTerminal } from 'react-icons/cg';
import { FaRegQuestionCircle } from 'react-icons/fa';
import { AiOutlineFileSearch } from 'react-icons/ai';
import { RiRobot2Line } from 'react-icons/ri';
import { GoProjectRoadmap } from 'react-icons/go';

import { CopyMessageButton } from './CopyMessageButton';
import { parseMessageContent } from './utils';

import { UserMessage } from '@/types/message';

type Props = {
  baseDir: string;
  message: UserMessage;
  allFiles: string[];
};

export const UserMessageBlock = ({ baseDir, message, allFiles }: Props) => {
  const baseClasses = 'rounded-md p-3 mb-2 max-w-full break-words whitespace-pre-wrap text-xs bg-neutral-850 border border-neutral-800 text-gray-100';

  return (
    <div className={`${baseClasses} relative flex items-start gap-3 group`}>
      <div className="mt-[1px]">
        {(message.mode === 'code' || !message.mode) && <CgTerminal className="text-neutral-200" size={16} title="Code Mode" />}
        {message.mode === 'ask' && <FaRegQuestionCircle className="text-neutral-200" size={16} title="Ask Mode" />}
        {message.mode === 'architect' && <GoProjectRoadmap className="text-neutral-200" size={16} title="Architect Mode" />}
        {message.mode === 'context' && <AiOutlineFileSearch className="text-neutral-200" size={16} title="Context Mode" />}
        {message.mode === 'agent' && <RiRobot2Line className="text-neutral-200" size={16} title="Agent Mode" />}
      </div>
      <div className="flex-grow-1 max-w-full overflow-hidden">{parseMessageContent(baseDir, message.content, allFiles)}</div>
      <div className="absolute top-2 right-2">
        <CopyMessageButton content={message.content} className="text-neutral-600 hover:text-neutral-300" />
      </div>
    </div>
  );
};
