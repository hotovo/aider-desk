import { createPortal } from 'react-dom';
import { useEffect, useState } from 'react';

import { FloatingPanel } from '@/components/common/FloatingPanel';
import { useExtensionComponentsWrapper } from '@/components/extensions/useExtensionComponentsWrapper';

type Props = {
  placement?: string;
  portalRootId?: string;
};

export const FloatingExtensionPanels = ({ placement = 'task-floating', portalRootId = 'floating-panels-root' }: Props) => {
  const { isEmpty, renderComponents, components } = useExtensionComponentsWrapper({
    placement,
  });

  const [portalRoot, setPortalRoot] = useState<HTMLElement | null>(() => document.getElementById(portalRootId));

  useEffect(() => {
    if (!portalRoot) {
      // eslint-disable-next-line react-hooks/set-state-in-effect -- portal target is external DOM, not available on first render
      setPortalRoot(document.getElementById(portalRootId));
    }
  }, [portalRoot, portalRootId]);

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
          storageKey={`${placement}-${comp.extensionId}-${comp.componentId}`}
        >
          {rendered[index]}
        </FloatingPanel>
      ))}
    </>,
    portalRoot,
  );
};
