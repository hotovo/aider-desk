import { useEffect, useState } from 'react';
import { FaFolder } from 'react-icons/fa';
import { useTranslation } from 'react-i18next';
import { ProjectData } from '@common/types';

import { AutocompletionInput } from '@/components/AutocompletionInput';
import { Accordion } from '@/components/common/Accordion';
import { ConfirmDialog } from '@/components/common/ConfirmDialog';
import { IconButton } from '@/components/common/IconButton';
import { StyledTooltip } from '@/components/common/StyledTooltip';
import { useApi } from '@/context/ApiContext';

type Props = {
  onClose: () => void;
  onAddProject: (baseDir: string) => void;
  openProjects: ProjectData[];
};

export const OpenProjectDialog = ({ onClose, onAddProject, openProjects }: Props) => {
  const { t } = useTranslation();
  const [projectPath, setProjectPath] = useState('');
  const [suggestions, setSuggestions] = useState<string[]>([]);
  const [isValidPath, setIsValidPath] = useState(false);
  const [showSuggestions, setShowSuggestions] = useState(true);
  const [recentProjects, setRecentProjects] = useState<string[]>([]);
  const [isProjectAlreadyOpen, setIsProjectAlreadyOpen] = useState(false);
  const api = useApi();

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

    setIsProjectAlreadyOpen(openProjects.some((project) => project.baseDir === projectPath));

    void updateSuggestions();
  }, [projectPath, showSuggestions, openProjects, api]);

  const handleSelectProject = async () => {
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
  };

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
    >
      <StyledTooltip id="browseTooltipId" />
      <AutocompletionInput
        value={projectPath}
        suggestions={suggestions}
        onChange={(value, isFromSuggestion) => {
          setShowSuggestions(!isFromSuggestion);
          setProjectPath(value);
          setIsProjectAlreadyOpen(false);
          setIsValidPath(true);
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
              tooltipId="browseTooltipId"
              icon={<FaFolder className="w-4 h-4" />}
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
