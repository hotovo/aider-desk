import { TokensInfoData, Mode, ProjectSettings, ContextFile } from '@common/types';

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
  restartTask: () => void;
  mode: Mode;
  showFileDialog: () => void;
  projectSettings: ProjectSettings;
  saveProjectSettings: (settings: Partial<ProjectSettings>) => void;
};

export const SidebarContent = ({
  baseDir,
  taskId,
  allFiles,
  contextFiles,
  tokensInfo,
  aiderTotalCost,
  maxInputTokens,
  clearMessages,
  runCommand,
  restartTask,
  mode,
  showFileDialog,
  projectSettings,
  saveProjectSettings,
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
        />
      </div>
      <CostInfo
        tokensInfo={tokensInfo}
        aiderTotalCost={aiderTotalCost}
        maxInputTokens={maxInputTokens}
        clearMessages={clearMessages}
        refreshRepoMap={() => runCommand('map-refresh')}
        restartTask={restartTask}
        mode={mode}
        projectSettings={projectSettings}
        saveProjectSettings={saveProjectSettings}
      />
    </>
  );
};
