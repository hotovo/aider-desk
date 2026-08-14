import { useEffect, useRef } from 'react';

import { useOverlayStore } from '@/stores/overlayStore';

export const useOverlayRegistration = (id: string, isOpen: boolean) => {
  const openOverlay = useOverlayStore((state) => state.openOverlay);
  const closeOverlay = useOverlayStore((state) => state.closeOverlay);
  const previousIsOpen = useRef(isOpen);

  useEffect(() => {
    if (isOpen === previousIsOpen.current) {
      return;
    }
    previousIsOpen.current = isOpen;
    if (isOpen) {
      openOverlay(id);
    } else {
      closeOverlay(id);
    }
  }, [id, isOpen, openOverlay, closeOverlay]);
};

export const useOverlayFocusRestore = (focus: () => void, enabled: boolean) => {
  const focusRequest = useOverlayStore((state) => state.focusRequest);
  const previousRequest = useRef(focusRequest);

  useEffect(() => {
    if (focusRequest === previousRequest.current) {
      return;
    }
    previousRequest.current = focusRequest;
    if (enabled) {
      requestAnimationFrame(() => focus());
    }
  }, [focusRequest, enabled, focus]);
};
