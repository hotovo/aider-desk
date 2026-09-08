import { createRequire } from 'module';
import { readFileSync } from 'fs';
import { resolve } from 'path';

import { render } from '@testing-library/react';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { transpileJsxString } from '@common/jsx-transpiler';

import type { ReactNode } from 'react';

// Regression tests for the sound-notification SoundRemotePanel.jsx playback/ack
// tail (LOW-2): the async playback effect must never surface an unhandled
// rejection, even when the main-process UI-action RPCs fail after a successful
// claim round-trip. The panel ships as a raw JSX string, so these tests load
// and execute the real production component with the same transpiler the
// renderer uses (sucrase via transpileJsxString) and assert that no
// 'unhandledRejection' is ever raised for the panel's async work.

const PANEL_PATH = resolve(process.cwd(), 'packages/extensions/extensions/sound-notification/SoundRemotePanel.jsx');

const flushAsync = async (): Promise<void> => {
  await new Promise<void>((r) => setTimeout(r, 20));
  await new Promise<void>((r) => setTimeout(r, 20));
};

type RuntimeShape = {
  audioCtx: unknown;
  armed: boolean;
  tabId: string | null;
  playedIds: Record<string, boolean>;
  playedInFlight: Record<string, boolean>;
  missedCounted: Record<string, boolean>;
};

const makeAudioContext = () => ({
  state: 'running',
  currentTime: 0,
  destination: {},
  createOscillator: () => ({
    type: '',
    frequency: { value: 0 },
    connect: () => ({ connect: () => undefined }),
    start: vi.fn(),
    stop: vi.fn(),
  }),
  createGain: () => ({
    connect: () => ({ connect: () => undefined }),
    gain: { setValueAtTime: vi.fn(), exponentialRampToValueAtTime: vi.fn() },
  }),
});

/** Runs the real SoundRemotePanel.jsx string in a minimal CJS sandbox and returns the mountable component. */
const loadPanelComponent = (): ((props: Record<string, unknown>) => ReactNode) => {
  const jsx = readFileSync(PANEL_PATH, 'utf-8');
  // The 'imports' transform yields plain CommonJS, so the string can be
  // executed in-process without the blob-URL dynamic import the production
  // renderer wrapper uses (not supported under jsdom).
  const cjs = transpileJsxString(jsx, { transforms: ['jsx', 'typescript', 'imports'], production: false });
  const moduleShim = { exports: {} as Record<string, unknown> };
  const nodeRequire = createRequire(import.meta.url);
  const requireShim = (name: string) => {
    // The generated interop expects a module record with a `default` export;
    // returning the CJS React build lets _interopRequireDefault produce it.
    if (name === 'react') {
      return nodeRequire('react');
    }
    throw new Error(`SoundRemotePanel test: unexpected require(${name})`);
  };

  new Function('exports', 'require', 'module', cjs)(moduleShim.exports, requireShim, moduleShim);
  // Under the 'imports' transform, exports.default is the panel component
  // directly (its React reference is bound by the transpiled import shim),
  // whereas the production path injects React via a factory parameter.
  return moduleShim.exports['default'] as unknown as (props: Record<string, unknown>) => ReactNode;
};

describe('SoundRemotePanel.jsx playback/ack tail (LOW-2 unhandled-rejection guards)', () => {
  const originalElectron = (window as unknown as Record<string, unknown>).electron;

  beforeEach(() => {
    // The suite-level setup mocks a truthy window.electron (desktop app);
    // the panel only renders/plays browser chimes in non-Electron tabs.
    (window as unknown as Record<string, unknown>).electron = undefined;
    // Reset the cross-test primary-tab election lock so a lock written by one
    // test does not mute another test's playback effect for 30s.
    window.localStorage.removeItem('aiderdesk-sound-notification-primary');
    delete (window as unknown as { __aiderdeskSoundNotification?: unknown }).__aiderdeskSoundNotification;
  });

  afterEach(() => {
    (window as unknown as Record<string, unknown>).electron = originalElectron;
    delete (window as unknown as { __aiderdeskSoundNotification?: unknown }).__aiderdeskSoundNotification;
  });

  it('transpiles from the real SoundRemotePanel.jsx and mounts', () => {
    const Panel = loadPanelComponent();
    const { container } = render(<Panel data={{}} />);
    expect(container.textContent).toContain('Sounds not enabled in this tab');
  });

  describe('playback effect rejection guards', () => {
    let onUnhandled: (err: unknown, promise: Promise<unknown>) => void;

    beforeEach(() => {
      onUnhandled = vi.fn();
      process.on('unhandledRejection', onUnhandled);
      const runtime: RuntimeShape = {
        audioCtx: makeAudioContext(),
        armed: true,
        tabId: null,
        playedIds: {},
        playedInFlight: {},
        missedCounted: {},
      };
      (window as unknown as { __aiderdeskSoundNotification?: RuntimeShape }).__aiderdeskSoundNotification = runtime;
    });

    afterEach(() => {
      process.off('unhandledRejection', onUnhandled);
      delete (window as unknown as { __aiderdeskSoundNotification?: RuntimeShape }).__aiderdeskSoundNotification;
    });

    it('swallows a failing acknowledge-played RPC (never an unhandled rejection)', async () => {
      let rejectAck!: (err: unknown) => void;
      const ackPromise = new Promise<never>((_, reject) => {
        rejectAck = reject;
      });
      // Deliberately recorded via a plain closure, not vi.fn: vitest's mock
      // wrapper attaches internal promise handlers, which would mark the RPC
      // promise as "handled" and mask the very defect this test hunts for.
      const calls: Array<[string, unknown[]]> = [];
      // Mirrors the production wrapper in ExtensionComponentRenderer.tsx:
      // (action, ...args) => executeUIExtensionAction(..., action, args, ...).
      const executeExtensionAction = async (action: string, ...args: unknown[]) => {
        calls.push([action, args]);
        if (action === 'acquire-claims') {
          // Honors the wire shape: args = [consumerId, deliveryIds]; claims
          // exactly the requested deliveries instead of ignoring the args.
          const [, deliveryIds] = args as [string, string[]];
          return { claimed: deliveryIds };
        }
        return ackPromise;
      };

      const Panel = loadPanelComponent();
      render(
        <Panel data={{ pending: [{ deliveryId: 'd1', kind: 'task-finished' }], sounds: { volume: 0.5 } }} executeExtensionAction={executeExtensionAction} />,
      );

      await vi.waitFor(() => expect(calls.some(([action]) => action === 'acknowledge-played')).toBe(true));
      // Deliberately NOT wrapped in act(): React 19's act intercepts
      // unhandledRejection raised inside it, which would mask the very defect
      // this regression test hunts for in production (outside act).
      rejectAck(new Error('ack transport failed'));
      await flushAsync();

      expect(onUnhandled).not.toHaveBeenCalled();
    });

    it('re-runs the playback effect when an identical snapshot arrives with a fresh nonce (HIGH-1 replay path)', async () => {
      const calls: Array<[string, unknown[]]> = [];
      const executeExtensionAction = async (action: string, ...args: unknown[]) => {
        calls.push([action, args]);
        if (action === 'acquire-claims') {
          const [, deliveryIds] = args as [string, string[]];
          return { claimed: deliveryIds };
        }
        return { acknowledged: true };
      };

      const makeData = (nonce: number) => ({
        pending: [{ deliveryId: 'd-nonce', kind: 'task-finished' }],
        sounds: { volume: 0.5 },
        refreshNonce: nonce,
      });

      const Panel = loadPanelComponent();
      const { rerender } = render(<Panel data={makeData(1)} executeExtensionAction={executeExtensionAction} />);

      await vi.waitFor(() => expect(calls.filter(([action]) => action === 'acquire-claims')).toHaveLength(1));

      // Identical pending/sounds snapshot with a fresh refreshNonce (what
      // getUIExtensionData now emits on every refresh): the store's
      // JSON-equality cache passes it through, the panel's playback effect
      // re-runs — e.g. re-offering items queued while the tab was hidden, or
      // after the user enables sounds.
      rerender(<Panel data={makeData(2)} executeExtensionAction={executeExtensionAction} />);

      await vi.waitFor(() => expect(calls.filter(([action]) => action === 'acquire-claims')).toHaveLength(2));
      expect(calls.some(([action]) => action === 'acknowledge-played')).toBe(true);
      expect(onUnhandled).not.toHaveBeenCalled();
    });

    it('swallows a failing acquire-claims RPC (plays nothing, never an unhandled rejection)', async () => {
      const calls: Array<[string, unknown[]]> = [];
      // Mirrors the production wrapper in ExtensionComponentRenderer.tsx:
      // (action, ...args) => executeUIExtensionAction(..., action, args, ...).
      const executeExtensionAction = async (action: string, ...args: unknown[]) => {
        calls.push([action, args]);
        if (action === 'acquire-claims') {
          throw new Error('claim RPC failed');
        }
        return { acknowledged: true };
      };

      const Panel = loadPanelComponent();
      render(
        <Panel data={{ pending: [{ deliveryId: 'd2', kind: 'task-finished' }], sounds: { volume: 0.5 } }} executeExtensionAction={executeExtensionAction} />,
      );

      await vi.waitFor(() => expect(calls.some(([action]) => action === 'acquire-claims')).toBe(true));
      await flushAsync();

      expect(calls.some(([action]) => action === 'acknowledge-played')).toBe(false);
      expect(onUnhandled).not.toHaveBeenCalled();
    });

    it('does not acknowledge when the audio context is suspended between the claim and playback (delivery stays queued)', async () => {
      const calls: Array<[string, unknown[]]> = [];
      // The runtime's audio context (wired up by the describe's beforeEach) —
      // its state is mutated inside the claim handler below to simulate the
      // context being suspended/interrupted while the claim RPC was in flight.
      const runtime = (window as unknown as { __aiderdeskSoundNotification?: RuntimeShape }).__aiderdeskSoundNotification as RuntimeShape;
      const audioCtx = runtime.audioCtx as { state: string };

      // Mirrors the production wrapper in ExtensionComponentRenderer.tsx:
      // (action, ...args) => executeUIExtensionAction(..., action, args, ...).
      const executeExtensionAction = async (action: string, ...args: unknown[]) => {
        calls.push([action, args]);
        if (action === 'acquire-claims') {
          const [, deliveryIds] = args as [string, string[]];
          // Claim completed on the main side — but the audio context was
          // interrupted (mobile lock screen / iOS audio interruption) while
          // the RPC was in flight. playChime will no-op; the panel must NOT
          // ack the delivery away — it stays queued for lease expiry + retry.
          audioCtx.state = 'suspended';
          return { claimed: deliveryIds };
        }
        return { acknowledged: true };
      };

      const Panel = loadPanelComponent();
      render(
        <Panel
          data={{ pending: [{ deliveryId: 'd-suspended', kind: 'task-finished' }], sounds: { volume: 0.5 } }}
          executeExtensionAction={executeExtensionAction}
        />,
      );

      await vi.waitFor(() => expect(calls.some(([action]) => action === 'acquire-claims')).toBe(true));
      await flushAsync();

      // No acknowledgement may be sent: the claim was made, but the chime was
      // not playable, so the delivery must remain queued (not removed/lost).
      expect(calls.some(([action]) => action === 'acknowledge-played')).toBe(false);
      expect(onUnhandled).not.toHaveBeenCalled();
    });
  });
});
