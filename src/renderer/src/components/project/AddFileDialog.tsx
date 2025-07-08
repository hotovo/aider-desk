import { useCallback, useEffect, useRef, useState } from 'react';
import { useTranslation } from 'react-i18next';

import { FileFinder } from '@/components/project/FileFinder';
import { FileChip } from '@/components/common/FileChip';
import { ConfirmDialog } from '@/components/common/ConfirmDialog';
import { Checkbox } from '@/components/common/Checkbox';

type Props = {
  baseDir: string;
  onClose: () => void;
  onAddFiles: (filePaths: string[], readOnly?: boolean) => void;
  initialReadOnly?: boolean;
};

export const AddFileDialog = ({ onClose, onAddFiles, baseDir, initialReadOnly = false }: Props) => {
  const { t } = useTranslation();
  const [selectedPaths, setSelectedPaths] = useState<string[]>([]);
  const [isReadOnly, setIsReadOnly] = useState(initialReadOnly);
  const dropZoneRef = useRef<HTMLDivElement>(null);

  const handleAddExternalFiles = useCallback(
    async (paths: string[]) => {
      const validPathsToAdd: string[] = [];
      let switchToReadOnly = false;

      for (let filePath of paths) {
        const isValid = await window.api.isValidPath(baseDir, filePath);

        if (filePath.startsWith(baseDir + '/') || filePath === baseDir) {
          filePath = filePath.slice(baseDir.length + 1);
        } else {
          switchToReadOnly = true;
        }

        if (isValid && !selectedPaths.includes(filePath) && !validPathsToAdd.includes(filePath)) {
          validPathsToAdd.push(filePath);
        }
      }

      if (validPathsToAdd.length > 0) {
        setSelectedPaths((prev) => [...prev, ...validPathsToAdd]);
        if (switchToReadOnly) {
          setIsReadOnly(true);
        }
      }
    },
    [baseDir, selectedPaths],
  );

  useEffect(() => {
    const currentDropZone = dropZoneRef.current;

    const handleDragEnter = (event: DragEvent) => {
      event.preventDefault();
    };

    const handleDragOver = (event: DragEvent) => {
      event.preventDefault();
    };

    const handleDrop = async (event: DragEvent) => {
      event.preventDefault();

      if (event.dataTransfer?.files) {
        const files = Array.from(event.dataTransfer.files);
        const droppedFilePaths = files.map((file) => window.api.getPathForFile(file));

        await handleAddExternalFiles(droppedFilePaths);
      }
    };

    if (currentDropZone) {
      currentDropZone.addEventListener('dragenter', handleDragEnter);
      currentDropZone.addEventListener('dragover', handleDragOver);
      currentDropZone.addEventListener('drop', handleDrop);

      return () => {
        currentDropZone.removeEventListener('dragenter', handleDragEnter);
        currentDropZone.removeEventListener('dragover', handleDragOver);
        currentDropZone.removeEventListener('drop', handleDrop);
      };
    }
    return () => {};
  }, [baseDir, handleAddExternalFiles, selectedPaths, setIsReadOnly]);

  const handleOnPaste = async (pastedText: string) => {
    if (pastedText) {
      const paths = pastedText.split(/\s+/).map((path) => path.trim());
      await handleAddExternalFiles(paths);
    }
  };

  const handleRemovePath = (pathToRemove: string) => {
    setSelectedPaths(selectedPaths.filter((path) => path !== pathToRemove));
  };

  const handleAddFiles = () => {
    if (selectedPaths.length > 0) {
      onAddFiles(selectedPaths, isReadOnly);
      // onClose will be called by ConfirmDialog's onConfirm
    }
  };

  return (
    <ConfirmDialog
      title={t('addFileDialog.title')}
      onCancel={onClose}
      onConfirm={handleAddFiles}
      confirmButtonText={t('common.add')}
      disabled={selectedPaths.length === 0}
      width={600}
      closeOnEscape
    >
      <div ref={dropZoneRef} className="p-4 border border-transparent rounded-md" data-testid="add-file-dialog-dropzone">
        <FileFinder
          baseDir={baseDir}
          isReadOnly={isReadOnly}
          selectedPaths={selectedPaths}
          onPathAdded={(path) => {
            setSelectedPaths((prev) => [...prev, path]);
          }}
          onSubmit={handleAddFiles}
          onPaste={handleOnPaste}
          autoFocus
          className="w-full" // Changed from flex-1 as it's the only main element now
        />
        {selectedPaths.length > 0 && (
          <div className="mt-1 flex flex-wrap gap-1 max-h-40 overflow-y-auto p-0.5 scrollbar-thin scrollbar-track-neutral-800 scrollbar-thumb-neutral-700 hover:scrollbar-thumb-neutral-600 w-full">
            {selectedPaths.map((path) => (
              <FileChip key={path} path={path} onRemove={handleRemovePath} />
            ))}
          </div>
        )}
        <div className="mt-3 ml-2">
          <Checkbox label={t('addFileDialog.readOnly')} checked={isReadOnly} onChange={setIsReadOnly} />
        </div>
      </div>
    </ConfirmDialog>
  );
};
