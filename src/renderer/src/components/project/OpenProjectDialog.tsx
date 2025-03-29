import { useState, useEffect } from 'react';
import { useTranslation } from 'react-i18next';
import { FaFolder } from 'react-icons/fa';

import { AutocompletionInput } from '@/components/AutocompletionInput';
import { Accordion } from '@/components/common/Accordion';
import { ConfirmDialog } from '@/components/ConfirmDialog';

type Props = {
  onClose: () => void;
  onAddProject: (baseDir: string) => void;
};

export const OpenProjectDialog = ({ onClose, onAddProject }: Props) => {
  const [projectPath, setProjectPath] = useState('');
  const [suggestions, setSuggestions] = useState<string[]>([]);
  const [isValidPath, setIsValidPath] = useState(false);
  const [showSuggestions, setShowSuggestions] = useState(true);
  const [recentProjects, setRecentProjects] = useState<string[]>([]);

  useEffect(() => {
    const loadRecentProjects = async () => {
      const projects = await window.api.getRecentProjects();
      setRecentProjects(projects);
    };
    void loadRecentProjects();
  }, []);

  useEffect(() => {
    const updateSuggestions = async () => {
      if (!projectPath) {
        setSuggestions([]);
        setIsValidPath(false);
        return;
      }
      if (showSuggestions) {
        const paths = await window.api.getFilePathSuggestions(projectPath, true);
        setSuggestions(paths);
      } else {
        setSuggestions([]);
      }
      const isValid = await window.api.isProjectPath(projectPath);
      setIsValidPath(isValid);
    };

    void updateSuggestions();
  }, [projectPath, showSuggestions]);

  const handleSelectProject = async () => {
    try {
      const result = await window.api.dialog.showOpenDialog({
        properties: ['openDirectory'],
      });

      if (!result.canceled && result.filePaths.length > 0) {
        setShowSuggestions(false);
        setProjectPath(result.filePaths[0]);
      }
    } catch (error) {
      console.error('Error selecting project:', error);
    }
  };

  const handleAddProject = () => {
    if (projectPath && isValidPath) {
      onAddProject(projectPath);
      onClose();
    }
  };

  const { t } = useTranslation();

  return (
    <ConfirmDialog
      title={t('dialogs.openProjectTitle')}
      onCancel={onClose}
      onConfirm={handleAddProject}
      confirmButtonText={t('dialogs.openButton')}
      disabled={!projectPath || !isValidPath}
      width={600}
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
        className="w-full p-3 pr-12 rounded-lg bg-neutral-900/50 border border-neutral-700/50 text-sm text-white placeholder-neutral-500 focus:outline-none focus:border-neutral-500/50 focus:ring-1 focus:ring-neutral-500/50 transition-colors"
        rightElement={
          <button
            onClick={handleSelectProject}
            className="absolute right-3 top-1/2 -translate-y-1/2 p-1.5 rounded-md text-neutral-400 hover:text-white hover:bg-neutral-700/50 transition-colors"
            title={t('dialogs.browseFoldersTooltip')}
          >
            <FaFolder className="w-4 h-4" />
          </button>
        }
        onSubmit={handleAddProject}
      />

      {recentProjects.length > 0 && (
        <Accordion className="mt-2" title={<div className="flex items-center gap-2 text-sm">Recent projects</div>}>
          <div className="flex flex-col gap-1 max-h-48 overflow-y-auto">
            {recentProjects.map((path) => (
              <button
                key={path}
                onClick={() => {
                  onAddProject(path);
                  onClose();
                }}
                className="text-left p-1.5 rounded hover:bg-neutral-700/50 transition-colors truncate text-xs ml-2"
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
