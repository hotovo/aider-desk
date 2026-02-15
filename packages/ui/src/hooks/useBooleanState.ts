import { useState, useCallback } from 'react';

export const useBooleanState = (initialState = false) => {
  const [value, setValue] = useState<boolean>(initialState);

  return [value, useCallback(() => setValue(true), []), useCallback(() => setValue(false), []), useCallback(() => setValue((prev) => !prev), [])] as const;
};
