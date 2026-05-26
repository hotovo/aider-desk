({ data, message, executeExtensionAction, ui, icons }) => {
  if (!data?.checkpoints || !message?.id) return null;

  if (message.type !== 'tool') return null;
  if (message.toolName !== 'file_edit' && message.toolName !== 'file_write') return null;
  if (!message.finished) return null;

  const output = typeof message.content === 'string' ? message.content : '';
  const parsed = (() => { try { return JSON.parse(output); } catch { return output; } })();
  const outputStr = typeof parsed === 'string' ? parsed : String(parsed ?? '');

  if (!outputStr.startsWith('Successfully')) return null;

  const hasCheckpoint = !!data.checkpoints[message.id];
  if (!hasCheckpoint) return null;

  const { useState, useCallback } = React;
  const [confirming, setConfirming] = useState(false);

  const Tooltip = ui.Tooltip;
  const RiCloseLine = icons.Ri.RiCloseLine;

  const handleRequestRevert = useCallback(() => {
    setConfirming(true);
  }, []);

  const handleCancel = useCallback(() => {
    setConfirming(false);
  }, []);

  const handleConfirm = useCallback(() => {
    setConfirming(false);
    executeExtensionAction('revert', message.id);
  }, [executeExtensionAction, message.id]);

  if (confirming) {
    return (
      <div className="flex items-center gap-1.5 mt-2 mb-1 px-1">
        <button
          onClick={handleConfirm}
          className="flex items-center gap-1 text-2xs text-error hover:text-error-light transition-colors cursor-pointer font-medium"
        >
          Confirm reset
        </button>
        <button
          onClick={handleCancel}
          className="flex items-center text-2xs text-text-muted hover:text-text-primary transition-colors cursor-pointer"
        >
          <RiCloseLine className="w-3.5 h-3.5" />
        </button>
      </div>
    );
  }

  return (
    <div className="flex items-center gap-1.5 mt-2 mb-1 px-1">
      <Tooltip content="Reset the entire codebase to the state before this edit. All changes made after this point will be undone.">
        <button
          onClick={handleRequestRevert}
          className="flex items-center gap-1 text-2xs text-text-muted hover:text-text-primary transition-colors cursor-pointer"
        >
          ↩ Reset to this checkpoint
        </button>
      </Tooltip>
    </div>
  );
};
