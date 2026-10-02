(props) => {
  const { useState, useCallback, useRef } = React;
  const { ModalOverlayLayout, Tooltip } = props.ui;
  const { FiDatabase } = props.icons.Fi;
  const { executeExtensionAction } = props;
  const data = props.data || {};

  const [showModal, setShowModal] = useState(false);
  const everOpenedRef = useRef(false);

  const handleOpen = useCallback(() => {
    everOpenedRef.current = true;
    setShowModal(true);
  }, []);

  const handleClose = useCallback(() => {
    setShowModal(false);
  }, []);

  const handleStartContainer = useCallback(async () => {
    await executeExtensionAction('start-container');
  }, [executeExtensionAction]);

  const status = {
    containerState: 'idle',
    url: '',
    error: '',
    ...data,
  };

  const isReady = status.containerState === 'started' && status.url;
  const isStarting = status.containerState === 'starting';
  const isElectron = typeof navigator !== 'undefined' && navigator.userAgent.includes('Electron');

  const openLabel = isStarting ? 'DBX (starting container...)' : isReady ? 'DBX' : 'DBX (container not running — click to open)';

  const modalContent = (
    <div className="flex flex-col w-full h-full items-center justify-center">
      {isStarting ? (
        <div className="flex flex-col items-center gap-4">
          <FiDatabase className="h-10 w-10 text-text-muted animate-pulse" />
          <div className="text-sm text-text-secondary">Starting DBX container...</div>
          <div className="text-xs text-text-muted">This may take a while on first run (image download).</div>
        </div>
      ) : isReady ? (
        isElectron ? (
          <webview src={status.url} className="flex-1 w-full h-full border-0 rounded-lg" allowpopups partition="persist:dbx" />
        ) : (
          <iframe src={status.url} className="flex-1 w-full h-full border-0 rounded-lg" title="dbx" />
        )
      ) : (
        <div className="flex flex-col items-center gap-4">
          <FiDatabase className="h-10 w-10 text-text-muted" />
          <div className="text-sm text-text-secondary">DBX container is not running.</div>
          {status.error ? <div className="text-xs text-error max-w-xl text-center">{status.error}</div> : null}
          <button
            className="px-4 py-2 bg-bg-tertiary hover:bg-bg-tertiary-emphasis rounded-lg text-sm transition-colors cursor-pointer"
            onClick={handleStartContainer}
          >
            Start DBX container
          </button>
        </div>
      )}
    </div>
  );

  if (!everOpenedRef.current) {
    return (
      <Tooltip content={openLabel}>
        <button
          className={'px-4 py-2 hover:bg-bg-tertiary-emphasis transition-colors duration-200 cursor-pointer ' + (isStarting ? 'opacity-70' : '')}
          onClick={handleOpen}
        >
          <FiDatabase className={'h-5 w-5 text-text-secondary ' + (isStarting ? 'animate-pulse' : '')} />
        </button>
      </Tooltip>
    );
  }

  const modal = (
    <ModalOverlayLayout title="DBX Databases" onClose={handleClose} closeOnEscape={true}>
      {modalContent}
    </ModalOverlayLayout>
  );

  return (
    <>
      {/* Keep the modal mounted after the first open so the embedded DBX app
          preserves its state (opened tabs, query history, session) across open/close. */}
      <div className={showModal ? 'contents' : 'hidden'}>{modal}</div>
      <Tooltip content={openLabel}>
        <button
          className={'px-4 py-2 hover:bg-bg-tertiary-emphasis transition-colors duration-200 cursor-pointer ' + (isStarting ? 'opacity-70' : '')}
          onClick={handleOpen}
        >
          <FiDatabase className={'h-5 w-5 text-text-secondary ' + (isStarting ? 'animate-pulse' : '')} />
        </button>
      </Tooltip>
    </>
  );
};
