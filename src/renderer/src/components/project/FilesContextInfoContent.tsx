import { ContextFile, Mode, TaskData } from '@common/types';

import { Workspace } from '@/components/Workspace';
import { CostInfo } from '@/components/CostInfo';
import { useTaskFileTokensInfo, useTaskTokensInfo } from '@/stores/taskStore';

type Props = {
  baseDir: string;
  taskId: string;
  allFiles: string[];
  contextFiles: ContextFile[];
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
  refreshContextFiles: () => Promise<void>;
  onToggleFilesSidebarCollapse?: () => void;
};

export const FilesContextInfoContent = ({
  baseDir,
  taskId,
  allFiles,
  contextFiles,
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
  refreshContextFiles,
  onToggleFilesSidebarCollapse,
}: Props) => {
  const tokensInfo = useTaskTokensInfo(taskId);
  const fileTokensInfo = useTaskFileTokensInfo(taskId);

  return (
    <>
      <div className="flex-grow flex flex-col overflow-y-hidden">
        <Workspace
          baseDir={baseDir}
          taskId={taskId}
          allFiles={allFiles}
          contextFiles={contextFiles}
          showFileDialog={showFileDialog}
          fileTokensInfo={fileTokensInfo}
          refreshAllFiles={refreshAllFiles}
          refreshContextFiles={refreshContextFiles}
          mode={mode}
          onToggleFilesSidebarCollapse={onToggleFilesSidebarCollapse}
          taskName={task.name}
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
