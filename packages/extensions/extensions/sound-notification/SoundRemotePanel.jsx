(props) => {
  const { data, ui, executeExtensionAction } = props;
  const { useState, useEffect, useCallback, useRef } = React;

  const Button = ui?.Button;

  const LOCK_KEY = 'aiderdesk-sound-notification-primary';
  const LOCK_TTL_MS = 30 * 1000;
  const LOCK_HEARTBEAT_MS = 20 * 1000;
  // Cap for the per-window dedupe stores (delivery ids already played / already
  // counted as missed). FIFO eviction keeps the runtime object bounded.
  const MAX_TRACKED_KEYS = 200;

  /** FIFO-evict the oldest entries of a keyed store once it exceeds `cap`. */
  const evictOldestKeys = (store, cap) => {
    const keys = Object.keys(store);
    if (keys.length > cap) {
      keys.slice(0, keys.length - cap).forEach((key) => {
        delete store[key];
      });
    }
  };

  const PRESETS = {
    bell: [[880, 0], [1318.51, 0.18]],
    ding: [[1244.51, 0]],
    chime: [[523.25, 0], [659.25, 0.12], [783.99, 0.24]],
    soft: [[440, 0]],
  };

  const win = typeof window !== 'undefined' ? (window as any) : undefined;
  const isElectron = !!win?.electron;

  const runtime =
    win
      ? (win.__aiderdeskSoundNotification = win.__aiderdeskSoundNotification || {
          audioCtx: null,
          armed: false,
          tabId: null,
          playedIds: {},
          playedInFlight: {},
          missedCounted: {},
        })
      : { audioCtx: null, armed: false, tabId: null, playedIds: {}, playedInFlight: {}, missedCounted: {} };

  const [armed, setArmed] = useState(() => runtime.armed === true);
  const [unlockFailed, setUnlockFailed] = useState(false);
  const [missedCount, setMissedCount] = useState(0);

  const audioCtxRef = useRef(null);

  const readLock = useCallback(() => {
    try {
      const raw = window.localStorage.getItem(LOCK_KEY);
      return raw ? JSON.parse(raw) : null;
    } catch {
      return null;
    }
  }, []);

  // Stable per-window id, used both for the primary-tab election and as the
  // playback-claim consumer id against the main process (MED-2).
  const ensureTabId = useCallback(() => {
    if (!runtime.tabId) {
      runtime.tabId = 'tab-' + Date.now().toString(36) + '-' + Math.random().toString(36).slice(2, 8);
    }
    return runtime.tabId;
  }, []);

  // Primary-tab election: only one visible tab per browser profile chimes.
  // On unlock-and-refresh this visible tab takes/keeps an if-fresh lock.

  // Ask the main process to re-emit the pending-notification snapshot (MED-1):
  // after (re)arming, or when this armed tab becomes visible again, the
  // queued-but-unacknowledged notifications must be re-offered so they play.
  const requestRefresh = useCallback(() => {
    if (typeof executeExtensionAction !== 'function') return;
    executeExtensionAction('request-refresh', [])
      .catch(() => undefined);
  }, [executeExtensionAction]);

  const acquirePrimary = useCallback(() => {
    if (isElectron) return false;

    const now = Date.now();
    const lock = readLock();
    if (lock && lock.tabId !== runtime.tabId && now - lock.ts < LOCK_TTL_MS) {
      return false;
    }
    if (!runtime.tabId) {
      runtime.tabId = ensureTabId();
    }
    try {
      window.localStorage.setItem(LOCK_KEY, JSON.stringify({ tabId: runtime.tabId, ts: now }));
    } catch {
      // localStorage unavailable; fall back to playing without tab election
      return true;
    }
    // Re-read to verify we won the write race: another tab may have replaced
    // our lock between our read and write, in which case it is the primary.
    const written = readLock();
    if (!written || written.tabId !== runtime.tabId) {
      return false;
    }
    return true;
  }, [isElectron, readLock, ensureTabId]);

  const playChime = useCallback((ctx, preset, volume) => {
    if (!ctx || ctx.state !== 'running') return;
    const notes = PRESETS[preset];
    if (!notes) return;

    const now = ctx.currentTime;
    const duration = preset === 'ding' ? 0.45 : preset === 'soft' ? 1.1 : 0.9;
    notes.forEach((note, index) => {
      const osc = ctx.createOscillator();
      const gain = ctx.createGain();
      osc.type = preset === 'soft' ? 'triangle' : 'sine';
      osc.frequency.value = note[0];

      const start = now + (note[1] || 0);
      const peak = Math.max(0.01, volume * (preset === 'soft' ? 0.6 : 1) * (index === 0 ? 1 : 0.8));
      gain.gain.setValueAtTime(0.0001, start);
      gain.gain.exponentialRampToValueAtTime(peak, start + 0.02);
      gain.gain.exponentialRampToValueAtTime(0.0001, start + duration);

      osc.connect(gain).connect(ctx.destination);
      osc.start(start);
      osc.stop(start + duration + 0.05);
    });
  }, []);

  // Unlock strictly inside the user gesture — never on page load.
  const handleEnable = useCallback(async () => {
    if (isElectron) return;
    const AudioCtx = win?.AudioContext || win?.webkitAudioContext;
    if (!AudioCtx) return;

    let ctx = runtime.audioCtx;
    if (!ctx || ctx.state === 'closed') {
      ctx = new AudioCtx();
      runtime.audioCtx = ctx;
    }
    audioCtxRef.current = ctx;
    if (ctx.state === 'suspended') {
      try {
        await ctx.resume();
      } catch {
        // Resume may reject (browser still blocking audio) — fall through to
        // the state check below instead of arming an unusable context.
      }
    }
    // Only arm the tab and take the primary lock when the context is actually
    // runnable — otherwise this tab would monopolize the primary election
    // while being unable to play anything. Show an unlock-failure state and
    // keep the tab unarmed so another tab can take over.
    if (ctx.state !== 'running') {
      setUnlockFailed(true);
      return;
    }
    setUnlockFailed(false);
    runtime.armed = true;
    setArmed(true);
    acquirePrimary();
    // MED-1: this tab just became able to play — pull the pending snapshot so
    // notifications queued while the tab was unarmed are re-offered and play.
    requestRefresh();
    // Short confirmation tick so the user hears the unlock worked
    playChime(ctx, 'ding', 0.3);
  }, [isElectron, acquirePrimary, requestRefresh, playChime]);

  // Playback effect: runs whenever fresh `data` arrives (refresh triggered via
  // 'request-refresh' after each queued onNotification, after arming, and on
  // visibility regain — MED-1). Delivery is a snapshot / claim / acknowledge
  // protocol: entries stay queued in the main process; before playing, this
  // tab claims them via 'acquire-claims' (exactly one consumer wins each —
  // MED-2) and only claims are played and acknowledged via
  // 'acknowledge-played'. A tab that cannot play (hidden, not primary, audio
  // locked, claim lost) neither plays nor acknowledges, leaving the items
  // queued for the tab that can.
  useEffect(() => {
    const pending = data?.pending;
    if (!Array.isArray(pending) || pending.length === 0) return;

    const ctx = runtime.audioCtx || audioCtxRef.current;
    const sounds = data?.sounds || {};

    const notPlayable =
      isElectron || !ctx || ctx.state !== 'running' || document.visibilityState !== 'visible';
    if (notPlayable) {
      // Only count each delivery once — unacknowledged snapshots are re-sent on
      // every refresh until some tab plays them.
      const missed = pending.filter((item) => !item.deliveryId || !runtime.missedCounted[item.deliveryId]);
      missed.forEach((item) => {
        if (item.deliveryId) runtime.missedCounted[item.deliveryId] = true;
      });
      evictOldestKeys(runtime.missedCounted, MAX_TRACKED_KEYS);
      if (missed.length > 0) {
        setMissedCount((count) => count + missed.length);
      }
      return;
    }
    if (!acquirePrimary()) {
      return;
    }

    let cancelled = false;

    const playPending = async () => {
      // MED-2: claim the snapshot's deliveries atomically on the main side
      // before playing. Exactly one consumer wins each delivery; whenever this
      // tab loses the claim (another tab/device got it first) the entry is
      // neither played nor acknowledged here.
      const candidateIds = pending.map((item) => item.deliveryId).filter(Boolean);
      let claimedIds = [];
      if (candidateIds.length > 0 && typeof executeExtensionAction === 'function') {
        try {
          // Wire shape: the production wrapper forwards rest args as an array
          // (ExtensionComponentRenderer.tsx: (action, ...args) => args), and the
          // extension parses (args ?? []) as [consumerId, deliveryIds] — so the
          // tab id and candidate ids must be passed as TWO separate arguments,
          // not one nested array.
          const result = await executeExtensionAction('acquire-claims', ensureTabId(), candidateIds);
          if (result && Array.isArray(result.claimed)) {
            claimedIds = result.claimed;
          }
        } catch {
          // Claim RPC failed — play nothing: an unclaimed delivery stays queued
          // and will be re-offered on the next refresh instead of double-chiming.
          return;
        }
      }
      if (cancelled) return;
      const claimed = new Set(claimedIds);

      // LOW-2: guard the whole playback+ack tail — a throw from playChime (or
      // anything else below) must neither escape this async function as an
      // unhandled rejection nor leave in-flight guards stuck forever.
      const ackIds = [];
      try {
        for (const item of pending) {
          if (!item.deliveryId || !claimed.has(item.deliveryId)) continue;
          // Guard against concurrent playback of the same delivery within this
          // window (e.g. two rapid data refreshes with a claim round-trip in
          // between — the claims would both succeed for the same consumer id).
          if (runtime.playedInFlight[item.deliveryId]) continue;
          runtime.playedInFlight[item.deliveryId] = true;

          // Dedupe on the per-queue-entry nonce: entries already played in this
          // window are re-acked (so the main process drops them) but not replayed.
          const dedupeKey = item.deliveryId;
          if (runtime.playedIds[dedupeKey]) {
            delete runtime.playedInFlight[item.deliveryId];
            ackIds.push(item.deliveryId);
            continue;
          }
          const presets = sounds.presets || {};
          const preset = presets[item.kind || 'generic'] || 'chime';
          const volume = typeof sounds.volume === 'number' ? sounds.volume : 0.5;
          playChime(ctx, preset, volume);

          // The audio context can be suspended/interrupted (mobile lock
          // screen, iOS audio interruption) between the effect's pre-claim
          // 'running' check and this playback — playChime then returns
          // without having played anything. Confirm the context is STILL
          // running before removing the delivery: an unplayable chime must
          // stay queued (its claim lease expires and a retry plays it)
          // instead of being silently acked away (delivery loss). Stop the
          // loop entirely — every remaining item would hit the same dead
          // context.
          if (!ctx || ctx.state !== 'running') {
            delete runtime.playedInFlight[item.deliveryId];
            break;
          }

          // Only NOW is the playback considered successful: mark the dedupe
          // pointer and collect the id for acknowledgement (with the same
          // consumer id the claim was made with, so the main process only
          // drops entries this tab actually owns the claim of).
          runtime.playedIds[dedupeKey] = true;
          ackIds.push(item.deliveryId);
        }

        if (ackIds.length > 0 && typeof executeExtensionAction === 'function') {
          // LOW-2: never surface an unhandled rejection from the ack RPC.
          // The consumer id (same tab id the claims were acquired with) lets
          // the main process refuse to remove entries whose playback claim is
          // still actively held by a different consumer.
          executeExtensionAction('acknowledge-played', ackIds, ensureTabId()).catch(() => undefined);
          // Release the in-flight guard after the ack has surely been processed,
          // so a still-queued retry of the same delivery can play again.
          window.setTimeout(() => {
            ackIds.forEach((id) => {
              delete runtime.playedInFlight[id];
            });
          }, 2000);
        }
      } finally {
        // Deliveries that never reached the ack list (e.g. playChime threw
        // mid-loop) got no deferred release scheduled — drop their guard
        // immediately so the next refresh can retry them instead of
        // dead-locking on the flag. Successfully played ids keep the 2s
        // deferred release above.
        for (const id of claimed) {
          if (!ackIds.includes(id)) {
            delete runtime.playedInFlight[id];
          }
        }
      }
    };

    // LOW-2: never surface an unhandled rejection from the playback tail.
    void playPending().catch(() => undefined);
    evictOldestKeys(runtime.playedIds, MAX_TRACKED_KEYS);

    return () => {
      cancelled = true;
    };
  }, [data, isElectron, acquirePrimary, playChime, executeExtensionAction, ensureTabId]);

  // Keep the primary-tab lock fresh while armed and visible.
  useEffect(() => {
    if (!armed || isElectron) return undefined;

    const heartbeat = window.setInterval(() => {
      if (document.visibilityState === 'visible') {
        acquirePrimary();
      }
    }, LOCK_HEARTBEAT_MS);

    const onVisibilityChange = () => {
      if (document.visibilityState === 'visible') {
        acquirePrimary();
        // MED-1: an armed tab that regained visibility becomes able to play
        // again — pull the pending snapshot so items it missed while hidden
        // are re-offered and acknowledged/played by the new primary.
        requestRefresh();
      }
    };
    document.addEventListener('visibilitychange', onVisibilityChange);

    return () => {
      window.clearInterval(heartbeat);
      document.removeEventListener('visibilitychange', onVisibilityChange);
    };
  }, [armed, isElectron, acquirePrimary, requestRefresh]);

  // Desktop Electron app plays sounds locally via the OS player — never chime here.
  if (isElectron) {
    return null;
  }

  const handleTest = () => {
    const ctx = runtime.audioCtx || audioCtxRef.current;
    if (!ctx || ctx.state !== 'running') return;
    const sounds = data?.sounds || {};
    const presets = sounds.presets || {};
    playChime(ctx, presets['task-finished'] || 'bell', typeof sounds.volume === 'number' ? sounds.volume : 0.5);
  };

  return (
    <div className="flex flex-col gap-2 text-xs text-text-secondary">
      <div className="flex items-center gap-2">
        <span className={'w-2 h-2 rounded-full ' + (armed ? 'bg-success' : 'bg-text-muted')} />
        <span className="font-medium text-text-primary">
          {armed ? 'Sounds enabled in this tab' : 'Sounds not enabled in this tab'}
        </span>
      </div>

      {unlockFailed && !armed && (
        <div className="text-warning">
          The browser blocked audio playback. Click the button again to try
          unlocking sounds.
        </div>
      )}

      {!armed && (
        <div>
          {Button ? (
            <Button variant="contained" color="primary" size="xs" onClick={handleEnable}>
              Enable sounds in this browser
            </Button>
          ) : (
            <button className="px-2 py-1 text-xs border border-border-default rounded" onClick={handleEnable}>
              Enable sounds in this browser
            </button>
          )}
        </div>
      )}

      {armed && (
        <div className="flex items-center gap-2">
          {Button ? (
            <Button variant="outline" size="xs" onClick={handleTest}>
              Test sound
            </Button>
          ) : (
            <button className="px-2 py-1 text-xs border border-border-default rounded" onClick={handleTest}>
              Test sound
            </button>
          )}
        </div>
      )}

      {missedCount > 0 && (
        <div className="text-text-muted">
          {missedCount} notification sound{missedCount === 1 ? '' : 's'} missed (tab hidden or sound not yet enabled)
        </div>
      )}

      <div className="text-text-muted">
        Sounds play from this tab while it stays open. Adjust delivery, volume and per-kind
        sounds in Settings → Extensions → Sound Notification.
      </div>
    </div>
  );
};
