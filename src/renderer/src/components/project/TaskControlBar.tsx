import { AIDER_MODES, AutonomyMode, DEFAULT_AUTONOMY_MODE, Mode, TaskData } from '@common/types';
import { useTranslation } from 'react-i18next';
import { FaInfoCircle } from 'react-icons/fa';
import { MdPlaylistRemove, MdUndo } from 'react-icons/md';
import { VscTerminal } from 'react-icons/vsc';
import { clsx } from 'clsx';

import { AgentSelector } from '@/components/AgentSelector';
import { ModeSelector } from '@/components/PromptField/ModeSelector';
import { AutonomySelector } from '@/components/PromptField/AutonomySelector';
import { Button } from '@/components/common/Button';
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
  onAutonomyModeChanged?: (mode: AutonomyMode) => void;
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
  onAutonomyModeChanged,
  showSettingsPage,
  canUndoContextChange,
  onUndoContextChange,
}: Props) => {
  const { t } = useTranslation();
  const { projectSettings, saveProjectSettings } = useProjectSettings();

  const handleAutonomyLockChanged = (locked: boolean) => {
    void saveProjectSettings({
      autonomyModeLocked: locked,
    });
  };

  return (
    <div className="flex w-full flex-wrap items-center gap-1.5">
      <div className="flex items-center gap-1.5">
        <ModeSelector baseDir={baseDir} mode={mode} onModeChange={onModeChanged} />
        {!AIDER_MODES.includes(mode) && <AgentSelector projectDir={baseDir} task={task} isActive={isActive} showSettingsPage={showSettingsPage} />}
      </div>

      <div className="flex flex-1 items-center gap-1.5">
        <AutonomySelector
          mode={task.autonomyMode ?? DEFAULT_AUTONOMY_MODE}
          locked={projectSettings?.autonomyModeLocked ?? false}
          onChange={onAutonomyModeChanged}
          onLockChange={handleAutonomyLockChanged}
        />
        <ExtensionComponentWrapper placement="task-input-toolbar-left" />
        <div className="ml-auto flex items-center gap-1">
          <ExtensionComponentWrapper placement="task-input-toolbar-right" />
          {toggleTerminal && (
            <Button variant="text" color="tertiary" onClick={toggleTerminal} className={terminalVisible ? 'bg-bg-secondary-light' : ''} size="xs">
              <VscTerminal className="w-3.5 h-3.5 mr-1 text-text-secondary" />
              <span className="hidden sm:inline text-2xs text-text-secondary">Terminal</span>
            </Button>
          )}
          {canUndoContextChange && onUndoContextChange ? (
            <Button variant="text" color="tertiary" onClick={onUndoContextChange} size="xs" tooltip={t('promptField.undoContextChange')}>
              <MdUndo className="w-4 h-4 text-text-secondary" />
              <span className="hidden sm:inline ml-1 text-text-secondary">{t('common.undo')}</span>
            </Button>
          ) : (
            <Button variant="text" color="tertiary" onClick={() => clearMessages()} size="xs">
              <MdPlaylistRemove className="w-4 h-4 text-text-secondary" />
              <span className="hidden sm:inline ml-1 text-2xs text-text-secondary">{t('promptField.clearChat')}</span>
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
      </div>
    </div>
  );
};
