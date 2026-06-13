import { ContextFile, Mode, TaskData, TokensInfoData } from '@common/types';

import { Workspace } from '@/components/Workspace';
import { CostInfo } from '@/components/CostInfo';
import { useTaskTokensInfo } from '@/stores/taskStore';

type Props = {
  baseDir: string;
  taskId: string;
  allFiles: string[];
  contextFiles: ContextFile[];
  tokensInfo?: TokensInfoData | null;
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
  onToggleFilesSidebarCollapse?: () => void;
};

export const FilesContextInfoContent = ({
  baseDir,
  taskId,
  allFiles,
  contextFiles,
  tokensInfo: tokensInfoProp,
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
  onToggleFilesSidebarCollapse,
}: Props) => {
  const tokensInfoFromStore = useTaskTokensInfo(taskId);
  const tokensInfo = tokensInfoProp ?? tokensInfoFromStore;

  return (
    <>
      <div className="flex-grow flex flex-col overflow-y-hidden">
        <Workspace
          baseDir={baseDir}
          taskId={taskId}
          allFiles={allFiles}
          contextFiles={contextFiles}
          showFileDialog={showFileDialog}
          tokensInfo={tokensInfo}
          refreshAllFiles={refreshAllFiles}
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
