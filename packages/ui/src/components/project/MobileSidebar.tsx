import React from 'react';
import { motion } from 'framer-motion';
import { clsx } from 'clsx';
import { ContextFile, Mode, TaskData, TokensInfoData } from '@aider-desk/common/types';
import { FiChevronDown } from 'react-icons/fi';

import { FilesContextInfoContent } from '@/components/project/FilesContextInfoContent';

type AddFileDialogOptions = {
  readOnly: boolean;
};

type Props = {
  showSidebar: boolean;
  setShowSidebar: (show: boolean) => void;
  baseDir: string;
  taskId: string;
  allFiles: string[];
  contextFiles: ContextFile[];
  tokensInfo: TokensInfoData | null;
  aiderTotalCost: number;
  maxInputTokens: number;
  clearMessages: (clearContext?: boolean) => void;
  runCommand: (command: string) => void;
  resetTask: () => void;
  mode: Mode;
  setAddFileDialogOptions: React.Dispatch<React.SetStateAction<AddFileDialogOptions | null>>;
  task: TaskData;
  updateTask: (taskId: string, updates: Partial<TaskData>) => void;
  refreshAllFiles: (useGit?: boolean) => Promise<void>;
};

export const MobileSidebar = ({
  showSidebar,
  setShowSidebar,
  baseDir,
  taskId,
  allFiles,
  contextFiles,
  tokensInfo,
  aiderTotalCost,
  maxInputTokens,
  clearMessages,
  runCommand,
  resetTask,
  mode,
  setAddFileDialogOptions,
  task,
  updateTask,
  refreshAllFiles,
}: Props) => {
  return (
    <motion.div
      animate={showSidebar ? { opacity: 1, y: 0 } : { opacity: 0, y: 100 }}
      transition={{ duration: 0.3 }}
      className={clsx('fixed inset-0 bg-black bg-opacity-50 z-30 flex items-end justify-center', !showSidebar && 'pointer-events-none')}
    >
      <div className="bg-bg-primary w-full h-3/4 rounded-t-lg p-4 pt-2 flex flex-col">
        <div onClick={() => setShowSidebar(false)} className="w-full flex justify-center items-center p-1 cursor-pointer">
          <FiChevronDown size={24} />
        </div>
        <FilesContextInfoContent
          baseDir={baseDir}
          taskId={taskId}
          allFiles={allFiles}
          contextFiles={contextFiles}
          tokensInfo={tokensInfo}
          aiderTotalCost={aiderTotalCost}
          maxInputTokens={maxInputTokens}
          clearMessages={clearMessages}
          runCommand={runCommand}
          resetTask={resetTask}
          mode={mode}
          showFileDialog={() =>
            setAddFileDialogOptions({
              readOnly: false,
            })
          }
          task={task}
          updateTask={updateTask}
          refreshAllFiles={refreshAllFiles}
        />
      </div>
    </motion.div>
  );
};
