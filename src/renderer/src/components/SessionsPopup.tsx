import { KeyboardEvent, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { IoAddOutline, IoClose, IoListOutline, IoSaveOutline, IoTrashOutline } from 'react-icons/io5';
import { LuImageDown } from 'react-icons/lu';
import { RiChatDownloadLine } from 'react-icons/ri';
import { TaskData } from '@common/types';

import { ConfirmDialog } from '@/components/common/ConfirmDialog';
import { StyledTooltip } from '@/components/common/StyledTooltip';

type Props = {
  sessions: TaskData[];
  onLoadSessionMessages: (id: string) => void;
  onSaveSession: (name: string, id?: string) => void;
  onDeleteSession: (id: string) => void;
  onExportSessionToMarkdown: () => void;
  onExportSessionToImage: () => void;
};

export const SessionsPopup = ({
  sessions,
  onLoadSessionMessages,
  onSaveSession,
  onDeleteSession,
  onExportSessionToMarkdown,
  onExportSessionToImage,
}: Props) => {
  const { t } = useTranslation();
  const [sessionToDelete, setSessionToDelete] = useState<TaskData | null>(null);
  const [newSessionName, setNewSessionName] = useState('');
  const [showNewSessionInput, setShowNewSessionInput] = useState(false);

  const handleDeleteSession = () => {
    if (sessionToDelete) {
      onDeleteSession(sessionToDelete.id);
      setSessionToDelete(null);
    }
  };

  const handleSaveNewSession = () => {
    if (newSessionName.trim()) {
      onSaveSession(newSessionName.trim());
      setNewSessionName('');
      setShowNewSessionInput(false);
    }
  };

  const handleKeyDown = (e: KeyboardEvent<HTMLInputElement>) => {
    if (e.key === 'Enter') {
      handleSaveNewSession();
    }
  };

  return (
    <div className="absolute right-0 top-full mt-1 bg-bg-primary-light border border-border-default-dark rounded-md shadow-lg z-50 w-[320px]">
      <div>
        <div className="p-2 text-xs font-semibold border-b border-border-default-dark">{t('sessions.title')}</div>
        {sessions.length === 0 ? (
          <div className="text-xs text-text-muted-light p-2">{t('sessions.empty')}</div>
        ) : (
          <div className="max-h-60 overflow-y-auto scrollbar-thin scrollbar-track-bg-primary-light scrollbar-thumb-bg-tertiary hover:scrollbar-thumb-bg-fourth">
            {sessions
              .sort((a, b) => a.name.localeCompare(b.name))
              .map((session) => (
                <div key={session.name} className="flex items-center justify-between text-xs px-2 py-0.5">
                  <span className="truncate text-text-tertiary">{session.name}</span>
                  <div className="flex items-center space-x-1 ml-2">
                    <button
                      className="p-1 hover:bg-bg-fourth rounded-md"
                      onClick={() => onSaveSession(session.name, session.id)}
                      data-tooltip-id="session-tooltip"
                      data-tooltip-content={t('sessions.save')}
                    >
                      <IoSaveOutline className="w-4 h-4 text-text-secondary" />
                    </button>

                    <button
                      className="p-1 hover:bg-bg-fourth rounded-md"
                      onClick={() => onLoadSessionMessages(session.id)}
                      data-tooltip-id="session-tooltip"
                      data-tooltip-content={t('sessions.loadMessages')}
                    >
                      <IoListOutline className="w-4 h-4 text-text-secondary" />
                    </button>

                    <button
                      className="p-1 hover:bg-bg-fourth rounded-md"
                      onClick={() => setSessionToDelete(session)}
                      data-tooltip-id="session-tooltip"
                      data-tooltip-content={t('common.delete')}
                    >
                      <IoTrashOutline className="w-4 h-4 text-text-secondary" />
                    </button>
                  </div>
                </div>
              ))}
          </div>
        )}
        <div className="px-2 py-2 border-t border-border-default-dark flex flex-col space-y-2">
          {showNewSessionInput ? (
            <div className="flex items-center space-x-2">
              <input
                type="text"
                value={newSessionName}
                onChange={(e) => setNewSessionName(e.target.value)}
                onKeyDown={handleKeyDown}
                placeholder={t('sessions.newSessionPlaceholder')}
                className="flex-grow text-xs px-2 py-1 rounded bg-bg-secondary-light border border-border-default text-text-primary focus:outline-none"
                autoFocus
              />
              <button className="p-1 hover:bg-bg-fourth rounded-md" onClick={handleSaveNewSession}>
                <IoSaveOutline className="w-4 h-4 text-text-secondary" />
              </button>
              <button
                className="p-1 hover:bg-bg-fourth rounded-md"
                onClick={() => {
                  setShowNewSessionInput(false);
                  setNewSessionName('');
                }}
              >
                <IoClose className="w-4 h-4 text-text-secondary" />
              </button>
            </div>
          ) : (
            <div className="flex align-center w-full justify-between">
              <button
                className="p-1 px-2 hover:bg-bg-fourth rounded-md flex items-center space-x-1 text-xs text-text-secondary"
                onClick={() => setShowNewSessionInput(true)}
              >
                <IoAddOutline className="w-4 h-4" />
                <span>{t('sessions.saveAsNew')}</span>
              </button>
              <div className="flex items-center space-x-1">
                <button
                  className="p-1 px-2 hover:bg-bg-fourth rounded-md flex items-center space-x-1 text-xs text-text-secondary"
                  onClick={onExportSessionToMarkdown}
                  data-tooltip-id="session-tooltip"
                  data-tooltip-content={t('sessions.exportAsMarkdown')}
                >
                  <RiChatDownloadLine className="w-4 h-4" />
                </button>
                <button
                  className="p-1 px-2 hover:bg-bg-fourth rounded-md flex items-center space-x-1 text-xs text-text-secondary"
                  onClick={onExportSessionToImage}
                  data-tooltip-id="session-tooltip"
                  data-tooltip-content={t('sessions.exportAsImage')}
                >
                  <LuImageDown className="w-4 h-4" />
                </button>
              </div>
            </div>
          )}
        </div>
      </div>

      {sessionToDelete && (
        <ConfirmDialog
          title={t('sessions.deleteTitle')}
          onConfirm={handleDeleteSession}
          onCancel={() => setSessionToDelete(null)}
          confirmButtonText={t('common.delete')}
        >
          <p>{t('sessions.deleteConfirm', { name: sessionToDelete.name })}</p>
          <p className="text-sm text-text-muted-light mt-1">{t('sessions.deleteWarning')}</p>
        </ConfirmDialog>
      )}
      <StyledTooltip id="session-tooltip" />
    </div>
  );
};
