import { useState } from 'react';
import { FaChevronDown, FaChevronRight } from 'react-icons/fa';
import { BiTerminal } from 'react-icons/bi';

import { CodeBlock } from '@/components/common/CodeBlock';

type Props = {
  baseDir: string;
  command: string;
  output: string;
};

export const CustomCommandBashBlock = ({ baseDir, command, output }: Props) => {
  const [isOpen, setIsOpen] = useState(false);

  const toggleAccordion = () => {
    setIsOpen(!isOpen);
  };

  return (
    <div className="my-2 border border-border-dark rounded-md bg-bg-primary">
      <button
        className="w-full flex items-center justify-between p-2 bg-bg-tertiary hover:bg-bg-primary-light transition-colors duration-200 rounded-t-md"
        onClick={toggleAccordion}
      >
        <div className="flex items-center gap-2">
          <BiTerminal className="text-text-secondary h-4 w-4" />
          <span className="text-xs">{command}</span>
        </div>
        {isOpen ? <FaChevronDown className="w-3 h-3" /> : <FaChevronRight className="w-3 h-3" />}
      </button>
      {isOpen && (
        <div className="px-2 overflow-y-auto">
          <CodeBlock baseDir={baseDir} language="bash" isComplete={true}>
            {output}
          </CodeBlock>
        </div>
      )}
    </div>
  );
};
