import { act, render } from '@testing-library/react';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

import { DevelopmentPerformanceCleanup } from '../DevelopmentPerformanceCleanup';

import { globalMockApi } from '@/__tests__/mocks/api';

const createMemoryInfo = (residentSet: number) => ({
  private: residentSet,
  residentSet,
  shared: 0,
});

describe('DevelopmentPerformanceCleanup', () => {
  const clearMeasures = vi.fn();
  const consoleLog = vi.fn();

  beforeEach(() => {
    vi.useFakeTimers();
    vi.setSystemTime(0);
    vi.clearAllMocks();
    Object.defineProperty(performance, 'clearMeasures', {
      configurable: true,
      value: clearMeasures,
    });
    vi.spyOn(console, 'log').mockImplementation(consoleLog);
  });

  afterEach(() => {
    vi.useRealTimers();
    vi.restoreAllMocks();
    Reflect.deleteProperty(performance, 'clearMeasures');
  });

  it('logs when the cleanup is running', () => {
    render(<DevelopmentPerformanceCleanup />);

    expect(consoleLog).toHaveBeenCalledWith('Development performance cleanup is running.');
  });

  it('clears measures when renderer memory reaches the threshold', async () => {
    vi.mocked(globalMockApi.getRendererProcessMemoryInfo).mockResolvedValue(createMemoryInfo(3 * 1024 * 1024));
    render(<DevelopmentPerformanceCleanup />);

    await act(async () => {
      await vi.advanceTimersByTimeAsync(60_000);
    });

    expect(clearMeasures).toHaveBeenCalledOnce();
  });

  it('does not clear measures while renderer memory remains below the threshold', async () => {
    vi.mocked(globalMockApi.getRendererProcessMemoryInfo).mockResolvedValue(createMemoryInfo(512 * 1024));
    render(<DevelopmentPerformanceCleanup />);

    await act(async () => {
      await vi.advanceTimersByTimeAsync(120_000);
    });

    expect(clearMeasures).not.toHaveBeenCalled();
  });

  it('does not clear measures when renderer memory information is unavailable', async () => {
    vi.mocked(globalMockApi.getRendererProcessMemoryInfo).mockRejectedValue(new Error('Unavailable'));
    render(<DevelopmentPerformanceCleanup />);

    await act(async () => {
      await vi.advanceTimersByTimeAsync(60_000);
    });

    expect(clearMeasures).not.toHaveBeenCalled();
  });
});
