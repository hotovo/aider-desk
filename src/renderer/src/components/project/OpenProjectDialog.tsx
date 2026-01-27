import { useCallback, useEffect, useState } from 'react';
import { FaFolder } from 'react-icons/fa';
import { useTranslation } from 'react-i18next';
import { ProjectData } from '@common/types';
import { useHotkeys } from 'react-hotkeys-hook';

import { useConfiguredHotkeys } from '@/hooks/useConfiguredHotkeys';
import { AutocompletionInput } from '@/components/AutocompletionInput';
import { Accordion } from '@/components/common/Accordion';
import { ConfirmDialog } from '@/components/common/ConfirmDialog';
import { IconButton } from '@/components/common/IconButton';
import { useApi } from '@/contexts/ApiContext';

type Props = {
  onClose: () => void;
  onAddProject: (baseDir: string) => void;
  openProjects: ProjectData[];
};

export const OpenProjectDialog = ({ onClose, onAddProject, openProjects }: Props) => {
  const { t } = useTranslation();
  const { DIALOG_HOTKEYS } = useConfiguredHotkeys();
  const [projectPath, setProjectPath] = useState('');
  const [suggestions, setSuggestions] = useState<string[]>([]);
  const [isValidPath, setIsValidPath] = useState(false);
  const [showSuggestions, setShowSuggestions] = useState(true);
  const [recentProjects, setRecentProjects] = useState<string[]>([]);
  const api = useApi();
  const isProjectAlreadyOpen = openProjects.some((project) => project.baseDir === projectPath);

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
      if (api.isOpenDialogSupported()) {
        void handleSelectProject();
      }
    },
    { enableOnFormTags: ['input'], enableOnContentEditable: true },
    [api, handleSelectProject],
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

  const handleAddProject = () => {
    if (projectPath && isValidPath && !isProjectAlreadyOpen) {
      onAddProject(projectPath);
      onClose();
    }
  };

  return (
    <ConfirmDialog
      title={t('dialogs.openProjectTitle')}
      onCancel={onClose}
      onConfirm={handleAddProject}
      confirmButtonText={t('common.open')}
      disabled={!projectPath || !isValidPath || isProjectAlreadyOpen}
      width={600}
      closeOnEscape={true}
    >
      <AutocompletionInput
        value={projectPath}
        suggestions={suggestions}
        onChange={(value, isFromSuggestion) => {
          setShowSuggestions(!isFromSuggestion);
          setProjectPath(value);
        }}
        placeholder={t('dialogs.projectPathPlaceholder')}
        autoFocus
        inputClassName="pr-10"
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
    </ConfirmDialog>
  );
};
