import { ChangeEvent, useCallback, useEffect, useState } from 'react';
import { CgSpinner } from 'react-icons/cg';
import { FaFolder } from 'react-icons/fa';
import { useTranslation } from 'react-i18next';
import { ProjectData } from '@common/types';
import { useHotkeys } from 'react-hotkeys-hook';

import { useConfiguredHotkeys } from '@/hooks/useConfiguredHotkeys';
import { AutocompletionInput } from '@/components/AutocompletionInput';
import { Accordion } from '@/components/common/Accordion';
import { BaseDialog } from '@/components/common/BaseDialog';
import { ConfirmDialog } from '@/components/common/ConfirmDialog';
import { IconButton } from '@/components/common/IconButton';
import { Input } from '@/components/common/Input';
import { Tabs } from '@/components/common/Tabs';
import { useApi } from '@/contexts/ApiContext';

enum OpenProjectMode {
  Open = 'open',
  Clone = 'clone',
}

const isValidRepositoryUrl = (url: string): boolean => /^https?:\/\/\S+\/\S+$/i.test(url.trim());

const CLONE_DESTINATION_STORAGE_KEY = 'aider-desk-clone-destination';

type Props = {
  onClose: () => void;
  onAddProject: (baseDir: string) => void;
  openProjects: ProjectData[];
};

export const OpenProjectDialog = ({ onClose, onAddProject, openProjects }: Props) => {
  const { t } = useTranslation();
  const { DIALOG_HOTKEYS } = useConfiguredHotkeys();
  const [mode, setMode] = useState<OpenProjectMode>(OpenProjectMode.Open);
  const [projectPath, setProjectPath] = useState('');
  const [suggestions, setSuggestions] = useState<string[]>([]);
  const [isValidPath, setIsValidPath] = useState(false);
  const [showSuggestions, setShowSuggestions] = useState(true);
  const [recentProjects, setRecentProjects] = useState<string[]>([]);
  const [repositoryUrl, setRepositoryUrl] = useState('');
  const [cloneDestination, setCloneDestination] = useState(() => localStorage.getItem(CLONE_DESTINATION_STORAGE_KEY) ?? '');
  const [destinationSuggestions, setDestinationSuggestions] = useState<string[]>([]);
  const [showDestinationSuggestions, setShowDestinationSuggestions] = useState(true);
  const [isCloning, setIsCloning] = useState(false);
  const [cloneError, setCloneError] = useState<string | null>(null);
  const api = useApi();
  const isProjectAlreadyOpen = openProjects.some((project) => project.baseDir === projectPath);
  const isRepoUrlValid = isValidRepositoryUrl(repositoryUrl);

  const handleSelectProject = useCallback(async () => {
    try {
      const result = await api.showOpenDialog({
        properties: ['openDirectory'],
      });

      if (!result.canceled && result.filePaths.length > 0) {
        setShowSuggestions(false);
        setProjectPath(result.filePaths[0]);
      }
    } catch (error) {
      // eslint-disable-next-line no-console
      console.error('Error selecting project:', error);
    }
  }, [api]);

  // Browse for folder
  useHotkeys(
    DIALOG_HOTKEYS.BROWSE_FOLDER,
    (e) => {
      e.preventDefault();
      if (mode === OpenProjectMode.Open && api.isOpenDialogSupported()) {
        void handleSelectProject();
      }
    },
    { enableOnFormTags: ['input'], enableOnContentEditable: true },
    [api, handleSelectProject, mode],
  );

  useEffect(() => {
    const loadRecentProjects = async () => {
      const projects = await api.getRecentProjects();
      setRecentProjects(projects.filter((path) => !openProjects.some((project) => project.baseDir === path)));
    };
    void loadRecentProjects();
  }, [api, openProjects]);

  useEffect(() => {
    const updateSuggestions = async () => {
      if (!projectPath) {
        setSuggestions([]);
        setIsValidPath(false);
        return;
      }
      if (showSuggestions) {
        const paths = await api.getFilePathSuggestions(projectPath, true);
        setSuggestions(paths.filter((path) => !openProjects.some((project) => project.baseDir === path)));
      } else {
        setSuggestions([]);
      }
      const isValid = await api.isProjectPath(projectPath);
      setIsValidPath(isValid);
    };

    void updateSuggestions();
  }, [projectPath, showSuggestions, openProjects, api]);

  useEffect(() => {
    const updateDestinationSuggestions = async () => {
      if (!cloneDestination || !showDestinationSuggestions) {
        setDestinationSuggestions([]);
        return;
      }
      setDestinationSuggestions(await api.getFilePathSuggestions(cloneDestination, true));
    };

    void updateDestinationSuggestions();
  }, [cloneDestination, showDestinationSuggestions, api]);

  const handleSelectCloneDestination = useCallback(async () => {
    try {
      const result = await api.showOpenDialog({
        properties: ['openDirectory'],
      });

      if (!result.canceled && result.filePaths.length > 0) {
        setShowDestinationSuggestions(false);
        localStorage.setItem(CLONE_DESTINATION_STORAGE_KEY, result.filePaths[0]);
        setCloneDestination(result.filePaths[0]);
      }
    } catch (error) {
      // eslint-disable-next-line no-console
      console.error('Error selecting clone destination:', error);
    }
  }, [api]);

  const handleAddProject = () => {
    if (projectPath && isValidPath && !isProjectAlreadyOpen) {
      onAddProject(projectPath);
      onClose();
    }
  };

  const handleCloneProject = async () => {
    if (!isRepoUrlValid || isCloning) {
      return;
    }
    setIsCloning(true);
    setCloneError(null);
    try {
      const clonedPath = await api.cloneProject(repositoryUrl.trim(), cloneDestination.trim() || undefined);
      onAddProject(clonedPath);
      onClose();
    } catch (error) {
      setIsCloning(false);
      setCloneError(error instanceof Error ? error.message : String(error));
    }
  };

  const handleCancelClone = () => {
    api.cancelCloneProject().catch((error) => {
      // eslint-disable-next-line no-console
      console.error('Failed to cancel cloning:', error);
    });
    onClose();
  };

  const handleRepositoryUrlChange = (e: ChangeEvent<HTMLInputElement>) => {
    setRepositoryUrl(e.target.value);
  };

  const handleCloneDestinationChange = (value: string, isFromSuggestion: boolean) => {
    setShowDestinationSuggestions(!isFromSuggestion);
    if (value.trim()) {
      localStorage.setItem(CLONE_DESTINATION_STORAGE_KEY, value);
    } else {
      localStorage.removeItem(CLONE_DESTINATION_STORAGE_KEY);
    }
    setCloneDestination(value);
  };

  const handleConfirm = () => {
    if (mode === OpenProjectMode.Clone) {
      void handleCloneProject();
    } else {
      handleAddProject();
    }
  };

  const handleModeChange = (tabId: string) => {
    setMode(tabId as OpenProjectMode);
  };

  const tabs = [
    { id: OpenProjectMode.Open, label: t('dialogs.openLocalProject') },
    { id: OpenProjectMode.Clone, label: t('dialogs.cloneFromGit') },
  ];

  const isConfirmDisabled = mode === OpenProjectMode.Clone ? !isRepoUrlValid || isCloning : !projectPath || !isValidPath || isProjectAlreadyOpen;

  if (isCloning) {
    return (
      <BaseDialog title={t('dialogs.openProjectTitle')} onClose={handleCancelClone} width={600}>
        <div className="flex flex-col items-center justify-center gap-4 py-10">
          <CgSpinner className="w-10 h-10 animate-spin text-text-secondary" />
          <div className="text-sm text-text-primary">{t('dialogs.cloningProject')}</div>
        </div>
      </BaseDialog>
    );
  }

  return (
    <ConfirmDialog
      title={t('dialogs.openProjectTitle')}
      onCancel={onClose}
      onConfirm={handleConfirm}
      confirmButtonText={mode === OpenProjectMode.Clone ? t('common.clone') : t('common.open')}
      disabled={isConfirmDisabled}
      width={600}
      closeOnEscape={true}
    >
      <Tabs tabs={tabs} activeTabId={mode} onTabChange={handleModeChange} className="mb-3" />

      {mode === OpenProjectMode.Open && (
        <>
          <AutocompletionInput
            value={projectPath}
            suggestions={suggestions}
            onChange={(value, isFromSuggestion) => {
              setShowSuggestions(!isFromSuggestion);
              setProjectPath(value);
            }}
            placeholder={t('dialogs.projectPathPlaceholder')}
            autoFocus
            inputClassName="pr-10 p-2 rounded"
            rightElement={
              api.isOpenDialogSupported() && (
                <IconButton
                  onClick={handleSelectProject}
                  className="p-1.5 rounded-md hover:bg-bg-tertiary-strong transition-colors"
                  tooltip={t('dialogs.browseFoldersTooltip')}
                  icon={<FaFolder className="w-4 h-4" />}
                  data-testid="browse-folder-button"
                />
              )
            }
            onSubmit={handleAddProject}
          />

          {isProjectAlreadyOpen && <div className="text-error text-2xs mt-1 px-2">{t('dialogs.projectAlreadyOpenWarning')}</div>}

          {!isValidPath && projectPath.length > 0 && <div className="text-error text-2xs mt-1 px-2">{t('dialogs.cantOpenProject')}</div>}

          {recentProjects.length > 0 && (
            <Accordion className="mt-2" title={<div className="flex items-center gap-2 text-sm">{t('dialogs.recentProjects')}</div>}>
              <div className="flex flex-col gap-1 max-h-48 overflow-y-auto scrollbar-thin scrollbar-thumb-bg-fourth scrollbar-track-bg-secondary-light-strongest">
                {recentProjects.map((path) => (
                  <button
                    key={path}
                    onClick={() => {
                      onAddProject(path);
                      onClose();
                    }}
                    className="text-left p-1.5 rounded hover:bg-bg-tertiary-strong transition-colors truncate text-xs ml-2 flex-shrink-0"
                    title={path}
                  >
                    {path}
                  </button>
                ))}
              </div>
            </Accordion>
          )}
        </>
      )}

      {mode === OpenProjectMode.Clone && (
        <>
          <Input
            label={t('dialogs.repositoryUrlLabel')}
            value={repositoryUrl}
            onChange={handleRepositoryUrlChange}
            placeholder={t('dialogs.repositoryUrlPlaceholder')}
            disabled={isCloning}
            autoFocus
            className="bg-bg-primary-light-strong border border-bg-tertiary-strong focus:border-border-default focus:ring-1 focus:ring-border-default"
            data-testid="repository-url-input"
          />
          <AutocompletionInput
            className="mt-2"
            label={t('dialogs.cloneDestinationLabel')}
            value={cloneDestination}
            suggestions={destinationSuggestions}
            onChange={handleCloneDestinationChange}
            placeholder={t('dialogs.cloneDestinationPlaceholder')}
            inputClassName="p-2 rounded"
            rightElement={
              api.isOpenDialogSupported() && (
                <IconButton
                  onClick={handleSelectCloneDestination}
                  className="p-1.5 rounded-md hover:bg-bg-tertiary-strong transition-colors"
                  tooltip={t('dialogs.browseFoldersTooltip')}
                  icon={<FaFolder className="w-4 h-4" />}
                />
              )
            }
          />

          {cloneError && (
            <div className="text-error text-2xs mt-1 px-2 break-words" data-testid="clone-error">
              {t('dialogs.cloneProjectFailed')}
              {cloneError ? `: ${cloneError}` : ''}
            </div>
          )}
        </>
      )}
    </ConfirmDialog>
  );
};
