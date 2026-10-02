({ data, task, ui, icons, executeExtensionAction, renderDefaultTaskActions, onResumeTask }) => {
  const { useState, useCallback, useRef } = React;
  const { Button, Input, IconButton, Checkbox } = ui;
  const MdBolt = icons.Md.MdBolt;
  const MdClose = icons.Md.MdClose;
  const MdCompress = icons.Md.MdCompress;

  const SECTION_CLASS =
    'px-4 p-2 max-w-full break-words text-xs border-t border-border-dark-light relative group bg-bg-primary-light-strong';

  const LEVELS = [
    { value: 1, label: '1 · Mild', description: 'Light truncation: 50 lines of file reads, 20 lines / 2 KB / ~2k tokens for other tool results.' },
    { value: 2, label: '2 · Moderate', description: 'Tighter truncation: 20 lines of file reads, 10 lines / 1 KB / ~1k tokens for other tool results, bash outputs redacted.' },
    { value: 3, label: '3 · Aggressive', description: 'Redact compactable outputs entirely; drop obsolete searches, duplicate reads and old semantic searches.' },
  ];

  const DEFAULT_PASSES = {
    erroredTools: true,
    fileEdits: true,
    staleFileReads: true,
    fileReads: true,
    searches: true,
    semanticSearches: true,
    bash: true,
    fetch: true,
    otherTools: true,
    verboseToolCalls: false,
    reasoning: false,
  };

  const settings = data?.settings;
  const stats = data?.stats;
  const lastResult = data?.lastResult;

  const [protectedWindow, setProtectedWindow] = useState(String(settings?.protectedMessageCount ?? 10));
  const [level, setLevel] = useState(settings?.compactionLevel ?? 1);
  const [passes, setPasses] = useState({ ...DEFAULT_PASSES, ...(settings?.passes ?? {}) });
  const [error, setError] = useState(null);
  const [isProcessing, setIsProcessing] = useState(false);

  const settingsSaveTimerRef = useRef(null);
  const persistSettings = useCallback(
    (nextWindow, nextLevel, nextPasses) => {
      if (settingsSaveTimerRef.current) {
        clearTimeout(settingsSaveTimerRef.current);
      }
      settingsSaveTimerRef.current = setTimeout(() => {
        void executeExtensionAction('update-settings', {
          protectedMessageCount: parseInt(nextWindow, 10) || 0,
          compactionLevel: nextLevel,
          passes: nextPasses,
        });
      }, 500);
    },
    [executeExtensionAction],
  );

  const withProcessing = useCallback(async (action) => {
    setIsProcessing(true);
    try {
      await action();
    } catch (err) {
      console.error(err);
      setError(err instanceof Error ? err.message : String(err));
    } finally {
      setIsProcessing(false);
    }
  }, []);

  const handleWindowChange = useCallback(
    (e) => {
      setProtectedWindow(e.target.value);
      setError(null);
      persistSettings(e.target.value, level, passes);
    },
    [persistSettings, level, passes],
  );

  const handleWindowPresetClick = useCallback(
    (value) => {
      setProtectedWindow(String(value));
      setError(null);
      persistSettings(String(value), level, passes);
    },
    [persistSettings, level, passes],
  );

  const handleLevelClick = useCallback(
    (value) => {
      setLevel(value);
      setError(null);
      persistSettings(protectedWindow, value, passes);
    },
    [persistSettings, protectedWindow, passes],
  );

  const handlePassChange = useCallback(
    (id) => (checked) => {
      setPasses((prev) => {
        const next = { ...prev, [id]: checked };
        persistSettings(protectedWindow, level, next);
        return next;
      });
    },
    [persistSettings, protectedWindow, level],
  );

  const handleCompact = useCallback(() => {
    const windowValue = parseInt(protectedWindow, 10);
    if (isNaN(windowValue) || windowValue < 0) {
      setError('Safe window must be a non-negative number');
      return;
    }
    setError(null);
    void withProcessing(async () => {
      await executeExtensionAction('compact', {
        protectedMessageCount: windowValue,
        compactionLevel: level,
        passes,
      });
    });
  }, [executeExtensionAction, withProcessing, protectedWindow, level, passes]);

  const handleHide = useCallback(() => {
    void withProcessing(async () => {
      await executeExtensionAction('hide');
    });
  }, [withProcessing, executeExtensionAction]);

  if (!data?.visible) {
    return renderDefaultTaskActions ? renderDefaultTaskActions() : null;
  }

  const formatSavings = (stat) => {
    const saved = stat?.savings?.[level] ?? 0;
    return saved > 0 ? ` · saves ~${Math.round(saved).toLocaleString()}` : '';
  };

  const PASS_ROWS = [
    { id: 'erroredTools', label: 'Errored / no-op tool calls', stat: stats?.erroredTools },
    { id: 'fileEdits', label: 'File edits & writes (collapse)', stat: stats?.fileEdits },
    { id: 'staleFileReads', label: 'Stale file reads', stat: stats?.staleFileReads },
    { id: 'fileReads', label: 'File reads (truncate)', stat: stats?.fileReads },
    { id: 'searches', label: 'Glob / grep searches', stat: stats?.searches },
    { id: 'semanticSearches', label: 'Semantic searches', stat: stats?.semanticSearches },
    { id: 'bash', label: 'Bash outputs', stat: stats?.bash },
    { id: 'fetch', label: 'Fetch outputs', stat: stats?.fetch },
    { id: 'otherTools', label: 'Other tool results (truncate)', stat: stats?.otherTools },
    { id: 'verboseToolCalls', label: 'Verbose tool calls', stat: stats?.verboseToolCalls },
    { id: 'reasoning', label: 'Reasoning blocks', stat: stats?.reasoning },
  ];

  const levelDescription = LEVELS.find((preset) => preset.value === level)?.description;
  const totalMessages = data?.totalMessages ?? 0;
  const estimatedTokens = data?.estimatedTokens ?? 0;

  return (
    <div className={SECTION_CLASS}>
      <div className="flex flex-col gap-2">
        <div className="flex items-center gap-2">
          <MdCompress size={14} className="text-text-secondary shrink-0" />
          <span className="flex-1 min-w-0 truncate text-xs font-medium text-text-secondary">Compaction Studio</span>
          <span className="text-2xs text-text-muted">
            {totalMessages} messages · ~{estimatedTokens.toLocaleString()} tokens
          </span>
          <IconButton size="xs" onClick={handleHide} disabled={isProcessing}>
            <MdClose size={12} />
          </IconButton>
        </div>

        <div className="flex flex-col gap-1">
          <span className="text-2xs font-medium text-text-muted uppercase">Compact what</span>
          <div className="grid grid-cols-2 gap-x-3 gap-y-0.5">
            {PASS_ROWS.map((row) => {
              const disabled = isProcessing;
              const count = row.stat?.count ?? 0;
              const statText = count > 0 ? ` · ${count} · ~${Math.round(row.stat.estimatedTokens).toLocaleString()} tok${formatSavings(row.stat)}` : '';
              return (
                <Checkbox
                  key={row.id}
                  label={
                    <>
                      {row.label}
                      {statText && <span className="text-text-muted">{statText}</span>}
                    </>
                  }
                  checked={passes[row.id] === true}
                  onChange={handlePassChange(row.id)}
                  size="xs"
                  disabled={disabled}
                />
              );
            })}
          </div>
        </div>

        <div className="flex flex-col gap-1">
          <span className="text-2xs font-medium text-text-muted uppercase">Safe window (protected messages)</span>
          <div className="flex items-center gap-1.5">
            <Input wrapperClassName="w-20" type="number" min="0" value={protectedWindow} onChange={handleWindowChange} size="sm" />
            {[0, 5, 10, 20, 50].map((preset) => (
              <Button
                key={preset}
                variant={parseInt(protectedWindow, 10) === preset ? 'contained' : 'outline'}
                color="primary"
                size="xs"
                onClick={() => handleWindowPresetClick(preset)}
                disabled={isProcessing}
              >
                {preset}
              </Button>
            ))}
          </div>
        </div>

        <div className="flex flex-col gap-1">
          <span className="text-2xs font-medium text-text-muted uppercase">Compaction level</span>
          <div className="flex flex-wrap gap-1.5">
            {LEVELS.map((preset) => (
              <Button
                key={preset.value}
                variant={level === preset.value ? 'contained' : 'outline'}
                color="primary"
                size="xs"
                onClick={() => handleLevelClick(preset.value)}
                disabled={isProcessing}
              >
                {preset.label}
              </Button>
            ))}
          </div>
          {levelDescription && <div className="text-2xs text-text-muted">{levelDescription}</div>}
        </div>

        {lastResult && (
          <div className="text-2xs text-text-muted">
            Last run: {lastResult.messagesBefore} → {lastResult.messagesAfter} messages · ~
            {lastResult.tokensAfter.toLocaleString()} tokens (saved ~{lastResult.savedTokens.toLocaleString()})
          </div>
        )}

        {error && <div className="text-xs text-error">{error}</div>}

        <div className="flex justify-end gap-2">
          <Button variant="text" color="tertiary" size="xs" onClick={handleHide} disabled={isProcessing}>
            Close
          </Button>
          <Button variant="contained" color="primary" size="xs" onClick={handleCompact} disabled={isProcessing}>
            <MdBolt size={12} className="mr-1" />
            {isProcessing ? 'Compacting…' : 'Compact Now'}
          </Button>
        </div>

        {renderDefaultTaskActions && <div className="mt-1">{renderDefaultTaskActions()}</div>}
      </div>
    </div>
  );
};
