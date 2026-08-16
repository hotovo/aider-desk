const actions = new Map<string, () => void>();

export const registerAction = (id: string, handler: () => void) => {
  actions.set(id, handler);
};

export const unregisterAction = (id: string) => {
  actions.delete(id);
};

/**
 * Invoke a registered UI action by id. Single entry point for all consumers:
 * command palette, extension system (future), toolbar buttons, hotkeys.
 * @returns true if the action was found and invoked, false otherwise
 */
export const invokeAction = (id: string): boolean => {
  const handler = actions.get(id);
  if (!handler) {
    // eslint-disable-next-line no-console
    console.warn(`Unknown UI action: ${id}`);
    return false;
  }
  handler();
  return true;
};
