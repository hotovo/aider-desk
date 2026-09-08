(props) => {
  const { executeExtensionAction, icons } = props;
  const { useState } = React;

  const [switching, setSwitching] = useState(false);
  const [error, setError] = useState(null);

  const FiLayers = icons.Fi.FiLayers;
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
    <button
      onClick={handleSwitch}
      disabled={switching}
      title={error || 'Switch to BMAD mode'}
      className="inline-flex items-center gap-1.5 px-2 py-1 rounded-md border border-border-dark-light bg-bg-secondary text-text-secondary text-2xs hover:border-accent-primary hover:text-text-primary transition-colors duration-200 disabled:opacity-60"
    >
      {switching ? (
        <CgSpinner className="w-3.5 h-3.5 animate-spin text-accent-primary" />
      ) : (
        <FiLayers className="w-3.5 h-3.5 text-accent-primary" />
      )}
      <span className="font-medium">BMAD</span>
    </button>
  );
}
