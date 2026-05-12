import { AIDER_MODES, Mode, TaskData } from '@common/types';
import { useTranslation } from 'react-i18next';
import { FaInfoCircle } from 'react-icons/fa';
import { MdPlaylistRemove, MdUndo } from 'react-icons/md';
import { VscTerminal } from 'react-icons/vsc';
import { clsx } from 'clsx';

import { AgentSelector } from '@/components/AgentSelector';
import { ModeSelector } from '@/components/PromptField/ModeSelector';
import { AutoApprove } from '@/components/PromptField/AutoApprove';
import { Button } from '@/components/common/Button';
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
  showTaskInfoPanel?: boolean;
  onToggleTaskInfoPanel?: () => void;
  onAutoApproveChanged?: (autoApprove: boolean) => void;
  showSettingsPage?: (pageId?: string, options?: Record<string, unknown>) => void;
  canUndoContextChange?: boolean;
  onUndoContextChange?: () => void;
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
  showTaskInfoPanel = false,
  onToggleTaskInfoPanel,
  onAutoApproveChanged,
  showSettingsPage,
  canUndoContextChange,
  onUndoContextChange,
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
      {isMobile ? (
        <div className="absolute top-0 right-0 z-10 flex items-center gap-1">
          {toggleTerminal && (
            <Button variant="text" color="tertiary" onClick={toggleTerminal} className={terminalVisible ? 'bg-bg-secondary-light' : ''} size="xs">
              <VscTerminal className="w-4 h-4" />
              <span className="hidden sm:inline ml-1">Terminal</span>
            </Button>
          )}
          {canUndoContextChange && onUndoContextChange ? (
            <Button variant="text" color="primary" onClick={onUndoContextChange} size="xs" tooltip={t('promptField.undoContextChange')}>
              <MdUndo className="w-4 h-4" />
              <span className="hidden sm:inline ml-1">{t('common.undo')}</span>
            </Button>
          ) : (
            <Button variant="text" color="tertiary" onClick={() => clearMessages()} size="xs">
              <MdPlaylistRemove className="w-4 h-4" />
              <span className="hidden sm:inline ml-1">{t('promptField.clearChat')}</span>
            </Button>
          )}
          {onToggleTaskInfoPanel && (
            <Button
              variant="text"
              onClick={onToggleTaskInfoPanel}
              className={clsx('py-1.5', showTaskInfoPanel && 'bg-bg-secondary-light')}
              size="xs"
              color="tertiary"
              tooltip={t('promptField.taskInfo')}
            >
              <FaInfoCircle className={clsx('w-3.5 h-3.5', showTaskInfoPanel ? 'text-text-secondary' : 'text-text-tertiary')} />
            </Button>
          )}
        </div>
      ) : (
        <>
          {toggleTerminal && (
            <Button variant="text" color="tertiary" onClick={toggleTerminal} className={terminalVisible ? 'bg-bg-secondary-light' : ''} size="xs">
              <VscTerminal className="w-4 h-4 mr-1" />
              <span className="hidden sm:inline">Terminal</span>
            </Button>
          )}
          {canUndoContextChange && onUndoContextChange ? (
            <Button variant="text" color="tertiary" onClick={onUndoContextChange} size="xs" tooltip={t('promptField.undoContextChange')}>
              <MdUndo className="w-4 h-4" />
              <span className="hidden sm:inline ml-1">{t('common.undo')}</span>
            </Button>
          ) : (
            <Button variant="text" color="tertiary" onClick={() => clearMessages()} size="xs">
              <MdPlaylistRemove className="w-4 h-4" />
              <span className="hidden sm:inline ml-1">{t('promptField.clearChat')}</span>
            </Button>
          )}
          {onToggleTaskInfoPanel && (
            <Button
              variant="text"
              onClick={onToggleTaskInfoPanel}
              className={clsx('py-1.5', showTaskInfoPanel && 'bg-bg-secondary-light')}
              size="xs"
              color="tertiary"
              tooltip={t('promptField.taskInfo')}
            >
              <FaInfoCircle className={clsx('w-3.5 h-3.5', showTaskInfoPanel ? 'text-text-secondary' : 'text-text-tertiary')} />
            </Button>
          )}
        </>
      )}
    </div>
  );
};
