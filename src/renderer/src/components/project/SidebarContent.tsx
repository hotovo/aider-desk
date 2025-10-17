import { TokensInfoData, Mode, ProjectSettings } from '@common/types';

import { ContextFiles } from '@/components/ContextFiles';
import { CostInfo } from '@/components/CostInfo';

type Props = {
  baseDir: string;
  allFiles: string[];
  tokensInfo: TokensInfoData | null;
  aiderTotalCost: number;
  maxInputTokens: number;
  clearMessages: (clearContext?: boolean) => void;
  runCommand: (command: string) => void;
  restartProject: () => void;
  mode: Mode;
  showFileDialog: () => void;
  projectSettings: ProjectSettings;
  saveProjectSettings: (settings: Partial<ProjectSettings>) => void;
};

export const SidebarContent = ({
  baseDir,
  allFiles,
  tokensInfo,
  aiderTotalCost,
  maxInputTokens,
  clearMessages,
  runCommand,
  restartProject,
  mode,
  showFileDialog,
  projectSettings,
  saveProjectSettings,
}: Props) => {
  return (
    <>
      <div className="flex-grow flex flex-col overflow-y-hidden">
        <ContextFiles baseDir={baseDir} allFiles={allFiles} showFileDialog={showFileDialog} tokensInfo={tokensInfo} />
      </div>
      <CostInfo
        tokensInfo={tokensInfo}
        aiderTotalCost={aiderTotalCost}
        maxInputTokens={maxInputTokens}
        clearMessages={clearMessages}
        refreshRepoMap={() => runCommand('map-refresh')}
        restartProject={restartProject}
        mode={mode}
        projectSettings={projectSettings}
        saveProjectSettings={saveProjectSettings}
      />
    </>
  );
};
