import { useState, useEffect } from 'react';
import { FaFolder } from 'react-icons/fa';
import { ConfirmDialog } from './ConfirmDialog';
import { AutocompletionInput } from './AutocompletionInput';

type Props = {
  onClose: () => void;
  onAddProject: (baseDir: string) => void;
};

export const OpenProjectDialog = ({ onClose, onAddProject }: Props) => {
  const [projectPath, setProjectPath] = useState('');
  const [suggestions, setSuggestions] = useState<string[]>([]);
  const [isValidPath, setIsValidPath] = useState(false);
  const [showSuggestions, setShowSuggestions] = useState(true);

  useEffect(() => {
    const updateSuggestions = async () => {
      if (!projectPath) {
        setSuggestions([]);
        setIsValidPath(false);
        return;
      }
      if (showSuggestions) {
        const paths = await window.api.getPathAutocompletion(projectPath);
        setSuggestions(paths);
      } else {
        setSuggestions([]);
      }
      const isValid = await window.api.isProjectPath(projectPath);
      setIsValidPath(isValid);
    };

    updateSuggestions();
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
    }
  };

  return (
    <ConfirmDialog
      title="OPEN PROJECT"
      onCancel={onClose}
      onConfirm={handleAddProject}
      confirmButtonText="Open"
      disabled={!projectPath || !isValidPath}
      width={600}
    >
      <AutocompletionInput
        value={projectPath}
        suggestions={suggestions}
        onChange={(value) => {
          setShowSuggestions(true);
          setProjectPath(value);
        }}
        placeholder="Choose project directory"
        autoFocus
        className="w-full p-3 pr-12 rounded-lg bg-neutral-900/50 border border-neutral-700/50 text-sm text-white placeholder-neutral-500 focus:outline-none focus:border-neutral-500/50 focus:ring-1 focus:ring-neutral-500/50 transition-colors"
        rightElement={
          <button
            onClick={handleSelectProject}
            className="absolute right-3 top-1/2 -translate-y-1/2 p-1.5 rounded-md text-neutral-400 hover:text-white hover:bg-neutral-700/50 transition-colors"
            title="Browse folders"
          >
            <FaFolder className="w-4 h-4" />
          </button>
        }
      />
    </ConfirmDialog>
  );
};
