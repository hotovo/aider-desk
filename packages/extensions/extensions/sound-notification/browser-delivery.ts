import { randomUUID } from 'crypto';

import type { NotificationData } from '@aiderdesk/extensions';

/**
 * Maximum number of notifications held in the in-memory browser-playback queue.
 * Older entries are dropped (FIFO) when the queue overflows.
 */
export const MAX_QUEUED_NOTIFICATIONS = 20;

/**
 * How long a playback claim (see `acquireClaims`) stays valid. If the claiming
 * consumer never acknowledges within the lease (crashed tab, lost connection),
 * the claim expires and another consumer may claim the delivery on its next
 * refresh. Keep it well above a chime's duration (~1s) but short enough that a
 * dead consumer does not suppress notifications for long.
 */
export const CLAIM_LEASE_MS = 10_000;

export interface QueuedNotification {
  /** Notification contract id (empty string when the source did not provide one) */
  id: string;
  /** Unique per-queue-entry nonce; used for download-side dedupe and consumer acknowledgement */
  deliveryId: string;
  /** Machine-readable kind; defaults to 'generic' */
  kind: string;
  title: string;
  body: string;
  baseDir: string;
  timestamp?: number;
}

/**
 * Matching Phase 1 dedup key: `${baseDir}:${id}`. Returns an empty string when
 * the notification has no id — such notifications are never deduplicated
 * (same rule as the renderer-side deduplicator: "blank id = never duplicate").
 */
export function deliveryKey(notification: Pick<QueuedNotification, 'baseDir' | 'id'>): string {
  return notification.id ? `${notification.baseDir}:${notification.id}` : '';
}

export function toQueuedNotification(notification: NotificationData): QueuedNotification {
  return {
    id: notification.id ?? '',
    deliveryId: randomUUID(),
    kind: notification.kind ?? 'generic',
    title: notification.title,
    body: notification.body,
    baseDir: notification.baseDir,
    timestamp: notification.timestamp,
  };
}

/**
 * In-memory (main-process) FIFO queue of notifications awaiting playback in a
 * remote browser tab.
 *
 * Delivery follows a snapshot / claim / acknowledge protocol instead of a
 * destructive drain so that concurrent consumers (e.g. two remote browser tabs
 * on different devices fetching `getUIExtensionData`) can never chime the same
 * notification twice, and a consumer that cannot play (hidden tab, lost
 * primary-tab election, failed audio unlock) can never steal a notification
 * from the tab that can:
 * 1. `getUIExtensionData` hands every consumer a NON-destructive `snapshot()`
 *    of the still-unacknowledged entries.
 * 2. Before playing, the panel acquires an atomic, per-consumer playback
 *    claim via the `acquire-claims` UI action (`acquireClaims`). Claims are
 *    assigned inside the single-threaded main process, so exactly one
 *    consumer wins; other consumers see the delivery as still queued but not
 *    theirs. A claim holds an in-flight lease (`CLAIM_LEASE_MS`) that expires
 *    so a consumer that dies without acknowledging does not starve the queue
 *    (re-claiming a still-fresh own claim does not renew it).
 * 3. After the panel actually plays the claimed sounds it confirms via the
 *    `acknowledge-played` extension UI action (passing its consumer id), and
 *    `acknowledge()` removes exactly those entries (and their claims / dedupe
 *    keys) from the queue — never entries that another consumer still holds an
 *    active playback claim on (so a stray ack cannot lose a claimant's
 *    notification).
 */
export class BrowserNotificationQueue {
  private readonly queue: QueuedNotification[] = [];
  private readonly enqueuedKeys = new Map<string, boolean>();
  private readonly claims = new Map<string, { consumerId: string; expiresAt: number }>();

  /**
   * Append a notification for browser playback.
   * @returns the queued payload, or null when it was skipped (duplicate id or overflow drop)
   */
  enqueue(notification: NotificationData): QueuedNotification | null {
    const payload = toQueuedNotification(notification);
    const key = deliveryKey(payload);

    if (key) {
      if (this.enqueuedKeys.has(key)) {
        return null;
      }
      // Track immediately so concurrent re-pushes of the same notification
      // (e.g. across refresh cycles) are ignored until eviction.
      this.track(key);
    }

    this.queue.push(payload);
    if (this.queue.length > MAX_QUEUED_NOTIFICATIONS) {
      const dropped = this.queue.shift();
      // The dropped entry is gone from the queue: release any stale claim on
      // it AND its dedupe key (same key derivation as the enqueue above), so a
      // later genuine redispatch of the dropped notification is accepted
      // instead of being permanently suppressed by a key with no queue entry.
      if (dropped) {
        this.claims.delete(dropped.deliveryId);
        const droppedKey = deliveryKey(dropped);
        if (droppedKey) {
          this.enqueuedKeys.delete(droppedKey);
        }
      }
    }

    return payload;
  }

  /**
   * Atomically claim playback of the given queued deliveries for one consumer
   * (e.g. a browser tab id). The main process is single-threaded, so each
   * delivery is won by exactly one consumer; losers receive an empty result
   * for that delivery and must NOT play or acknowledge it. A claim expires
   * after `CLAIM_LEASE_MS`, and a consumer always re-claims its own
   * (still-fresh) claim without side effects: re-acquiring a claim it still
   * owns preserves the original expiry (no renewal), so a consumer that never
   * acknowledges cannot extend its lease indefinitely and starve others.
   * NOTE on delivery semantics: claims with lease expiry give AT-LEAST-ONCE
   * playback, not exactly-once. A consumer that loses its lease (crashed tab,
   * lost connection — or merely one that acknowledges slower than
   * `CLAIM_LEASE_MS`) lets another consumer claim and replay the same
   * delivery, so an (extremely rare) duplicate chime is possible. This is
   * accepted deliberately: a cross-tab/device idempotency mechanism (shared
   * playback ledger) would cost far more than the occasional repeated chime,
   * and the per-window playback guards keep duplicates within a single tab
   * impossible.
   *
   * @param consumerId stable id of the requesting consumer (e.g. the panel tab id)
   * @param deliveryIds candidate delivery ids from a previous snapshot
   * @param now injectable clock (ms) — exposed for lease-expiry tests
   * @returns the subset of deliveryIds actually claimed by this consumer
   */
  acquireClaims(consumerId: string, deliveryIds: readonly string[], now: number = Date.now()): string[] {
    const queuedIds = new Set(this.queue.map((entry) => entry.deliveryId));
    const claimed = new Set<string>();

    for (const deliveryId of deliveryIds) {
      // Deduplicate the input and skip deliveries already claimed in this call
      // (duplicate candidate ids must never yield duplicate claimed results).
      if (claimed.has(deliveryId) || !queuedIds.has(deliveryId)) {
        continue;
      }
      const existing = this.claims.get(deliveryId);
      if (existing && existing.consumerId !== consumerId && existing.expiresAt > now) {
        continue;
      }
      if (existing && existing.consumerId === consumerId && existing.expiresAt > now) {
        // Re-claiming a still-fresh own claim is side-effect free: preserve the
        // original expiry (no renewal), so a consumer that fails to
        // acknowledge cannot extend its lease indefinitely and starve others.
        claimed.add(deliveryId);
        continue;
      }
      // Fresh lease: the claim is expired (regardless of the previous owner)
      // or absent.
      this.claims.set(deliveryId, { consumerId, expiresAt: now + CLAIM_LEASE_MS });
      claimed.add(deliveryId);
    }
    return [...claimed];
  }

  /**
   * Return a non-destructive copy of the currently queued notifications
   * (oldest first). Entries remain queued until they are explicitly
   * acknowledged after successful playback.
   */
  snapshot(): QueuedNotification[] {
    return this.queue.map((notification) => ({ ...notification }));
  }

  /**
   * Remove entries acknowledged as played by a consumer. Also releases their
   * playback claims, and releases their dedupe keys so a genuine redispatch of
   * the same notification can be queued again (renderer-transport redeliveries
   * of an already-queued notification are still deduplicated by the tracked
   * key while the entry remains unacknowledged).
   *
   * Claim-ownership guard: when `consumerId` is given, an entry whose playback
   * claim is still actively held by a DIFFERENT consumer is NOT removed —
   * that claimant is about to play the delivery, and letting an unrelated
   * caller ack it away would silently lose the claimant's notification (the
   * claimant's own ack path requires the same consumer id, and an absent or
   * expired claim anywhere else leaves the removal allowed). Unclaimed
   * entries and legacy callers (no consumer id, e.g. older panel builds)
   * keep the unconditional removal.
   * @param consumerId stable id of the acknowledging consumer (e.g. the panel tab id)
   * @returns the number of entries removed
   */
  acknowledge(deliveryIds: readonly string[], consumerId?: string): number {
    const wanted = new Set(deliveryIds);
    const now = Date.now();
    let removed = 0;
    for (let i = this.queue.length - 1; i >= 0; i--) {
      const entry = this.queue[i];
      if (wanted.has(entry.deliveryId)) {
        // An actively-held claim of another consumer blocks the removal: that
        // consumer legitimately owns the playback of this delivery.
        const claim = this.claims.get(entry.deliveryId);
        if (consumerId && claim && claim.consumerId !== consumerId && claim.expiresAt > now) {
          continue;
        }
        this.queue.splice(i, 1);
        this.claims.delete(entry.deliveryId);
        const key = deliveryKey(entry);
        if (key) {
          this.enqueuedKeys.delete(key);
        }
        removed++;
      }
    }
    return removed;
  }

  get size(): number {
    return this.queue.length;
  }

  /**
   * Track an enqueued delivery's dedupe key until its queue entry is removed.
   * Deliberately uncapped: every tracked key has a matching queue entry
   * (released together by `acknowledge()` and by the overflow drop), and the
   * queue itself is capped at `MAX_QUEUED_NOTIFICATIONS`, so the number of
   * tracked keys can never exceed that cap. An eviction branch here was
   * therefore unreachable dead code and has been removed.
   */
  private track(key: string): void {
    this.enqueuedKeys.set(key, true);
  }
}
