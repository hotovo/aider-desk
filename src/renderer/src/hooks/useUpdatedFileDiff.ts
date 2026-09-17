import { useCallback, useEffect, useRef, useState } from 'react';
import { UpdatedFile } from '@common/types';

import { useApi } from '@/contexts/ApiContext';

// Files with more changed lines than this show a "load diff" placeholder instead of auto-fetching
export const LARGE_DIFF_THRESHOLD = 1000;

type CachedDiff = {
  diff: string;
  timestamp: number;
};

type UseUpdatedFileDiffResult = {
  diff: string | null;
  loading: boolean;
  isLarge: boolean;
  load: () => void;
};

const fileDiffKey = (file: UpdatedFile): string => `${file.commitHash ?? 'uncommitted'}:${file.path}`;

/**
 * Lazily fetches the diff for an updated file from the backend on demand.
 * Small diffs are fetched automatically; files above LARGE_DIFF_THRESHOLD wait
 * for an explicit load() call (GitHub-style "large file" gate).
 */
export const useUpdatedFileDiff = (baseDir: string, taskId: string, file: UpdatedFile | null | undefined, enabled = true): UseUpdatedFileDiffResult => {
  const api = useApi();
  const cacheRef = useRef<Map<string, CachedDiff>>(new Map());
  const fetchedRef = useRef<string | null>(null);
  const [diff, setDiff] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);
  const [userRequestedLarge, setUserRequestedLarge] = useState(false);
  const [activeKey, setActiveKey] = useState<string | null>(null);

  const key = file ? fileDiffKey(file) : null;
  const filePath = file?.path ?? null;
  const commitHash = file?.commitHash ?? undefined;
  const isLarge = !!file && file.additions + file.deletions > LARGE_DIFF_THRESHOLD;

  const load = useCallback(() => {
    if (!file || !taskId || !baseDir) {
      return;
    }
    setUserRequestedLarge(true);
  }, [baseDir, file, taskId]);

  useEffect(() => {
    if (key !== activeKey) {
      // New file (or first mount): reset loaded state. Once a diff is loaded
      // for the current key it stays loaded until the file/modal changes.
      setActiveKey(key);
      setUserRequestedLarge(false);
      setDiff(null);
      setLoading(false);
      fetchedRef.current = null;
    }
  }, [key, activeKey]);

  useEffect(() => {
    if (!filePath || !key || !taskId || !baseDir) {
      return;
    }

    // Already fetched for this key: keep it (no refetch when disabled/toggled)
    if (fetchedRef.current === key && diff !== null) {
      return;
    }

    if (!enabled) {
      return;
    }

    const cached = cacheRef.current.get(key);
    const now = Date.now();
    if (cached && now - cached.timestamp < 5000) {
      setDiff(cached.diff);
      fetchedRef.current = key;
      return;
    }

    // Large files wait for an explicit user request
    if (isLarge && !userRequestedLarge) {
      return;
    }

    const cachedForFetch = cacheRef.current.get(key);
    const fetchTimestamp = cachedForFetch ? cachedForFetch.timestamp : now;
    let cancelled = false;
    const fetchDiff = async () => {
      setLoading(true);
      try {
        const result = await api.getUpdatedFileDiff(baseDir, taskId, filePath, commitHash);
        if (!cancelled) {
          cacheRef.current.set(key, { diff: result, timestamp: fetchTimestamp });
          setDiff(result);
          fetchedRef.current = key;
        }
      } catch (error) {
        // eslint-disable-next-line no-console
        console.error('Failed to fetch file diff:', error);
        if (!cancelled) {
          setDiff('');
          fetchedRef.current = key;
        }
      } finally {
        if (!cancelled) {
          setLoading(false);
        }
      }
    };

    void fetchDiff();
    return () => {
      cancelled = true;
    };
  }, [api, baseDir, taskId, key, enabled, userRequestedLarge, diff, filePath, commitHash, isLarge]);

  return { diff, loading, isLarge, load };
};
