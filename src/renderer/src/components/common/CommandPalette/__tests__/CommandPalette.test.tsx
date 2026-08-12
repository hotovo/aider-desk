import { act, fireEvent, render, screen } from '@testing-library/react';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { HotkeysProvider } from 'react-hotkeys-hook';

import { BaseDialog } from '../../BaseDialog';
import { CommandPalette } from '../CommandPalette';

import { useCommandPaletteHotkeys } from '@/hooks/useCommandPaletteHotkeys';
import { useCommandPaletteStore } from '@/stores/commandPaletteStore';

const CommandPaletteHotkeys = () => {
  useCommandPaletteHotkeys();
  return null;
};

describe('CommandPalette', () => {
  beforeEach(() => {
    localStorage.clear();
    useCommandPaletteStore.setState({
      isOpen: false,
      items: new Map(),
      recentlyUsed: [],
      itemIdsByScope: new Map(),
    });
  });

  it('closes only the palette when Escape is pressed above a dialog', () => {
    const onDialogClose = vi.fn();
    useCommandPaletteStore.getState().openPalette();

    render(
      <HotkeysProvider initiallyActiveScopes={['home', 'dialog']}>
        <BaseDialog title="Underlying dialog" onClose={onDialogClose}>
          <div>Dialog content</div>
        </BaseDialog>
        <CommandPalette />
      </HotkeysProvider>,
    );

    const event = new globalThis.KeyboardEvent('keydown', { key: 'Escape', code: 'Escape', bubbles: true, cancelable: true });
    act(() => screen.getByPlaceholderText('commandPalette.placeholder').dispatchEvent(event));

    expect(event.defaultPrevented).toBe(true);
    expect(screen.queryByPlaceholderText('commandPalette.placeholder')).not.toBeInTheDocument();
    expect(onDialogClose).not.toHaveBeenCalled();

    fireEvent.keyDown(document.body, { key: 'Escape', code: 'Escape' });

    expect(onDialogClose).toHaveBeenCalledOnce();
  });

  it('toggles the palette with the configured hotkey while form controls are focused', () => {
    render(
      <HotkeysProvider initiallyActiveScopes={['home']}>
        <CommandPaletteHotkeys />
        <CommandPalette />
      </HotkeysProvider>,
    );

    fireEvent.keyDown(document.body, { key: 'p', code: 'KeyP', ctrlKey: true, shiftKey: true });

    const input = screen.getByPlaceholderText('commandPalette.placeholder');
    expect(input).toBeInTheDocument();

    fireEvent.keyUp(input, { key: 'p', code: 'KeyP', ctrlKey: true, shiftKey: true });
    fireEvent.keyDown(input, { key: 'p', code: 'KeyP', ctrlKey: true, shiftKey: true });

    expect(screen.queryByPlaceholderText('commandPalette.placeholder')).not.toBeInTheDocument();
  });
});
