import { matchSorter } from 'match-sorter';
import { useEffect, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { FaFile, FaFolder } from 'react-icons/fa';
import { PiKeyReturn } from 'react-icons/pi';

import { AutocompletionInput } from '@/components/AutocompletionInput';
import { IconButton } from '@/components/common/IconButton';
import { StyledTooltip } from '@/components/common/StyledTooltip';

type Props = {
  baseDir?: string;
  isReadOnly: boolean;
  selectedPaths: string[];
  onPathAdded: (path: string) => void;
  onSubmit?: () => void;
  onPaste?: (pastedText: string) => Promise<void>;
  autoFocus?: boolean;
  className?: string;
  allowFiles?: boolean;
  allowDirectories?: boolean;
};

export const FileFinder = ({
  baseDir,
  isReadOnly,
  selectedPaths,
  onPathAdded,
  onSubmit,
  onPaste,
  autoFocus,
  className,
  allowFiles = true,
  allowDirectories = true,
}: Props) => {
  const { t } = useTranslation();
  const [inputValue, setInputValue] = useState('');
  const [isValidInputValue, setIsValidInputValue] = useState(false);
  const [suggestions, setSuggestions] = useState<string[]>([]);
  const [showSuggestions, setShowSuggestions] = useState(true);

  useEffect(() => {
    if (!baseDir) {
      setIsValidInputValue(true);
      return;
    }

    const checkValidPath = async () => {
      if (!inputValue) {
        setIsValidInputValue(false);
        return;
      }
      setIsValidInputValue(await window.api.isValidPath(baseDir, inputValue));
    };
    void checkValidPath();
  }, [inputValue, baseDir]);

  useEffect(() => {
    const updateSuggestions = async () => {
      if (!inputValue) {
        setSuggestions([]);
        return;
      }
      const suggestionFiles = isReadOnly || !baseDir ? await window.api.getFilePathSuggestions(inputValue) : await window.api.getAddableFiles(baseDir);

      const getParentDirectories = () => {
        const parentDirs = new Set<string>();
        for (const filePath of suggestionFiles) {
          const pathSegments = filePath.split(/[\\/]/);

          if (pathSegments.length <= 1) {
            continue; // No parent directories if it's a root file or empty/invalid path
          }

          for (let i = 0; i < pathSegments.length - 1; i++) {
            // Construct the parent path by joining segments from start up to current segment 'i'
            const parentPath = pathSegments.slice(0, i + 1).join('/');
            // Add to set if it's not an empty string (e.g. from a path like "/file.txt" where first segment is empty)
            if (parentPath) {
              parentDirs.add(parentPath);
            }
          }
        }
        return Array.from(parentDirs);
      };

      if (showSuggestions) {
        let sourcesForMatchSorter: string[] = [];
        if (allowFiles) {
          sourcesForMatchSorter.push(...suggestionFiles);
        }
        if (allowDirectories && !isReadOnly) {
          sourcesForMatchSorter.push(...getParentDirectories());
        }
        // Deduplicate in case a path could be sourced from both lists or if suggestionFiles had duplicates
        sourcesForMatchSorter = Array.from(new Set(sourcesForMatchSorter));

        const filteredSuggestions = matchSorter(
          sourcesForMatchSorter.filter((file) => !selectedPaths.includes(file)),
          inputValue,
          {
            keys: [
              (item) => item,
              (item) => item.split('/').pop()?.toLowerCase() ?? '',
              (item) =>
                item
                  .split(/[\\/]/)
                  .map((segment) => segment.replace(/_/g, ' '))
                  .join(' '),
            ],
          },
        );
        setSuggestions(filteredSuggestions);
      } else {
        setSuggestions([]);
      }
    };

    void updateSuggestions();
  }, [inputValue, showSuggestions, baseDir, isReadOnly, selectedPaths, allowFiles, allowDirectories]);

  const handleInputSubmit = () => {
    if (inputValue && isValidInputValue && !selectedPaths.includes(inputValue)) {
      onPathAdded(inputValue);
      setInputValue('');
      setShowSuggestions(false);
    } else if (!inputValue) {
      onSubmit?.();
    }
  };

  const handleAutocompleteInputChange = (value: string, isFromSuggestion?: boolean) => {
    setShowSuggestions(!isFromSuggestion);
    if (isFromSuggestion && !isReadOnly) {
      onPathAdded(value);
      setInputValue(''); // Clear input after adding from suggestion
      setShowSuggestions(false); // Hide suggestions after selection
    } else {
      setInputValue(value);
    }
  };

  const getPlaceholderKey = (isForSelectedPaths: boolean) => {
    let key = 'fileFinder.';
    if (isForSelectedPaths) {
      key += 'placeholderFinish.';
    } else {
      key += 'placeholder.';
    }

    if (allowFiles && allowDirectories) {
      key += 'filesAndDirectories';
    } else if (allowFiles) {
      key += 'filesOnly';
    } else if (allowDirectories) {
      key += 'directoriesOnly';
    } else {
      // Fallback, though ideally one of them should always be true
      key += 'filesAndDirectories';
    }
    return key;
  };

  const placeholderText = selectedPaths.length ? t(getPlaceholderKey(true)) : t(getPlaceholderKey(false));

  const handleBrowse = async (browseType: 'file' | 'directory') => {
    try {
      const result = await window.api.dialog.showOpenDialog({
        properties: [browseType === 'file' ? 'openFile' : 'openDirectory', 'multiSelections'],
        defaultPath: isReadOnly ? undefined : baseDir,
      });

      if (!result.canceled && result.filePaths.length > 0) {
        const newPaths = result.filePaths
          .filter((p) => !selectedPaths.includes(p))
          .map((filePath) => (isReadOnly || !baseDir || !filePath.startsWith(baseDir) ? filePath : filePath.slice(baseDir.length + 1)));
        newPaths.forEach(onPathAdded);
        setInputValue('');
        setShowSuggestions(false);
      }
    } catch (error) {
      // eslint-disable-next-line no-console
      console.error('Error selecting file(s)/directory(s):', error);
    }
  };

  const addPathButton =
    isValidInputValue && inputValue && !selectedPaths.includes(inputValue) ? (
      <IconButton
        onClick={handleInputSubmit}
        icon={<PiKeyReturn className="w-4 h-4" />}
        tooltipId="filePathAutocompletionAddButtonTooltip"
        tooltip={t('fileFinder.addPathTooltip')}
        className="p-2 rounded-md hover:bg-bg-tertiary50 transition-colors"
      />
    ) : null;

  const browseFileButton = allowFiles ? (
    <IconButton
      onClick={() => handleBrowse('file')}
      icon={<FaFile className="w-4 h-4" />}
      tooltipId="browseTooltipId"
      tooltip={t('fileFinder.browseFile')}
      className="p-2 rounded-md hover:bg-bg-tertiary50 transition-colors"
    />
  ) : null;

  const browseDirectoryButton = allowDirectories ? (
    <IconButton
      onClick={() => handleBrowse('directory')}
      icon={<FaFolder className="w-4 h-4" />}
      tooltipId="browseTooltipId"
      tooltip={t('fileFinder.browseDirectory')}
      className="p-2 rounded-md hover:bg-bg-tertiary50 transition-colors"
    />
  ) : null;

  const internalRightElement =
    addPathButton || browseFileButton || browseDirectoryButton ? (
      <div className="flex items-center">
        {addPathButton}
        {browseFileButton}
        {browseDirectoryButton}
      </div>
    ) : undefined;

  return (
    <>
      <StyledTooltip id="filePathAutocompletionAddButtonTooltip" />
      <StyledTooltip id="browseTooltipId" />
      <AutocompletionInput
        value={inputValue}
        suggestions={suggestions}
        onChange={handleAutocompleteInputChange}
        placeholder={placeholderText}
        autoFocus={autoFocus}
        className={className}
        onSubmit={handleInputSubmit}
        onPaste={onPaste}
        rightElement={internalRightElement}
      />
    </>
  );
};
