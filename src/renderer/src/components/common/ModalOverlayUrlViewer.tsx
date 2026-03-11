import { useEffect, useRef } from 'react';

import { ModalOverlayLayout } from './ModalOverlayLayout';

import { useApi } from '@/contexts/ApiContext';

type Props = {
  url: string;
  onClose: () => void;
};

export const ModalOverlayUrlViewer = ({ url, onClose }: Props) => {
  const api = useApi();
  const webviewRef = useRef<HTMLElement>(null);
  const isWebViewSupported = api.isWebViewSupported();

  useEffect(() => {
    if (!isWebViewSupported) {
      return;
    }

    const webview = webviewRef.current;
    if (!webview) {
      return;
    }

    const handleClose = () => {
      onClose();
    };

    webview.addEventListener('close', handleClose);

    return () => {
      webview.removeEventListener('close', handleClose);
    };
  }, [isWebViewSupported, onClose]);

  return (
    <ModalOverlayLayout title="" onClose={onClose} closeOnEscape>
      {isWebViewSupported ? (
        <webview ref={webviewRef} src={url} className="flex-1 w-full h-full border-0" />
      ) : (
        <iframe src={url} className="flex-1 w-full h-full border-0" title="modal-overlay-iframe" />
      )}
    </ModalOverlayLayout>
  );
};
