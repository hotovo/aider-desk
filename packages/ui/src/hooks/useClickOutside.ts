import { useEffect, RefObject } from 'react';

type RefType =
  | RefObject<HTMLElement | null>
  | RefObject<HTMLDivElement | null>
  | RefObject<HTMLButtonElement | null>
  | RefObject<HTMLAnchorElement | null>
  | RefObject<HTMLInputElement | null>;

export const useClickOutside = (refs: RefType | RefType[], handler: (event: MouseEvent) => void) => {
  useEffect(() => {
    const listener = (event: MouseEvent) => {
      const target = event.target as Node;
      const refsArray = Array.isArray(refs) ? refs : [refs];

      // Check if the click is outside all provided refs
      const isOutside = refsArray.every((ref) => {
        // Ignore clicks on null refs or if the ref doesn't contain the target
        return !ref.current || !ref.current.contains(target);
      });

      if (isOutside) {
        handler(event);
      }
    };

    document.addEventListener('mousedown', listener);
    return () => {
      document.removeEventListener('mousedown', listener);
    };
  }, [refs, handler]);
};
