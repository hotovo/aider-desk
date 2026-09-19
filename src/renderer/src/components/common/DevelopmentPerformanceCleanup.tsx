import { useEffect } from 'react';

const MEMORY_CHECK_INTERVAL_MS = 10_000;
const PERIODIC_CLEANUP_INTERVAL_MS = 60_000;
const RENDERER_MEMORY_THRESHOLD_KB = 2 * 1024 * 1024;

export const DevelopmentPerformanceCleanup = () => {
  useEffect(() => {
    // eslint-disable-next-line no-console
    console.log('Development performance cleanup is running.');
  }, []);

  useEffect(() => {
    let disposed = false;
    let checkInProgress = false;
    let lastCleanupAt = Date.now();

    const checkAndCleanup = async () => {
      if (checkInProgress) {
        return;
      }

      checkInProgress = true;
      try {
        let residentSet = 0;
        try {
          const memoryInfo = await window.api?.getRendererProcessMemoryInfo?.();
          residentSet = memoryInfo?.residentSet ?? 0;
        } catch {
          residentSet = 0;
        }

        if (disposed) {
          return;
        }

        const now = Date.now();
        if (residentSet >= RENDERER_MEMORY_THRESHOLD_KB || now - lastCleanupAt >= PERIODIC_CLEANUP_INTERVAL_MS) {
          performance.clearMeasures();
          lastCleanupAt = now;
        }
      } finally {
        checkInProgress = false;
      }
    };

    const interval = window.setInterval(() => void checkAndCleanup(), MEMORY_CHECK_INTERVAL_MS);

    return () => {
      disposed = true;
      window.clearInterval(interval);
    };
  }, []);

  return null;
};
