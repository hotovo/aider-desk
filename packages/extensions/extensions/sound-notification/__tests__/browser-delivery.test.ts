import { describe, expect, it } from 'vitest';

import { BrowserNotificationQueue, CLAIM_LEASE_MS, MAX_QUEUED_NOTIFICATIONS, deliveryKey } from '../browser-delivery';

const makeNotification = (id: string, baseDir = '/projects/demo', kind = 'task-finished') => ({
  baseDir,
  title: `title-${id}`,
  body: 'body',
  id,
  kind,
  timestamp: 1_700_000_000_000,
});

describe('deliveryKey', () => {
  it('scopes the dedupe key by baseDir and id', () => {
    expect(deliveryKey({ baseDir: '/a', id: 'n-1' })).toBe('/a:n-1');
  });

  it('returns an empty string when the notification has no id', () => {
    expect(deliveryKey({ baseDir: '/a', id: '' })).toBe('');
  });
});

describe('BrowserNotificationQueue', () => {
  it('pushes notifications and returns them FIFO via snapshot', () => {
    const queue = new BrowserNotificationQueue();

    expect(queue.enqueue(makeNotification('n-1'))).toMatchObject({ id: 'n-1', kind: 'task-finished', baseDir: '/projects/demo' });
    expect(queue.enqueue(makeNotification('n-2'))).toEqual(expect.objectContaining({ id: 'n-2' }));
    expect(queue.size).toBe(2);

    expect(queue.snapshot().map((n) => n.id)).toEqual(['n-1', 'n-2']);
    expect(queue.size).toBe(2);
  });

  it('defaults missing kind to generic and missing timestamp to undefined', () => {
    const queue = new BrowserNotificationQueue();

    const queued = queue.enqueue({ baseDir: '/a', title: 't', body: 'b', id: 'n-3' });

    expect(queued).toMatchObject({ id: 'n-3', kind: 'generic', timestamp: undefined });
  });

  it('assigns a unique deliveryId nonce to every queued entry, including id-less ones', () => {
    const queue = new BrowserNotificationQueue();

    const first = queue.enqueue(makeNotification('n-1'));
    const second = queue.enqueue({ baseDir: '/a', title: 't', body: 'b', id: undefined });

    expect(first?.deliveryId).toBeTruthy();
    expect(second?.deliveryId).toBeTruthy();
    expect(first?.deliveryId).not.toBe(second?.deliveryId);
  });

  it("dedupes by `${baseDir}:${id}` across redeliveries while the entry is tracked", () => {
    const queue = new BrowserNotificationQueue();

    expect(queue.enqueue(makeNotification('n-1'))).not.toBeNull();
    expect(queue.enqueue(makeNotification('n-1'))).toBeNull();
    expect(queue.size).toBe(1);

    // Fetching (snapshotting) does not reset the dedupe tracking
    queue.snapshot();

    expect(queue.enqueue(makeNotification('n-1'))).toBeNull();
  });

  it('allows the same notification id for different baseDirs', () => {
    const queue = new BrowserNotificationQueue();

    expect(queue.enqueue(makeNotification('n-1', '/a'))).not.toBeNull();
    expect(queue.enqueue(makeNotification('n-1', '/b'))).not.toBeNull();
    expect(queue.size).toBe(2);
  });

  it('never dedupes notifications without an id', () => {
    const queue = new BrowserNotificationQueue();

    expect(queue.enqueue({ baseDir: '/a', title: 't', body: 'b', id: undefined })).not.toBeNull();
    expect(queue.enqueue({ baseDir: '/a', title: 't', body: 'b', id: undefined })).not.toBeNull();
    expect(queue.size).toBe(2);
  });

  it('drops the oldest entry when the queue overflows', () => {
    const queue = new BrowserNotificationQueue();

    for (let i = 0; i < MAX_QUEUED_NOTIFICATIONS + 5; i++) {
      queue.enqueue(makeNotification(`n-${i}`));
    }

    expect(queue.size).toBe(MAX_QUEUED_NOTIFICATIONS);
    const pending = queue.snapshot();
    expect(pending[0].id).toBe('n-5');
    expect(pending[pending.length - 1].id).toBe(`n-${MAX_QUEUED_NOTIFICATIONS + 4}`);
  });

  it('an overflow-dropped entry releases its dedupe key, so the same notification can be redispatched (LOW)', () => {
    const queue = new BrowserNotificationQueue();

    for (let i = 0; i < MAX_QUEUED_NOTIFICATIONS + 1; i++) {
      expect(queue.enqueue(makeNotification(`n-${i}`))).not.toBeNull();
    }

    expect(queue.size).toBe(MAX_QUEUED_NOTIFICATIONS);
    // 'n-0' was evicted FIFO: it is no longer queued...
    expect(queue.snapshot().map((n) => n.id)).not.toContain('n-0');

    // ...and its dedupe key was released with it, so a later genuine
    // redispatch of the same notification is accepted, not suppressed.
    const redispatched = queue.enqueue(makeNotification('n-0'));
    expect(redispatched).not.toBeNull();
    expect(redispatched?.id).toBe('n-0');
    expect(queue.size).toBe(MAX_QUEUED_NOTIFICATIONS);
  });

  it('a redispatch of the same notification is deduplicated while unacknowledged but allowed after ack (LOW-4)', () => {
    const queue = new BrowserNotificationQueue();

    const entry = queue.enqueue(makeNotification('n-1'));
    expect(entry).not.toBeNull();

    // While still queued (e.g. snapshot fetched, not yet played), a renderer
    // transport redelivery of the same notification must stay deduplicated.
    expect(queue.enqueue(makeNotification('n-1'))).toBeNull();

    // Once played + acknowledged, the dedupe key is released so a genuine
    // redispatch of the same notification chimes again.
    expect(queue.acknowledge([entry!.deliveryId])).toBe(1);
    expect(queue.enqueue(makeNotification('n-1'))).not.toBeNull();
    expect(queue.size).toBe(1);
  });

  describe('playback claims (MED-2)', () => {
    it('two concurrent consumers race for the same delivery — exactly one claims it', () => {
      const queue = new BrowserNotificationQueue();
      const entry = queue.enqueue(makeNotification('n-1'));
      const ids = [entry!.deliveryId];

      const now = Date.now();
      const first = queue.acquireClaims('tab-a', ids, now);
      const second = queue.acquireClaims('tab-b', ids, now);

      expect(first).toEqual(ids);
      expect(second).toEqual([]);
    });

    it('each delivery in a batch is claimed individually (partial wins)', () => {
      const queue = new BrowserNotificationQueue();
      queue.enqueue(makeNotification('n-1'));
      queue.enqueue(makeNotification('n-2'));
      const ids = queue.snapshot().map((n) => n.deliveryId);

      // Consumer A claims only the first delivery before B grabs the rest
      const aFirst = queue.acquireClaims('tab-a', ids.slice(0, 1));
      const bRest = queue.acquireClaims('tab-b', ids);

      expect(aFirst).toEqual([ids[0]]);
      expect(bRest).toEqual([ids[1]]);
      // A can only re-claim its own first delivery — the second is B's now
      expect(queue.acquireClaims('tab-a', ids)).toEqual([ids[0]]);
    });

    it('the same consumer re-claims its own fresh lease without consuming it', () => {
      const queue = new BrowserNotificationQueue();
      const entry = queue.enqueue(makeNotification('n-1'));
      const ids = [entry!.deliveryId];

      const now = Date.now();
      expect(queue.acquireClaims('tab-a', ids, now)).toEqual(ids);
      expect(queue.acquireClaims('tab-a', ids, now + 1000)).toEqual(ids);
    });

    it('re-claiming a still-fresh own claim preserves the lease expiry (no renewal, LOW)', () => {
      const queue = new BrowserNotificationQueue();
      const entry = queue.enqueue(makeNotification('n-1'));
      const ids = [entry!.deliveryId];

      const now = Date.now();
      expect(queue.acquireClaims('tab-a', ids, now)).toEqual(ids);

      // tab-a keeps re-claiming right up to (but before) the original expiry;
      // the result still reports the delivery as claimed...
      expect(queue.acquireClaims('tab-a', ids, now + CLAIM_LEASE_MS - 1)).toEqual(ids);

      // ...but the expiry was NOT renewed: one tick past the ORIGINAL lease
      // deadline, another consumer wins the delivery. (With renewal, the
      // deadline would have moved to now + CLAIM_LEASE_MS - 1 + CLAIM_LEASE_MS
      // and tab-b would be starved indefinitely.)
      expect(queue.acquireClaims('tab-b', ids, now + CLAIM_LEASE_MS + 1)).toEqual(ids);
    });

    it('duplicate delivery ids in one acquireClaims call yield a single claimed result (LOW)', () => {
      const queue = new BrowserNotificationQueue();
      const entry = queue.enqueue(makeNotification('n-1'));
      const id = entry!.deliveryId;

      expect(queue.acquireClaims('tab-a', [id, id, id])).toEqual([id]);
      // The duplicate input claimed the delivery exactly once — a second
      // consumer is still locked out by the single claim.
      expect(queue.acquireClaims('tab-b', [id])).toEqual([]);
    });

    it('expired leases of a dead consumer can be claimed by another consumer', () => {
      const queue = new BrowserNotificationQueue();
      const entry = queue.enqueue(makeNotification('n-1'));
      const ids = [entry!.deliveryId];

      expect(queue.acquireClaims('tab-a', ids)).toEqual(ids);
      // Within the lease the other consumer is locked out
      expect(queue.acquireClaims('tab-b', ids, Date.now() + CLAIM_LEASE_MS - 1)).toEqual([]);
      // After lease expiry (e.g. claiming tab died) tab-b wins the delivery
      expect(queue.acquireClaims('tab-b', ids, Date.now() + CLAIM_LEASE_MS + 1)).toEqual(ids);
    });

    it('ignores claims for unknown or already-acknowledged deliveries', () => {
      const queue = new BrowserNotificationQueue();
      const entry = queue.enqueue(makeNotification('n-1'));

      expect(queue.acquireClaims('tab-a', ['unknown'])).toEqual([]);

      queue.acknowledge([entry!.deliveryId]);
      expect(queue.acquireClaims('tab-a', [entry!.deliveryId])).toEqual([]);
      expect(queue.acquireClaims('tab-a', [], Date.now())).toEqual([]);
    });

    it('claiming is atomic for concurrent snapshots followed by claims', () => {
      const queue = new BrowserNotificationQueue();
      queue.enqueue(makeNotification('n-1'));

      // Both consumers snapshot the same non-destructive snapshot
      const s1 = queue.snapshot();
      const s2 = queue.snapshot();
      expect(s1.map((n) => n.deliveryId)).toEqual(s2.map((n) => n.deliveryId));

      const ids = s1.map((n) => n.deliveryId);
      expect(queue.acquireClaims('tab-a', ids)).toEqual(ids);
      expect(queue.acquireClaims('tab-b', ids)).toEqual([]);

      // Only the winner acknowledges; the queue is then empty for everyone
      expect(queue.acknowledge(ids)).toBe(1);
      expect(queue.snapshot()).toHaveLength(0);
    });
  });

  it('keeps dedupe tracking in sync with the queue cap: dropped entries release their keys, queued entries stay deduplicated (LOW overflow)', () => {
    const queue = new BrowserNotificationQueue();

    // Enqueue past the queue cap WITHOUT acknowledging: every entry FIFO
    // dropped by the queue cap (n-0..n-4) also released its dedupe key on
    // eviction, while entries still queued keep theirs.
    for (let i = 0; i < MAX_QUEUED_NOTIFICATIONS + 5; i++) {
      expect(queue.enqueue(makeNotification(`n-${i}`))).not.toBeNull();
    }

    expect(queue.size).toBe(MAX_QUEUED_NOTIFICATIONS);

    // The dropped-and-released notification is accepted on redispatch...
    expect(queue.enqueue(makeNotification('n-0'))).not.toBeNull();

    // ...but a notification that still holds a queue entry stays deduplicated
    // (renderer-transport redeliveries must not double-chime).
    expect(queue.enqueue(makeNotification('n-6'))).toBeNull();

    queue.acknowledge(queue.snapshot().map((n) => n.deliveryId));
    expect(queue.size).toBe(0);
  });

  describe('snapshot / acknowledge protocol', () => {
    it('keeps entries queued until they are acknowledged', () => {
      const queue = new BrowserNotificationQueue();
      queue.enqueue(makeNotification('n-1'));

      const first = queue.snapshot();
      expect(first).toHaveLength(1);

      // Snapshot must be non-destructive
      const second = queue.snapshot();
      expect(second).toHaveLength(1);
      expect(second).toEqual(first);
      expect(queue.size).toBe(1);

      // Acknowledging removes exactly the acknowledged entry
      expect(queue.acknowledge([first[0].deliveryId])).toBe(1);
      expect(queue.snapshot()).toHaveLength(0);
    });

    it('a non-playing consumer cannot steal a notification from a later consumer (HIGH-2)', () => {
      const queue = new BrowserNotificationQueue();
      queue.enqueue(makeNotification('n-1'));
      queue.enqueue(makeNotification('n-2'));

      // Consumer 1 (e.g. a hidden non-primary tab) fetches but never plays/acks
      const firstConsumer = queue.snapshot();
      expect(firstConsumer.map((n) => n.id)).toEqual(['n-1', 'n-2']);

      // Consumer 2 must still receive the same entries
      const secondConsumer = queue.snapshot();
      expect(secondConsumer.map((n) => n.id)).toEqual(['n-1', 'n-2']);

      // Consumer 1 finally plays and acknowledges — only then are they removed
      queue.acknowledge(firstConsumer.map((n) => n.deliveryId));
      expect(queue.snapshot()).toHaveLength(0);
    });

    it('only removes acknowledged entries, leaving unacked entries queued', () => {
      const queue = new BrowserNotificationQueue();
      const a = queue.enqueue(makeNotification('n-1'));
      const b = queue.enqueue(makeNotification('n-2'));
      const c = queue.enqueue(makeNotification('n-3'));

      expect(queue.acknowledge([b!.deliveryId])).toBe(1);
      expect(queue.snapshot().map((n) => n.id)).toEqual(['n-1', 'n-3']);
      expect(a).toBeDefined();
      expect(c).toBeDefined();
    });

    it('ignores unknown or duplicate deliveryIds when acknowledging', () => {
      const queue = new BrowserNotificationQueue();
      const entry = queue.enqueue(makeNotification('n-1'));

      expect(queue.acknowledge(['unknown-id'])).toBe(0);
      expect(queue.acknowledge([entry!.deliveryId])).toBe(1);
      expect(queue.acknowledge([entry!.deliveryId])).toBe(0);
      expect(queue.size).toBe(0);
    });

    it('returns copies from snapshot (mutating a snapshot does not affect the queue)', () => {
      const queue = new BrowserNotificationQueue();
      queue.enqueue(makeNotification('n-1'));

      const pending = queue.snapshot();
      pending[0].id = 'mutated';

      expect(queue.snapshot()[0].id).toBe('n-1');
    });

    it('a consumer cannot acknowledge a delivery actively claimed by another consumer (claim-ownership guard)', () => {
      const queue = new BrowserNotificationQueue();
      queue.enqueue(makeNotification('n-1'));
      const id = queue.snapshot()[0]!.deliveryId;

      // Consumer A legitimately claims the delivery for playback
      expect(queue.acquireClaims('tab-a', [id])).toEqual([id]);

      // Consumer B (never the claimant) acks the same delivery id — the entry
      // must stay queued so the legitimate claimant's notification is not
      // silently lost after its playback.
      expect(queue.acknowledge([id], 'tab-b')).toBe(0);
      expect(queue.snapshot().map((n) => n.deliveryId)).toEqual([id]);

      // Still locked out before the lease expires...
      expect(queue.acknowledge([id], 'tab-b')).toBe(0);
      expect(queue.snapshot()).toHaveLength(1);

      // ...but once the claim's lease has expired (claim not active anymore)
      // even a foreign consumer may remove the stale entry.
      expect(queue.acquireClaims('tab-b', [id], Date.now() + CLAIM_LEASE_MS + 1)).toEqual([id]);
      expect(queue.acknowledge([id], 'tab-b')).toBe(1);
      expect(queue.snapshot()).toHaveLength(0);
    });

    it('the claimant itself can still acknowledge its own claim (ownership guard keeps the happy path)', () => {
      const queue = new BrowserNotificationQueue();
      queue.enqueue(makeNotification('n-1'));
      const id = queue.snapshot()[0]!.deliveryId;

      expect(queue.acquireClaims('tab-a', [id])).toEqual([id]);
      expect(queue.acknowledge([id], 'tab-a')).toBe(1);
      expect(queue.snapshot()).toHaveLength(0);
    });

    it('unclaimed entries remain removable by any acknowledging consumer; legacy callers (no consumer id) keep the unconditional removal', () => {
      const queue = new BrowserNotificationQueue();
      const a = queue.enqueue(makeNotification('n-1'));
      const b = queue.enqueue(makeNotification('n-2'));

      // No claims were taken: an ack from any consumer removes the entry, and
      // a legacy single-array call (no consumer id) still removes all matches.
      expect(queue.acknowledge([a!.deliveryId], 'tab-x')).toBe(1);
      expect(queue.acknowledge([b!.deliveryId])).toBe(1);
      expect(queue.snapshot()).toHaveLength(0);
    });
  });
});
