import { useCallback, useState } from 'react';

export interface DropdownStateOptions<T> {
  initialState: T;
  onCloseReset?: Partial<T>;
}

export const useDropdownState = <T extends Record<string, unknown>>({ initialState, onCloseReset }: DropdownStateOptions<T>) => {
  const [isOpen, setIsOpen] = useState(false);
  const [state, setState] = useState<T>(initialState);

  const open = useCallback((updates?: Partial<T>) => {
    if (updates) {
      setState((prev) => ({ ...prev, ...updates }));
    }
    setIsOpen(true);
  }, []);

  const close = useCallback(() => {
    if (onCloseReset) {
      setState((prev) => ({ ...prev, ...onCloseReset }));
    }
    setIsOpen(false);
  }, [onCloseReset]);

  const toggle = useCallback(() => {
    setIsOpen((prev) => !prev);
  }, []);

  const updateState = useCallback((updates: Partial<T> | ((prev: T) => T)) => {
    setState((prev) => {
      const newState = typeof updates === 'function' ? (updates as (prev: T) => T)(prev) : updates;
      return { ...prev, ...newState };
    });
  }, []);

  return {
    isOpen,
    state,
    setState,
    open,
    close,
    toggle,
    updateState,
  };
};
