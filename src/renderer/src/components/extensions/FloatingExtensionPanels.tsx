import { createPortal } from 'react-dom';
import { useEffect, useState } from 'react';

import { FloatingPanel } from '@/components/common/FloatingPanel';
import { useExtensionComponentsWrapper } from '@/components/extensions/useExtensionComponentsWrapper';

const FLOATING_ROOT_ID = 'floating-panels-root';

export const FloatingExtensionPanels = () => {
  const { isEmpty, renderComponents, components } = useExtensionComponentsWrapper({
    placement: 'floating',
  });

  const [portalRoot, setPortalRoot] = useState<HTMLElement | null>(() => document.getElementById(FLOATING_ROOT_ID));

  useEffect(() => {
    if (!portalRoot) {
      // eslint-disable-next-line react-hooks/set-state-in-effect -- portal target is external DOM, not available on first render
      setPortalRoot(document.getElementById(FLOATING_ROOT_ID));
    }
  }, [portalRoot]);

  if (isEmpty || !portalRoot || !components) {
    return null;
  }

  const rendered = renderComponents();

  return createPortal(
    <>
      {components.map((comp, index) => (
        <FloatingPanel
          key={`${comp.extensionId}-${comp.componentId}`}
          title={comp.name ?? comp.componentId}
          storageKey={`${comp.extensionId}-${comp.componentId}`}
        >
          {rendered[index]}
        </FloatingPanel>
      ))}
    </>,
    portalRoot,
  );
};
