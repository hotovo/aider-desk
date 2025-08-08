import { useState, useRef, useEffect, useCallback, useLayoutEffect } from 'react';
import { useTranslation } from 'react-i18next';
import Mark from 'mark.js';
import { IoIosArrowUp, IoIosArrowDown, IoMdClose } from 'react-icons/io';
import clsx from 'clsx';

import { Input } from '@/components/common/Input';
import { IconButton } from '@/components/common/IconButton';
import { StyledTooltip } from '@/components/common/StyledTooltip';

export const useSearchText = (inElement: HTMLElement | null, className?: string) => {
  const [showSearchInput, setShowSearchInput] = useState(false);
  const [searchTerm, setSearchTerm] = useState('');
  const [currentElementIndex, setCurrentElementIndex] = useState(-1);
  const foundElementsRef = useRef<Set<HTMLElement>>(new Set());
  const markInstance = useRef<Mark | null>(null);

  const { t } = useTranslation();

  const navigateToElement = useCallback(
    (index: number) => {
      const foundElementsArray = Array.from(foundElementsRef.current);
      if (foundElementsArray.length === 0) {
        return;
      }

      const newIndex = (index + foundElementsArray.length) % foundElementsArray.length;
      const targetElement = foundElementsArray[newIndex];

      if (targetElement) {
        // Remove highlight from previous element
        if (currentElementIndex !== -1 && foundElementsArray[currentElementIndex]) {
          foundElementsArray[currentElementIndex].classList.remove('bg-amber-300');
          foundElementsArray[currentElementIndex].classList.add('bg-amber-500');
        }

        targetElement.scrollIntoView({ behavior: 'smooth', block: 'center' });
        targetElement.classList.add('bg-amber-300');
        targetElement.classList.remove('bg-amber-500');
        setCurrentElementIndex(newIndex);
      }
    },
    [currentElementIndex],
  );

  const navigateToNextFound = useCallback(() => {
    navigateToElement(currentElementIndex + 1);
  }, [currentElementIndex, navigateToElement]);

  const navigateToPreviousFound = useCallback(() => {
    navigateToElement(currentElementIndex - 1);
  }, [currentElementIndex, navigateToElement]);

  const resetSearch = useCallback(() => {
    setShowSearchInput(false);
    setSearchTerm('');
    if (markInstance.current) {
      markInstance.current.unmark();
      foundElementsRef.current.clear();
      setCurrentElementIndex(-1);
    }
  }, []);

  useEffect(() => {
    const handleKeyDown = (event: KeyboardEvent) => {
      if ((event.metaKey || event.ctrlKey) && event.key === 'f') {
        event.preventDefault();
        setShowSearchInput((prev) => !prev);
        if (!showSearchInput) {
          // Clear previous search when opening
          setSearchTerm('');
          if (markInstance.current) {
            markInstance.current.unmark();
            foundElementsRef.current.clear();
            setCurrentElementIndex(-1);
          }
        }
      } else if (event.key === 'F3' && event.shiftKey) {
        event.preventDefault();
        if (showSearchInput && foundElementsRef.current.size > 0) {
          navigateToPreviousFound();
        }
      } else if (event.key === 'F3') {
        event.preventDefault();
        if (showSearchInput && foundElementsRef.current.size > 0) {
          navigateToNextFound();
        }
      } else if (event.key === 'Escape' && showSearchInput) {
        event.preventDefault();
        resetSearch();
      }
    };

    window.addEventListener('keydown', handleKeyDown);

    return () => {
      window.removeEventListener('keydown', handleKeyDown);
    };
  }, [showSearchInput, foundElementsRef.current.size, navigateToNextFound, resetSearch, navigateToPreviousFound]);

  useLayoutEffect(() => {
    if (inElement) {
      markInstance.current = new Mark(inElement);
    }
  }, [inElement]);

  useEffect(() => {
    if (markInstance.current) {
      foundElementsRef.current.clear();
      markInstance.current.unmark(); // Remove previous highlights
      if (searchTerm) {
        markInstance.current.mark(searchTerm, {
          element: 'span',
          className: 'bg-amber-500 text-black',
          each: (element: HTMLElement) => {
            foundElementsRef.current.add(element as HTMLElement);
          },
          done: () => {
            setCurrentElementIndex(-1); // Reset index
            if (foundElementsRef.current.size > 0) {
              navigateToElement(0); // Navigate to the first result
            }
          },
        });
      } else {
        foundElementsRef.current.clear();
        setCurrentElementIndex(-1);
      }
    }
    // eslint-disable-next-line
  }, [searchTerm]);

  const renderSearchInput = () => {
    if (!showSearchInput) {
      return null;
    }

    return (
      <div className={clsx('z-[1] flex items-center bg-bg-primaryLight p-2 rounded-md shadow-lg', className)}>
        <Input
          placeholder={t('search.placeholder')}
          value={searchTerm}
          onChange={(e) => setSearchTerm(e.target.value)}
          autoFocus={true}
          className="text-xs w-[250px]"
        />
        <div className="flex items-center gap-1 ml-2">
          <StyledTooltip id="search-tooltip" />
          <span className="text-xs text-text-mutedLight">
            {foundElementsRef.current.size > 0 ? `${currentElementIndex + 1}/${foundElementsRef.current.size}` : '0/0'}
          </span>
          <IconButton
            className="p-1"
            onClick={navigateToPreviousFound}
            disabled={foundElementsRef.current.size <= 1}
            icon={<IoIosArrowUp />}
            tooltip={t('search.previousResult')}
          />
          <IconButton
            className="p-1"
            onClick={navigateToNextFound}
            disabled={foundElementsRef.current.size <= 1}
            icon={<IoIosArrowDown />}
            tooltip={t('search.nextResult')}
          />
          <IconButton className="p-1" onClick={resetSearch} icon={<IoMdClose />} />
        </div>
      </div>
    );
  };

  return {
    renderSearchInput,
    showSearchInput,
    searchTerm,
    currentElementIndex,
  };
};
