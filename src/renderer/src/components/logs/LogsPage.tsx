import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { SystemLogEntry, SystemLogLevel } from '@common/types';
import { clsx } from 'clsx';
import { FaSearch, FaTrash, FaChevronDown } from 'react-icons/fa';
import { CgSpinner } from 'react-icons/cg';

import { ModalOverlayLayout } from '@/components/common/ModalOverlayLayout';
import { useApi } from '@/contexts/ApiContext';
import { Button } from '@/components/common/Button';
import { Input } from '@/components/common/Input';
import { Select } from '@/components/common/Select';
import { Checkbox } from '@/components/common/Checkbox';
import { ConfirmDialog } from '@/components/common/ConfirmDialog';

const LOG_LEVEL_COLORS: Record<SystemLogLevel, string> = {
  debug: 'text-text-muted',
  info: 'text-info',
  warn: 'text-warning',
  error: 'text-error',
};

const PAGE_SIZE = 100;

// Track expanded log entries
const useExpandedLogs = () => {
  const [expandedIds, setExpandedIds] = useState<Set<number | string>>(new Set());

  const toggleExpanded = useCallback((id: number | string | undefined) => {
    if (id === undefined) {
      return;
    }
    setExpandedIds((prev) => {
      const newSet = new Set(prev);
      if (newSet.has(id)) {
        newSet.delete(id);
      } else {
        newSet.add(id);
      }
      return newSet;
    });
  }, []);

  const isExpanded = useCallback(
    (id: number | string | undefined) => {
      if (id === undefined) {
        return false;
      }
      return expandedIds.has(id);
    },
    [expandedIds],
  );

  return { toggleExpanded, isExpanded };
};

// Helper function to deduplicate logs by ID
const deduplicateLogs = (logs: SystemLogEntry[]): SystemLogEntry[] => {
  const seen = new Set<number>();
  return logs.filter((log) => {
    if (log.id === undefined) {
      return true; // Keep logs without ID
    }
    if (seen.has(log.id)) {
      return false; // Skip duplicates
    }
    seen.add(log.id);
    return true;
  });
};

type Props = {
  openInWindowUrl?: string;
  onClose: () => void;
};

export const LogsPage = ({ openInWindowUrl, onClose }: Props) => {
  const { t } = useTranslation();
  const api = useApi();
  const [logs, setLogs] = useState<SystemLogEntry[]>([]);
  const [loading, setLoading] = useState(true);
  const [hasMore, setHasMore] = useState(false);
  const [loadingMore, setLoadingMore] = useState(false);
  const [selectedLevels, setSelectedLevels] = useState<Set<SystemLogLevel>>(new Set(['info', 'warn', 'error']));
  const [selectedExtension, setSelectedExtension] = useState<string>('all');
  const [searchText, setSearchText] = useState('');
  const [autoScroll, setAutoScroll] = useState(true);
  const [showClearConfirm, setShowClearConfirm] = useState(false);
  const logsContainerRef = useRef<HTMLDivElement>(null);
  const shouldAutoScrollRef = useRef(true); // Track if we should auto-scroll
  const { toggleExpanded, isExpanded } = useExpandedLogs();

  // Load initial logs
  useEffect(() => {
    const loadLogs = async () => {
      try {
        setLoading(true);
        const levelsArray = Array.from(selectedLevels);
        const response = await api.getSystemLogs(undefined, PAGE_SIZE, levelsArray);
        setLogs(response.logs);
        setHasMore(response.hasMore);
        shouldAutoScrollRef.current = true; // Enable auto-scroll for initial load
      } catch (error) {
        // eslint-disable-next-line no-console
        console.error('Failed to load system logs:', error);
      } finally {
        setLoading(false);
      }
    };

    void loadLogs();
  }, [api, selectedLevels]);

  // Listen for new logs
  useEffect(() => {
    const unsubscribe = api.addSystemLogListener((data) => {
      setLogs((prev) => {
        // Check if this log already exists (by ID)
        if (data.entry.id !== undefined && prev.some((log) => log.id === data.entry.id)) {
          return prev; // Skip duplicate
        }
        return [...prev, data.entry];
      });
      shouldAutoScrollRef.current = true; // Enable auto-scroll for new real-time logs
    });

    return unsubscribe;
  }, [api]);

  // Auto-scroll to bottom when new logs arrive
  useEffect(() => {
    if (autoScroll && shouldAutoScrollRef.current && logsContainerRef.current && filteredLogs.length > 0) {
      logsContainerRef.current.scrollTop = logsContainerRef.current.scrollHeight;
      shouldAutoScrollRef.current = false; // Reset flag after scrolling
    }
  }, [logs, autoScroll]); // eslint-disable-line react-hooks/exhaustive-deps

  // Extract unique extensions from logs
  const extensions = useMemo(() => {
    const extensionSet = new Set<string>();
    logs.forEach((log) => {
      if (log.extension) {
        extensionSet.add(log.extension);
      }
    });
    return Array.from(extensionSet).sort();
  }, [logs]);

  // Filter logs
  const filteredLogs = useMemo(() => {
    return logs.filter((log) => {
      // Filter by level
      if (!selectedLevels.has(log.level)) {
        return false;
      }

      // Filter by extension
      if (selectedExtension !== 'all') {
        const isFromExtension = log.extension === selectedExtension;
        const isMentioned = log.message.includes(`[Extension:${selectedExtension}]`) || log.message.includes(selectedExtension);
        if (!isFromExtension && !isMentioned) {
          return false;
        }
      }

      // Filter by search text
      if (searchText && !log.message.toLowerCase().includes(searchText.toLowerCase())) {
        return false;
      }

      return true;
    });
  }, [logs, selectedLevels, selectedExtension, searchText]);

  const handleLevelToggle = (level: SystemLogLevel) => {
    setSelectedLevels((prev) => {
      const newSet = new Set(prev);
      if (newSet.has(level)) {
        newSet.delete(level);
      } else {
        newSet.add(level);
      }
      return newSet;
    });
  };

  const handleClear = useCallback(async () => {
    try {
      await api.clearSystemLogs();
      setLogs([]);
      setHasMore(false);
      setShowClearConfirm(false);
    } catch (error) {
      // eslint-disable-next-line no-console
      console.error('Failed to clear logs:', error);
    }
  }, [api]);

  // Load more logs (older logs - prepend to the beginning)
  const loadMoreLogs = useCallback(async () => {
    if (!hasMore || loadingMore || logs.length === 0) {
      return;
    }

    const oldestLogId = logs[0].id; // First log is now the oldest
    if (oldestLogId === undefined) {
      return;
    }

    try {
      setLoadingMore(true);
      const levelsArray = Array.from(selectedLevels);
      const response = await api.getSystemLogs(oldestLogId, PAGE_SIZE, levelsArray);
      setLogs((prev) => deduplicateLogs([...response.logs, ...prev])); // Prepend older logs and deduplicate
      setHasMore(response.hasMore);
    } catch (error) {
      // eslint-disable-next-line no-console
      console.error('Failed to load more logs:', error);
    } finally {
      setLoadingMore(false);
    }
  }, [api, hasMore, loadingMore, logs, selectedLevels]);

  // Handle scroll event for infinite scroll
  const handleScroll = useCallback(
    (e: React.UIEvent<HTMLDivElement>) => {
      const container = e.currentTarget;
      if (!container) {
        return;
      }

      // Check if scrolled to top (scroll up to load more older logs)
      const { scrollTop } = container;
      if (scrollTop < 50 && hasMore && !loadingMore) {
        void loadMoreLogs();
      }
    },
    [hasMore, loadingMore, loadMoreLogs],
  );

  const renderLogEntry = (log: SystemLogEntry, index: number) => {
    const hasMetadata = log.metadata && Object.keys(log.metadata).length > 0;
    const expanded = isExpanded(log.id ?? index);
    const entryId = log.id ?? index;

    return (
      <div key={entryId} className={clsx('border-b border-border-default-dark hover:bg-bg-tertiary font-mono text-xs', expanded && 'bg-bg-tertiary')}>
        <div className={clsx('px-4 py-1 flex items-start gap-2', hasMetadata && 'cursor-pointer')} onClick={() => hasMetadata && toggleExpanded(entryId)}>
          {hasMetadata && (
            <FaChevronDown
              className={clsx('w-3 h-3 mt-0.5 text-text-muted transition-transform duration-200 flex-shrink-0', expanded ? 'rotate-0' : '-rotate-90')}
            />
          )}
          {!hasMetadata && <span className="w-3 h-3 flex-shrink-0" />}
          <span className="text-text-muted whitespace-nowrap">{new Date(log.timestamp).toLocaleTimeString()}</span>
          <span className={clsx('font-semibold uppercase whitespace-nowrap', LOG_LEVEL_COLORS[log.level])}>{log.level}</span>
          {log.extension && <span className="text-accent whitespace-nowrap">[{log.extension}]</span>}
          <span className="text-text-primary break-all flex-1">{log.message}</span>
        </div>
        {expanded && hasMetadata && (
          <div className="px-4 pb-2 pl-[4.5rem]">
            <pre className="bg-bg-code-block text-text-muted text-2xs p-2 rounded overflow-x-auto scrollbar-thin scrollbar-track-bg-primary-light scrollbar-thumb-bg-tertiary hover:scrollbar-thumb-bg-fourth">
              {JSON.stringify(log.metadata, null, 2)}
            </pre>
          </div>
        )}
      </div>
    );
  };

  return (
    <ModalOverlayLayout title={t('logs.title')} onClose={onClose} closeOnEscape openInWindowUrl={openInWindowUrl} openInWindowTitle={t('logs.title')}>
      <div className="flex flex-col h-full overflow-hidden">
        {/* Filters and Controls */}
        <div className="p-4 border-b-2 border-border-default space-y-2">
          <div className="flex items-center gap-3 flex-wrap">
            {/* Search field on the left */}
            <div className="flex-1 min-w-[200px] relative">
              <FaSearch className="absolute left-3 top-1/2 transform -translate-y-1/2 text-text-muted" />
              <Input
                type="text"
                value={searchText}
                onChange={(e) => setSearchText(e.target.value)}
                placeholder={t('logs.searchPlaceholder')}
                className="w-full pl-10"
              />
            </div>
          </div>

          {/* Filter section on the right */}
          <div className="flex items-center gap-3 flex-wrap">
            {/* Level checkboxes */}
            {(['debug', 'info', 'warn', 'error'] as SystemLogLevel[]).map((level) => (
              <Checkbox
                key={level}
                label={level.toUpperCase()}
                checked={selectedLevels.has(level)}
                onChange={() => handleLevelToggle(level)}
                className="text-xs"
                tooltip={level === 'debug' && selectedLevels.has('debug') ? t('logs.debugTooltip') : undefined}
              />
            ))}

            {/* Extension filter */}
            <Select
              value={selectedExtension}
              onChange={(value) => setSelectedExtension(value)}
              options={[
                { value: 'all', label: t('logs.allExtensions') },
                ...extensions.map((ext) => ({
                  value: ext,
                  label: ext,
                })),
              ]}
              className="min-w-64 ml-4"
            />
          </div>
        </div>

        {/* Logs list */}
        <div
          ref={logsContainerRef}
          className="flex-1 bg-bg-primary-light overflow-y-auto scrollbar-thin scrollbar-track-transparent scrollbar-thumb-bg-tertiary hover:scrollbar-thumb-bg-tertiary-strong"
          onScroll={handleScroll}
        >
          {loading ? (
            <div className="flex items-center justify-center h-full">
              <CgSpinner className="animate-spin w-10 h-10 text-text-primary" />
            </div>
          ) : filteredLogs.length === 0 ? (
            <div className="flex items-center justify-center h-full text-text-muted">{t('logs.noLogs')}</div>
          ) : (
            <>
              {loadingMore && (
                <div className="flex items-center justify-center py-2">
                  <CgSpinner className="animate-spin w-4 h-4 text-text-muted" />
                </div>
              )}
              {filteredLogs.map((log, index) => renderLogEntry(log, index))}
            </>
          )}
        </div>
        <div className="p-2 pl-4 border-border-default flex justify-between items-center gap-2">
          {/* Auto-scroll */}
          <Checkbox label={t('logs.autoScroll')} checked={autoScroll} onChange={setAutoScroll} className="text-xs" />

          {/* Clear logs button */}
          <Button onClick={() => setShowClearConfirm(true)} variant="outline" size="sm" color="danger">
            <FaTrash className="inline mr-1" />
            {t('logs.clear')}
          </Button>
        </div>

        {/* Clear confirmation dialog */}
        {showClearConfirm && (
          <ConfirmDialog
            title={t('logs.clearConfirm.title')}
            onConfirm={handleClear}
            onCancel={() => setShowClearConfirm(false)}
            confirmButtonText={t('logs.clearConfirm.confirm')}
            cancelButtonText={t('logs.clearConfirm.cancel')}
            confirmButtonColor="danger"
          >
            <p className="text-text-primary">{t('logs.clearConfirm.message')}</p>
          </ConfirmDialog>
        )}
      </div>
    </ModalOverlayLayout>
  );
};
