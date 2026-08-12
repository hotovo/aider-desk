import { ChangeEvent, KeyboardEvent, MouseEvent, useCallback, useEffect, useLayoutEffect, useMemo, useRef, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { clsx } from 'clsx';

import { TaskStateChip } from '@/components/common/TaskStateChip';
import { PaletteItem, PaletteItemType, useCommandPaletteStore } from '@/stores/commandPaletteStore';

const PAGE_SIZE = 20;

enum PaletteTab {
  All = 'all',
  Files = 'file',
  Actions = 'action',
  Tasks = 'task',
  Projects = 'project',
}

const TABS = [PaletteTab.All, PaletteTab.Files, PaletteTab.Actions, PaletteTab.Tasks, PaletteTab.Projects];

const fuzzyMatch = (query: string, text: string): { match: boolean; score: number } => {
  const normalizedQuery = query.toLowerCase();
  const normalizedText = text.toLowerCase();
  const exactIndex = normalizedText.indexOf(normalizedQuery);

  if (exactIndex !== -1) {
    return { match: true, score: 1000 - exactIndex };
  }

  let queryIndex = 0;
  let score = 0;
  let previousMatchIndex = -1;

  for (let index = 0; index < normalizedText.length && queryIndex < normalizedQuery.length; index++) {
    if (normalizedText[index] === normalizedQuery[queryIndex]) {
      score += index - previousMatchIndex === 1 ? 2 : 1;
      previousMatchIndex = index;
      queryIndex++;
    }
  }

  return queryIndex === normalizedQuery.length ? { match: true, score } : { match: false, score: 0 };
};

const getTabForItem = (item: PaletteItem): PaletteTab => {
  switch (item.type) {
    case PaletteItemType.Action:
      return PaletteTab.Actions;
    case PaletteItemType.File:
      return PaletteTab.Files;
    case PaletteItemType.Task:
      return PaletteTab.Tasks;
    case PaletteItemType.Project:
      return PaletteTab.Projects;
  }
};

export const CommandPaletteContent = () => {
  const { t } = useTranslation();
  const closePalette = useCommandPaletteStore((state) => state.closePalette);
  const items = useCommandPaletteStore((state) => state.items);
  const recentlyUsed = useCommandPaletteStore((state) => state.recentlyUsed);
  const addRecentlyUsed = useCommandPaletteStore((state) => state.addRecentlyUsed);
  const [activeTab, setActiveTab] = useState(PaletteTab.All);
  const [search, setSearch] = useState('');
  const [selectedIndex, setSelectedIndex] = useState(0);
  const [visibleCount, setVisibleCount] = useState(PAGE_SIZE);
  const [canScrollForMore, setCanScrollForMore] = useState(false);
  const inputRef = useRef<HTMLInputElement>(null);
  const listRef = useRef<HTMLDivElement>(null);
  const allItems = useMemo(() => Array.from(items.values()), [items]);

  const visibleItems = useMemo(() => {
    const sourceItems = activeTab === PaletteTab.All ? allItems : allItems.filter((item) => getTabForItem(item) === activeTab);
    const activeItems = sourceItems.filter((item) => !item.archived);

    if (!search.trim()) {
      if (activeTab !== PaletteTab.All) {
        return activeItems;
      }

      const recentItems = recentlyUsed
        .map((id) => activeItems.find((item) => item.id === id))
        .filter((item): item is PaletteItem => item !== undefined && item.type === PaletteItemType.Action);
      const recentIds = new Set(recentItems.map((item) => item.id));
      return [...recentItems, ...activeItems.filter((item) => !recentIds.has(item.id))];
    }

    const getMatches = (itemsToSearch: PaletteItem[]) =>
      itemsToSearch
        .map((item) => {
          const labelMatch = fuzzyMatch(search, item.label);
          const descriptionMatch = item.description ? fuzzyMatch(search, item.description) : { match: false, score: 0 };
          return { item, match: labelMatch.match || descriptionMatch.match, score: Math.max(labelMatch.score, descriptionMatch.score) };
        })
        .filter((result) => result.match)
        .sort((first, second) => second.score - first.score)
        .map((result) => result.item);

    const activeMatches = getMatches(activeItems);
    return activeMatches.length ? activeMatches : getMatches(sourceItems);
  }, [activeTab, allItems, recentlyUsed, search]);

  const selectedPageCount = Math.ceil((selectedIndex + 1) / PAGE_SIZE) * PAGE_SIZE;
  const loadedCount = Math.max(visibleCount, Math.min(selectedPageCount, visibleItems.length));
  const loadedItems = useMemo(() => visibleItems.slice(0, loadedCount), [loadedCount, visibleItems]);

  useLayoutEffect(() => {
    const handleEscape = (event: globalThis.KeyboardEvent) => {
      if (event.key !== 'Escape') {
        return;
      }

      event.preventDefault();
      event.stopPropagation();
      event.stopImmediatePropagation();
      closePalette();
    };

    window.addEventListener('keydown', handleEscape, true);
    return () => window.removeEventListener('keydown', handleEscape, true);
  }, [closePalette]);

  useLayoutEffect(() => {
    const selected = listRef.current?.querySelector('[data-selected="true"]');
    selected?.scrollIntoView({ block: 'nearest' });
  }, [loadedItems, selectedIndex]);

  useEffect(() => {
    const animationFrame = requestAnimationFrame(() => {
      const list = listRef.current;
      if (!list) {
        return;
      }

      const canLoadMore = loadedItems.length < visibleItems.length;
      const canScroll = list.scrollHeight > list.clientHeight;
      setCanScrollForMore(canLoadMore && canScroll);

      if (canLoadMore && !canScroll) {
        setVisibleCount((current) => Math.min(current + PAGE_SIZE, visibleItems.length));
      }
    });

    return () => cancelAnimationFrame(animationFrame);
  }, [loadedItems.length, visibleItems.length]);

  const handleListScroll = () => {
    const list = listRef.current;
    if (!list || list.scrollTop + list.clientHeight < list.scrollHeight - 8) {
      return;
    }

    setVisibleCount((current) => Math.min(current + PAGE_SIZE, visibleItems.length));
  };

  const executeItem = useCallback(
    (item: PaletteItem) => {
      if (item.type === PaletteItemType.Action) {
        addRecentlyUsed(item.id);
      }
      closePalette();
      item.action();
    },
    [addRecentlyUsed, closePalette],
  );

  const selectTab = useCallback((tab: PaletteTab) => {
    setActiveTab(tab);
    setSelectedIndex(0);
    setVisibleCount(PAGE_SIZE);
    inputRef.current?.focus();
  }, []);

  const handleSearchChange = (event: ChangeEvent<HTMLInputElement>) => {
    setSearch(event.target.value);
    setSelectedIndex(0);
    setVisibleCount(PAGE_SIZE);
  };

  const moveSelection = useCallback(
    (direction: number) => {
      if (!visibleItems.length) {
        return;
      }

      const nextIndex = (selectedIndex + direction + visibleItems.length) % visibleItems.length;
      setSelectedIndex(nextIndex);
    },
    [selectedIndex, visibleItems.length],
  );

  const handleKeyDown = useCallback(
    (event: KeyboardEvent<HTMLInputElement>) => {
      if (event.key === 'Tab') {
        event.preventDefault();
        const currentIndex = TABS.indexOf(activeTab);
        const direction = event.shiftKey ? -1 : 1;
        const nextIndex = (currentIndex + direction + TABS.length) % TABS.length;
        selectTab(TABS[nextIndex]);
      } else if (event.key === 'ArrowDown') {
        event.preventDefault();
        moveSelection(1);
      } else if (event.key === 'ArrowUp') {
        event.preventDefault();
        moveSelection(-1);
      } else if (event.key === 'Enter') {
        event.preventDefault();
        const item = visibleItems[selectedIndex];
        if (item) {
          executeItem(item);
        }
      }
    },
    [activeTab, executeItem, moveSelection, selectTab, selectedIndex, visibleItems],
  );

  const handleBackdropClick = () => {
    closePalette();
  };

  const handleContentClick = (event: MouseEvent<HTMLDivElement>) => {
    event.stopPropagation();
  };

  return (
    <div className="fixed inset-0 bg-black/50 backdrop-blur-sm flex items-start justify-center z-[100] pt-[12vh]" onClick={handleBackdropClick}>
      <div
        className="bg-bg-secondary-light-strongest shadow-2xl rounded-md border border-bg-tertiary-strong w-[640px] max-h-[64vh] flex flex-col overflow-hidden"
        onClick={handleContentClick}
      >
        <div className="px-2 pt-2 flex gap-1 border-b border-bg-tertiary-strong">
          {TABS.map((tab) => (
            <button
              key={tab}
              className={clsx(
                'px-2 py-1 text-xs border border-transparent rounded-t-sm',
                activeTab === tab ? 'bg-bg-tertiary text-text-primary border-border-default' : 'text-text-muted hover:text-text-primary hover:bg-bg-tertiary',
              )}
              onClick={() => selectTab(tab)}
            >
              {t(`commandPalette.tabs.${tab}`)}
            </button>
          ))}
        </div>
        <div className="px-2 py-1.5 border-b border-bg-tertiary-strong">
          <input
            ref={inputRef}
            type="text"
            value={search}
            onChange={handleSearchChange}
            autoFocus
            onKeyDown={handleKeyDown}
            placeholder={t('commandPalette.placeholder')}
            className="w-full bg-transparent text-xs text-text-primary placeholder-text-muted focus:outline-none"
            spellCheck={false}
          />
        </div>
        <div
          ref={listRef}
          className="overflow-y-auto scrollbar-thin scrollbar-track-bg-secondary-light scrollbar-thumb-bg-fourth scrollbar-thumb-rounded-full flex-1 min-h-0 py-1"
          onScroll={handleListScroll}
        >
          {loadedItems.map((item, index) => (
            <button
              key={item.id}
              data-selected={index === selectedIndex}
              className={clsx(
                'w-full text-left px-2 py-1 text-xs flex items-center justify-between gap-3',
                index === selectedIndex ? 'bg-bg-tertiary text-text-primary' : 'text-text-primary hover:bg-bg-secondary-light',
              )}
              onClick={() => executeItem(item)}
            >
              <span className="min-w-0 flex items-baseline gap-2">
                <span className="truncate">{item.label}</span>
                {item.description && <span className="truncate text-text-muted text-3xs">{item.description}</span>}
              </span>
              <span className="flex items-center gap-2 shrink-0">
                {item.state && <TaskStateChip state={item.state} />}
                {activeTab === PaletteTab.All && search.trim() && (
                  <span className="text-3xs uppercase text-text-muted">{t(`commandPalette.tabs.${item.type}`)}</span>
                )}
                {item.shortcut && (
                  <span className="text-3xs text-text-muted bg-bg-secondary-light px-1 py-0.5 rounded border border-border-default">{item.shortcut}</span>
                )}
              </span>
            </button>
          ))}
          {visibleItems.length === 0 && search.trim() && <div className="px-2 py-5 text-center text-xs text-text-muted">{t('commandPalette.noResults')}</div>}
          {canScrollForMore && <div className="px-2 py-1 text-center text-3xs text-text-muted">{t('commandPalette.scrollForMore')}</div>}
        </div>
      </div>
    </div>
  );
};
