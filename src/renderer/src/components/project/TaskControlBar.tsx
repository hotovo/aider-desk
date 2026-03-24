import { AIDER_MODES, Mode, TaskData } from '@common/types';
import { useTranslation } from 'react-i18next';
import { FaInfoCircle } from 'react-icons/fa';
import { MdPlaylistRemove } from 'react-icons/md';
import { VscTerminal } from 'react-icons/vsc';
import { clsx } from 'clsx';

import { AgentSelector } from '@/components/AgentSelector';
import { ModeSelector } from '@/components/PromptField/ModeSelector';
import { AutoApprove } from '@/components/PromptField/AutoApprove';
import { Button } from '@/components/common/Button';
import { Tooltip } from '@/components/ui/Tooltip';
import { useResponsive } from '@/hooks/useResponsive';
import { ExtensionComponentWrapper } from '@/components/extensions/ExtensionComponentWrapper';
import { useProjectSettings } from '@/contexts/ProjectSettingsContext';

type Props = {
  baseDir: string;
  task: TaskData;
  isActive: boolean;
  mode: Mode;
  onModeChanged: (mode: Mode) => void;
  clearMessages: () => void;
  toggleTerminal?: () => void;
  terminalVisible?: boolean;
  showTaskInfo?: () => void;
  onAutoApproveChanged?: (autoApprove: boolean) => void;
  showSettingsPage?: (pageId?: string, options?: Record<string, unknown>) => void;
};

export const TaskControlBar = ({
  baseDir,
  task,
  isActive,
  mode,
  onModeChanged,
  clearMessages,
  toggleTerminal,
  terminalVisible = false,
  showTaskInfo,
  onAutoApproveChanged,
  showSettingsPage,
}: Props) => {
  const { t } = useTranslation();
  const { isMobile } = useResponsive();
  const { projectSettings, saveProjectSettings } = useProjectSettings();

  const handleAutoApproveLockChanged = (locked: boolean) => {
    void saveProjectSettings({
      autoApproveLocked: locked,
    });
  };

  return (
    <div className={clsx('relative w-full flex flex-wrap', isMobile ? 'items-start gap-0.5' : 'items-center')}>
      <div className={clsx('flex gap-1.5', isMobile && !AIDER_MODES.includes(mode) ? 'flex-col items-start' : 'items-center')}>
        <ModeSelector baseDir={baseDir} mode={mode} onModeChange={onModeChanged} />
        <div className="flex gap-2">
          {!AIDER_MODES.includes(mode) && <AgentSelector projectDir={baseDir} task={task} isActive={isActive} showSettingsPage={showSettingsPage} />}
          <AutoApprove
            enabled={!!task?.autoApprove}
            locked={projectSettings?.autoApproveLocked ?? false}
            onChange={onAutoApproveChanged}
            onLockChange={handleAutoApproveLockChanged}
            showLabel={!isMobile}
          />
        </div>
      </div>
      <ExtensionComponentWrapper placement="task-input-toolbar-left" />

      <div className="flex-grow" />
      <ExtensionComponentWrapper placement="task-input-toolbar-right" />
      {isMobile && (
        <div className="absolute top-0 right-0 z-10 flex items-center gap-1">
          {toggleTerminal && (
            <Button variant="text" color="tertiary" onClick={toggleTerminal} className={terminalVisible ? 'bg-bg-secondary-light' : ''} size="xs">
              <VscTerminal className="w-4 h-4" />
              <span className="hidden sm:inline ml-1">Terminal</span>
            </Button>
          )}
          <Button variant="text" color="tertiary" onClick={() => clearMessages()} size="xs">
            <MdPlaylistRemove className="w-4 h-4" />
            <span className="hidden sm:inline ml-1">{t('promptField.clearChat')}</span>
          </Button>
          {showTaskInfo && (
            <Tooltip content={t('promptField.taskInfo')}>
              <Button variant="text" onClick={showTaskInfo} className="py-1.5" size="xs" color="tertiary">
                <FaInfoCircle className="w-3.5 h-3.5 text-text-tertiary" />
              </Button>
            </Tooltip>
          )}
        </div>
      )}
      {!isMobile && toggleTerminal && (
        <Button variant="text" color="tertiary" onClick={toggleTerminal} className={terminalVisible ? 'bg-bg-secondary-light' : ''} size="xs">
          <VscTerminal className="w-4 h-4 mr-1" />
          <span className="hidden sm:inline">Terminal</span>
        </Button>
      )}
      {!isMobile && (
        <Button variant="text" color="tertiary" onClick={() => clearMessages()} size="xs">
          <MdPlaylistRemove className="w-4 h-4" />
          <span className="hidden sm:inline ml-1">{t('promptField.clearChat')}</span>
        </Button>
      )}
      {!isMobile && showTaskInfo && (
        <Tooltip content={t('promptField.taskInfo')}>
          <div>
            <Button variant="text" onClick={showTaskInfo} className="py-1.5" size="xs" color="tertiary">
              <FaInfoCircle className="w-3.5 h-3.5 text-text-tertiary" />
            </Button>
          </div>
        </Tooltip>
      )}
    </div>
  );
};
