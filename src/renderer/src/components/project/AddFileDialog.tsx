import { useState, useEffect, useCallback, useRef } from 'react';
import { useTranslation } from 'react-i18next';

import { FileFinder } from '@/components/project/FileFinder';
import { FileChip } from '@/components/common/FileChip';
import { ConfirmDialog } from '@/components/ConfirmDialog';
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

  const handleDragEnter = useCallback((event: DragEvent) => {
    event.preventDefault();
    // Add visual feedback if desired
    if (dropZoneRef.current) {
      dropZoneRef.current.style.border = '2px dashed #aaa';
    }
  }, []);

  const handleDragOver = useCallback((event: DragEvent) => {
    event.preventDefault();
  }, []);

  const handleDragLeave = useCallback((event: DragEvent) => {
    // Remove visual feedback if desired
    if (dropZoneRef.current) {
      dropZoneRef.current.style.border = 'none';
    }
  }, []);

  const handleDrop = useCallback(
    async (event: DragEvent) => {
      event.preventDefault();
      // Remove visual feedback if desired
      if (dropZoneRef.current) {
        dropZoneRef.current.style.border = 'none';
      }

      if (event.dataTransfer?.files) {
        const files = Array.from(event.dataTransfer.files);
        const droppedFilePaths = files.map((file) => file.path);
        console.log('Dropped files:', droppedFilePaths);

        const validPathsToAdd: string[] = [];
        let
          switchToReadOnly = false;

        for (const p of droppedFilePaths) {
          const trimmedPath = p.trim();
          if (trimmedPath === '') {
            continue;
          }
          const isValid = await window.api.isValidPath(baseDir, trimmedPath); // Checks existence and type
          if (isValid && !selectedPaths.includes(trimmedPath) && !validPathsToAdd.includes(trimmedPath)) {
            validPathsToAdd.push(trimmedPath);
            if (!initialReadOnly && !isReadOnly && !switchToReadOnly) {
              const isWithinBase = await window.api.isPathWithinBase(baseDir, trimmedPath);
              if (!isWithinBase) {
                switchToReadOnly = true;
              }
            }
          }
        }

        if (validPathsToAdd.length > 0) {
          setSelectedPaths((prev) => [...prev, ...validPathsToAdd]);
          if (switchToReadOnly) {
            setIsReadOnly(true);
          }
        }
      }
    },
    [baseDir, selectedPaths, initialReadOnly, isReadOnly, setIsReadOnly],
  );

  useEffect(() => {
    const currentDropZone = dropZoneRef.current;
    if (currentDropZone) {
      currentDropZone.addEventListener('dragenter', handleDragEnter);
      currentDropZone.addEventListener('dragover', handleDragOver);
      currentDropZone.addEventListener('dragleave', handleDragLeave);
      currentDropZone.addEventListener('drop', handleDrop);

      return () => {
        currentDropZone.removeEventListener('dragenter', handleDragEnter);
        currentDropZone.removeEventListener('dragover', handleDragOver);
        currentDropZone.removeEventListener('dragleave', handleDragLeave);
        currentDropZone.removeEventListener('drop', handleDrop);
      };
    }
    return () => {};
  }, [handleDragEnter, handleDragOver, handleDragLeave, handleDrop]);

  const handleOnPaste = async (pastedText: string) => {
    if (pastedText) {
      const pastedPaths = pastedText.split(/\s+/);
      const validPathsToAdd: string[] = [];
      let switchToReadOnly = false;

      for (const p of pastedPaths) {
        const trimmedPath = p.trim();
        if (trimmedPath === '') {
          continue;
        }
        const isValid = await window.api.isValidPath(baseDir, trimmedPath);
        if (isValid && !selectedPaths.includes(trimmedPath) && !validPathsToAdd.includes(trimmedPath)) {
          validPathsToAdd.push(trimmedPath);
          if (!initialReadOnly && !isReadOnly && !switchToReadOnly) {
            const isWithinBase = await window.api.isPathWithinBase(baseDir, trimmedPath);
            if (!isWithinBase) {
              switchToReadOnly = true;
            }
          }
        }
      }
      if (validPathsToAdd.length > 0) {
        setSelectedPaths((prev) => [...prev, ...validPathsToAdd]);
        if (switchToReadOnly) {
          setIsReadOnly(true);
        }
      }
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
