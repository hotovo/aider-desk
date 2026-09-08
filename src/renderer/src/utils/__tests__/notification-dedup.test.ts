import { afterEach, describe, expect, it, vi } from 'vitest';

import { createNotificationDeduplicator } from '../notification-dedup';

describe('notification-dedup', () => {
  afterEach(() => {
    vi.restoreAllMocks();
  });

  it('allows a notification the first time it is seen', () => {
    const deduplicator = createNotificationDeduplicator();

    expect(deduplicator.isDuplicate({ id: 'n-1' })).toBe(false);
  });

  it('suppresses a redelivered id within the window', () => {
    const deduplicator = createNotificationDeduplicator();

    deduplicator.isDuplicate({ id: 'n-1' });
    expect(deduplicator.isDuplicate({ id: 'n-1' })).toBe(true);
  });

  it('never considers notifications without an id duplicates (backward compatibility)', () => {
    const deduplicator = createNotificationDeduplicator();

    expect(deduplicator.isDuplicate({ id: '' })).toBe(false);
    expect(deduplicator.isDuplicate({ id: '' })).toBe(false);
  });

  it('never throws and treats nullish or malformed payloads as fresh (must not abort event dispatch)', () => {
    const deduplicator = createNotificationDeduplicator();

    expect(deduplicator.isDuplicate(null)).toBe(false);
    expect(deduplicator.isDuplicate(undefined)).toBe(false);
    expect(deduplicator.isDuplicate('garbage' as unknown as { id: string })).toBe(false);
    expect(deduplicator.isDuplicate({} as unknown as { id: string })).toBe(false);
    expect(deduplicator.isDuplicate({ id: 42 as unknown as string })).toBe(false);

    // Still functional after malformed input
    expect(deduplicator.isDuplicate({ id: 'n-1' })).toBe(false);
    expect(deduplicator.isDuplicate({ id: 'n-1' })).toBe(true);
  });

  it('treats distinct ids as independent notifications', () => {
    const deduplicator = createNotificationDeduplicator();

    deduplicator.isDuplicate({ id: 'n-1' });
    expect(deduplicator.isDuplicate({ id: 'n-2' })).toBe(false);
  });

  it('isolates identical ids across different projects (per baseDir + id key)', () => {
    const deduplicator = createNotificationDeduplicator();

    // First project sees the id
    expect(deduplicator.isDuplicate({ baseDir: '/projects/a', id: 'n-1' })).toBe(false);
    // A different project with the same id must NOT be suppressed
    expect(deduplicator.isDuplicate({ baseDir: '/projects/b', id: 'n-1' })).toBe(false);

    // Redelivery within each project is still suppressed
    expect(deduplicator.isDuplicate({ baseDir: '/projects/a', id: 'n-1' })).toBe(true);
    expect(deduplicator.isDuplicate({ baseDir: '/projects/b', id: 'n-1' })).toBe(true);

    // A third project with the same id is still fresh
    expect(deduplicator.isDuplicate({ baseDir: '/projects/c', id: 'n-1' })).toBe(false);
  });

  it('treats a differing baseDir as a different dedup key even when ids collide', () => {
    const deduplicator = createNotificationDeduplicator();

    deduplicator.isDuplicate({ baseDir: '/projects/a', id: 'shared' });
    expect(deduplicator.isDuplicate({ baseDir: '/projects/ab', id: 'shared' })).toBe(false);
    expect(deduplicator.isDuplicate({ baseDir: '/projects/ab2', id: 'shared' })).toBe(false);
  });

  it('falls back to the id-only key when baseDir is absent or malformed', () => {
    const deduplicator = createNotificationDeduplicator();

    expect(deduplicator.isDuplicate({ id: 'n-1' })).toBe(false);
    expect(deduplicator.isDuplicate({ id: 'n-1' })).toBe(true);
    expect(deduplicator.isDuplicate({ baseDir: 42 as unknown as string, id: 'n-2' })).toBe(false);
    expect(deduplicator.isDuplicate({ baseDir: 42 as unknown as string, id: 'n-2' })).toBe(true);
  });

  it('allows the same id again after the dedup window elapses', () => {
    const now = Date.now();
    const nowSpy = vi.spyOn(Date, 'now').mockReturnValue(now);
    const deduplicator = createNotificationDeduplicator(10 * 60 * 1000);

    deduplicator.isDuplicate({ id: 'n-1' });

    nowSpy.mockReturnValue(now + 9 * 60 * 1000);
    expect(deduplicator.isDuplicate({ id: 'n-1' })).toBe(true);

    nowSpy.mockReturnValue(now + 10 * 60 * 1000);
    // Eviction only happens strictly after the window (now - timestamp > windowMs)
    expect(deduplicator.isDuplicate({ id: 'n-1' })).toBe(true);

    nowSpy.mockReturnValue(now + 10 * 60 * 1000 + 1);
    expect(deduplicator.isDuplicate({ id: 'n-1' })).toBe(false);
  });

  it('evicts expired entries before checking for duplicates', () => {
    const now = Date.now();
    const nowSpy = vi.spyOn(Date, 'now').mockReturnValue(now);
    const deduplicator = createNotificationDeduplicator(1000, 10);

    deduplicator.isDuplicate({ id: 'old' });

    nowSpy.mockReturnValue(now + 2000);
    // 'old' expired: evicted before the check, so 'new' is accepted and 'old' treated as fresh again
    expect(deduplicator.isDuplicate({ id: 'new' })).toBe(false);
    expect(deduplicator.isDuplicate({ id: 'old' })).toBe(false);
    expect(deduplicator.isDuplicate({ id: 'new' })).toBe(true);
  });

  it('evicts the oldest tracked id when maxTrackedIds is exceeded', () => {
    const deduplicator = createNotificationDeduplicator(10 * 60 * 1000, 2);

    deduplicator.isDuplicate({ id: 'a' });
    deduplicator.isDuplicate({ id: 'b' });

    // 'c' pushes out 'a' (oldest insertion in Map order)
    expect(deduplicator.isDuplicate({ id: 'c' })).toBe(false);

    expect(deduplicator.isDuplicate({ id: 'b' })).toBe(true);
    expect(deduplicator.isDuplicate({ id: 'c' })).toBe(true);
    expect(deduplicator.isDuplicate({ id: 'a' })).toBe(false);
  });

  it('uses default window and capacity when no arguments are provided', () => {
    const now = Date.now();
    vi.spyOn(Date, 'now').mockReturnValue(now);
    const deduplicator = createNotificationDeduplicator();

    const ids = Array.from({ length: 200 }, (_, i) => `id-${i}`);
    ids.forEach((id) => expect(deduplicator.isDuplicate({ id })).toBe(false));

    // The 201st insertion evicts the oldest tracked id
    expect(deduplicator.isDuplicate({ id: 'id-200' })).toBe(false);

    expect(deduplicator.isDuplicate({ id: ids[1] })).toBe(true);
    expect(deduplicator.isDuplicate({ id: ids[0] })).toBe(false);
  });

  it('refreshes recency without refreshing eviction order when a duplicate is suppressed', () => {
    const deduplicator = createNotificationDeduplicator(10 * 60 * 1000, 2);

    deduplicator.isDuplicate({ id: 'a' });
    deduplicator.isDuplicate({ id: 'b' });

    // A suppressed redelivery of 'b' must not refresh 'a' out of position:
    // next insertion evicts 'a' (insertion order), but 'b' remains tracked.
    deduplicator.isDuplicate({ id: 'b' });
    deduplicator.isDuplicate({ id: 'c' });

    expect(deduplicator.isDuplicate({ id: 'b' })).toBe(true);
    expect(deduplicator.isDuplicate({ id: 'a' })).toBe(false);
  });
});
