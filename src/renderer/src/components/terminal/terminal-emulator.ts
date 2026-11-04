import { FitAddon, Ghostty, Terminal } from 'ghostty-web';

import type { ITerminalOptions } from 'ghostty-web';

export type TerminalEmulator = {
  terminal: Terminal;
  fitAddon: FitAddon;
};

let ghosttyLoadPromise: Promise<Ghostty> | null = null;

const loadGhostty = (): Promise<Ghostty> => {
  if (!ghosttyLoadPromise) {
    ghosttyLoadPromise = Ghostty.load().catch((error) => {
      ghosttyLoadPromise = null;
      throw error;
    });
  }
  return ghosttyLoadPromise;
};

export const createTerminalEmulator = async (
  parent: HTMLElement,
  options: Omit<ITerminalOptions, 'ghostty'>,
  signal: AbortSignal,
): Promise<TerminalEmulator | null> => {
  const ghostty = await loadGhostty();
  if (signal.aborted) {
    return null;
  }

  const terminal = new Terminal({ ...options, ghostty });
  try {
    const fitAddon = new FitAddon();
    terminal.loadAddon(fitAddon);
    terminal.open(parent);
    return { terminal, fitAddon };
  } catch (error) {
    terminal.dispose();
    throw error;
  }
};
