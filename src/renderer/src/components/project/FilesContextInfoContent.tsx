import { ContextFile, Mode, TaskData, TokensInfoData } from '@common/types';

import { ContextFiles } from '@/components/ContextFiles';
import { CostInfo } from '@/components/CostInfo';

type Props = {
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
  showFileDialog: () => void;
  task: TaskData;
  updateTask: (taskId: string, updates: Partial<TaskData>) => void;
  refreshAllFiles: (useGit?: boolean) => Promise<void>;
};

export const FilesContextInfoContent = ({
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
  showFileDialog,
  task,
  updateTask,
  refreshAllFiles,
}: Props) => {
  return (
    <>
      <div className="flex-grow flex flex-col overflow-y-hidden">
        <ContextFiles
          baseDir={baseDir}
          taskId={taskId}
          allFiles={allFiles}
          contextFiles={contextFiles}
          showFileDialog={showFileDialog}
          tokensInfo={tokensInfo}
          refreshAllFiles={refreshAllFiles}
          mode={mode}
        />
      </div>
      <CostInfo
        tokensInfo={tokensInfo}
        aiderTotalCost={aiderTotalCost}
        maxInputTokens={maxInputTokens}
        clearMessages={clearMessages}
        refreshRepoMap={() => runCommand('map-refresh')}
        resetTask={resetTask}
        mode={mode}
        task={task}
        updateTask={updateTask}
      />
    </>
  );
};
