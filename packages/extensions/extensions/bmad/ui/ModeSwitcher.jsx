(props) => {
  const { executeExtensionAction, icons } = props;
  const { useState } = React;

  const [switching, setSwitching] = useState(false);
  const [error, setError] = useState(null);

  const FiLayers = icons.Fi.FiLayers;
  const FiAlertTriangle = icons.Fi.FiAlertTriangle;
  const CgSpinner = icons.Cg.CgSpinner;

  const handleSwitch = async () => {
    setSwitching(true);
    setError(null);
    try {
      const result = await executeExtensionAction('switch-to-bmad');
      if (result && !result.success) {
        setError(result.error || 'Mode switch failed');
        setSwitching(false);
      }
      // On success keep the busy state: the mode change reloads the
      // component set and the BMAD welcome page replaces this switcher.
    } catch (err) {
      setError(err instanceof Error ? err.message : String(err));
      setSwitching(false);
    }
  };

  return (
    <div className="absolute inset-0 overflow-auto scrollbar-thin">
      <div className="min-h-full flex flex-col items-center justify-center px-4 py-8">
        <button
          onClick={handleSwitch}
          disabled={switching}
          className="flex items-center gap-2 px-3 py-2 rounded-lg border border-border-dark-light bg-bg-secondary text-text-secondary text-xs hover:border-accent-primary hover:text-text-primary transition-colors duration-200 disabled:opacity-60"
        >
          {switching ? (
            <CgSpinner className="w-4 h-4 animate-spin text-accent-primary" />
          ) : (
            <FiLayers className="w-4 h-4 text-accent-primary" />
          )}
          <span className="font-medium">BMAD-MODE</span>
        </button>
        <p className="mt-2 text-2xs text-text-tertiary">Switch to BMAD mode</p>
        {error && (
          <div className="mt-3 flex items-center gap-1.5 text-2xs text-error">
            <FiAlertTriangle className="w-3.5 h-3.5 flex-shrink-0" />
            <span>{error}</span>
          </div>
        )}
      </div>
    </div>
  );
}
