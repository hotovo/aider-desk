({ config, updateConfig, executeExtensionAction, ui }) => {
  const { useEffect } = React;
  const { Button } = ui;

  const handleAction = async (action) => {
    const result = await executeExtensionAction(action);
    if (result) {
      updateConfig(result);
    }
  };

  const isPending = !!config?.pendingFlow;
  const lastError = config?.lastError;

  useEffect(() => {
    if (!isPending) {
      return undefined;
    }
    const interval = setInterval(async () => {
      try {
        const state = await executeExtensionAction('getAuthState');
        if (state) {
          updateConfig(state);
        }
      } catch {
        // dialog still open while main process may be busy — retry on next tick
      }
    }, 3000);
    return () => clearInterval(interval);
  }, [isPending, executeExtensionAction, updateConfig]);

  const deviceCode = config?.pendingFlow?.userCode;

  return (
    <div className="flex flex-col gap-4 text-sm">
      {config?.status === 'signed-in' && (
        <div className="flex flex-col gap-4">
          <div className="flex items-center gap-2">
            <span className="text-green-500">&#10003;</span>
            <span>
              Signed in as{' '}
              <span className="font-medium">{config?.email ? config.email : config?.accountId ? `account ${config.accountId.slice(0, 8)}…` : 'ChatGPT account'}</span>
            </span>
          </div>
          <Button variant="outline" onClick={() => handleAction('signOut')} disabled={isPending} className="w-full">
            Sign out
          </Button>
        </div>
      )}

      {config?.status === 'expired' && !isPending && <div className="text-yellow-500">Session expired — sign in again to refresh it.</div>}

      {!isPending && config?.status !== 'signed-in' && (
        <div className="flex flex-col gap-3">
          <p className="text-text-secondary">Sign in with your ChatGPT Plus/Pro account. No API key required.</p>

          <div className="flex items-center gap-2">
            <Button onClick={() => handleAction('signInBrowser')} disabled={isPending}>
              Sign in with Browser
            </Button>
            <Button variant="outline" onClick={() => handleAction('signInDeviceCode')} disabled={isPending}>
              Sign in with Device Code
            </Button>
          </div>
          <p className="text-xs text-text-secondary">
            Use <span className="font-medium">Device Code</span> when your browser runs on a different machine than AiderDesk (e.g. remote or headless
            server). Device code sign-in must be enabled in your ChatGPT security settings.
          </p>
        </div>
      )}

      {lastError && (
        <div className="rounded-lg border border-red-500/40 p-3 text-red-500">
          {lastError}
          {!isPending && <div className="mt-1 text-xs text-text-secondary">State has been reset — you can retry sign-in above.</div>}
        </div>
      )}

      {isPending && (
        <div className="flex flex-col gap-3 rounded-lg border border-border-primary p-4">
          {config.pendingFlow?.type === 'device' && deviceCode ? (
            <>
              <p>1. Open the sign-in page in any browser:</p>
              <a href={config.pendingFlow?.verificationUrl} target="_blank" rel="noopener noreferrer" className="text-left text-blue-500 underline">
                {config.pendingFlow?.verificationUrl}
              </a>
              <p>2. Enter this one-time code:</p>
              <div className="rounded bg-bg-tertiary px-4 py-2 font-mono text-xl tracking-widest">{deviceCode}</div>
              <p className="text-xs text-text-secondary">Waiting for approval… this expires in 15 minutes.</p>
            </>
          ) : config.pendingFlow.type === 'device' ? (
            <p>Waiting for the device code…</p>
          ) : (
            <p>Waiting for sign-in to complete in your browser…</p>
          )}
          <Button variant="outline" size="sm" className="self-start" onClick={() => handleAction('cancelSignIn')}>
            Cancel
          </Button>
        </div>
      )}
    </div>
  );
}
