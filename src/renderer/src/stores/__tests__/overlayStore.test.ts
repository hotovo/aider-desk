import { beforeEach, describe, expect, it } from 'vitest';

import { useOverlayStore } from '../overlayStore';

describe('overlayStore', () => {
  beforeEach(() => {
    useOverlayStore.setState({ openOverlays: new Set(), focusRequest: 0 });
  });

  it('requests focus when the last overlay closes', () => {
    const { openOverlay, closeOverlay } = useOverlayStore.getState();

    openOverlay('command-palette');
    closeOverlay('command-palette');

    const state = useOverlayStore.getState();
    expect(state.openOverlays.size).toBe(0);
    expect(state.focusRequest).toBe(1);
  });

  it('does not request focus while other overlays remain open', () => {
    const { openOverlay, closeOverlay } = useOverlayStore.getState();

    openOverlay('settings');
    openOverlay('command-palette');
    closeOverlay('command-palette');

    const state = useOverlayStore.getState();
    expect(state.openOverlays).toEqual(new Set(['settings']));
    expect(state.focusRequest).toBe(0);

    closeOverlay('settings');
    expect(useOverlayStore.getState().focusRequest).toBe(1);
  });

  it('ignores closing an overlay that was never opened', () => {
    const { closeOverlay } = useOverlayStore.getState();

    closeOverlay('unknown');

    expect(useOverlayStore.getState().focusRequest).toBe(0);
  });

  it('does not request focus when the same overlay is closed twice', () => {
    const { openOverlay, closeOverlay } = useOverlayStore.getState();

    openOverlay('settings');
    closeOverlay('settings');
    closeOverlay('settings');

    expect(useOverlayStore.getState().focusRequest).toBe(1);
  });
});
