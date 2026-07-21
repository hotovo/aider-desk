({ data, task, ui, icons, libraries, executeExtensionAction, renderDefaultTaskActions, onResumeTask }) => {
  const { useState, useCallback, useEffect, useRef } = React;
  const { Button, Input, IconButton } = ui;
  const MdOutlineEdit = icons.Md.MdOutlineEdit;
  const MdOutlineScheduleSend = icons.Md.MdOutlineScheduleSend;
  const MdPause = icons.Md.MdPause;
  const MdPlayArrow = icons.Md.MdPlayArrow;
  const MdStop = icons.Md.MdStop;
  const MdSync = icons.Md.MdSync;
  const MdOutlineSchedule = icons.Md.MdOutlineSchedule;

  const cronstrue = libraries?.cronstrue?.default || libraries?.cronstrue;

  const SECTION_CLASS = 'px-4 p-2 max-w-full break-words text-xs border-t border-border-dark-light relative group bg-bg-primary-light-strong';

  const schedule = data?.schedule;
  const isTodo = !task?.state || task?.state === 'TODO';

  if (!schedule) {
    const defaults = renderDefaultTaskActions ? renderDefaultTaskActions() : null;
    if (!isTodo || onResumeTask) return defaults;

    return (
      <>
        {defaults}
        <div className={SECTION_CLASS}>
          <div className="flex items-center justify-end gap-2">
            <Button variant="outline" color="primary" size="xs" onClick={() => executeExtensionAction('add')}>
              <MdOutlineSchedule className="mr-1 w-3 h-3" />
              Set Schedule
            </Button>
          </div>
        </div>
      </>
    );
  }

  const initialMode = schedule.cron ? 'cron' : 'periodic';
  const initialCron = schedule.cron || '';
  const initialDelay = schedule.delayMinutes?.toString() || '30';
  const initialMaxRuns = schedule.maxRuns?.toString() || '';

  const [mode, setMode] = useState(initialMode);
  const [cronExpression, setCronExpression] = useState(initialCron);
  const [delayMinutes, setDelayMinutes] = useState(initialDelay);
  const [maxRuns, setMaxRuns] = useState(initialMaxRuns);
  const [error, setError] = useState(null);
  const [isProcessing, setIsProcessing] = useState(false);

  const needsInitialization = schedule.initialized === false;
  const hasSavedRef = useRef(false);

  const [isEditing, setIsEditing] = useState(false);

  useEffect(() => {
    if (needsInitialization && !isEditing && !hasSavedRef.current) {
      setIsEditing(true);
    }
  }, [needsInitialization, isEditing]);

  const isDirty = needsInitialization ||
    mode !== initialMode ||
    (mode === 'cron' ? cronExpression.trim() !== initialCron : delayMinutes !== initialDelay) ||
    maxRuns.trim() !== initialMaxRuns;

  const cronDescription = (expr) => {
    if (!expr.trim()) return '';
    try {
      return cronstrue.toString(expr);
    } catch {
      return 'Invalid cron expression';
    }
  };

  const withProcessing = useCallback(async (action) => {
    setIsProcessing(true);
    try {
      await action();
    } catch (error) {
      console.error(error);
    } finally {
      setIsProcessing(false);
    }
  }, []);

  const handleSave = useCallback(() => {
    const updated = {
      runsCompleted: schedule?.runsCompleted ?? 0,
      isActive: true,
      paused: false,
      initialized: true,
    };

    if (mode === 'cron') {
      if (!cronExpression.trim()) {
        setError('Cron expression is required');
        return;
      }
      try {
        cronstrue.toString(cronExpression);
      } catch {
        setError('Invalid cron expression');
        return;
      }
      updated.cron = cronExpression.trim();
    } else {
      const minutes = parseInt(delayMinutes, 10);
      if (isNaN(minutes) || minutes <= 0) {
        setError('Invalid delay value');
        return;
      }
      updated.delayMinutes = minutes;
    }

    if (maxRuns.trim()) {
      const runs = parseInt(maxRuns, 10);
      if (!isNaN(runs) && runs > 0) {
        updated.maxRuns = runs;
      }
    }

    void withProcessing(async () => {
      hasSavedRef.current = true;
      await executeExtensionAction('set', updated);
      setIsEditing(false);
      setError(null);
    });
  }, [executeExtensionAction, mode, cronExpression, delayMinutes, maxRuns, schedule, withProcessing]);

  const handleCancel = useCallback(() => {
    if (needsInitialization) {
      void withProcessing(async () => {
        await executeExtensionAction('cancel');
      });
      return;
    }
    setIsEditing(false);
    setError(null);
  }, [executeExtensionAction, needsInitialization, withProcessing]);

  const handleCancelSchedule = useCallback(() => {
    void withProcessing(async () => {
      await executeExtensionAction('cancel');
    });
  }, [executeExtensionAction, withProcessing]);

  const handlePauseResume = useCallback(() => {
    void withProcessing(async () => {
      if (schedule?.paused) {
        await executeExtensionAction('resume');
      } else {
        await executeExtensionAction('pause');
      }
    });
  }, [executeExtensionAction, schedule, withProcessing]);

  const handleRunNow = useCallback(() => {
    void withProcessing(async () => {
      await executeExtensionAction('run-now');
    });
  }, [executeExtensionAction, withProcessing]);

  const handleEdit = useCallback(() => {
    setIsEditing(true);
    setError(null);
  }, []);

  const handleCronModeClick = useCallback(() => {
    setMode('cron');
    setError(null);
  }, []);

  const handlePeriodicModeClick = useCallback(() => {
    setMode('periodic');
    setError(null);
  }, []);

  const handleCronExpressionChange = useCallback((e) => {
    setCronExpression(e.target.value);
    setError(null);
  }, []);

  const handleDelayMinutesChange = useCallback((e) => {
    setDelayMinutes(e.target.value);
    setError(null);
  }, []);

  const handleMaxRunsChange = useCallback((e) => {
    setMaxRuns(e.target.value);
  }, []);

  const QUICK_PRESETS = [
    { label: 'Every minute', cron: '* * * * *' },
    { label: 'Every 5 minutes', cron: '*/5 * * * *' },
    { label: 'Every 15 minutes', cron: '*/15 * * * *' },
    { label: 'Every 30 minutes', cron: '*/30 * * * *' },
    { label: 'Every hour', cron: '0 * * * *' },
    { label: 'Every day at 9am', cron: '0 9 * * *' },
    { label: 'Every Monday', cron: '0 9 * * 1' },
  ];

  const PERIODIC_PRESETS = [
    { label: '5 minutes', minutes: 5 },
    { label: '15 minutes', minutes: 15 },
    { label: '30 minutes', minutes: 30 },
    { label: '1 hour', minutes: 60 },
    { label: '2 hours', minutes: 120 },
    { label: '24 hours', minutes: 1440 },
  ];

  const formatRelativeTime = (iso) => {
    if (!iso) return '';
    const date = new Date(iso);
    const now = new Date();
    const diffMs = date.getTime() - now.getTime();
    const diffMin = Math.round(diffMs / 60000);
    if (diffMin < 0) return 'now';
    if (diffMin < 1) return 'less than a minute';
    if (diffMin < 60) return `in ${diffMin} min`;
    const diffHr = Math.round(diffMin / 60);
    if (diffHr < 24) return `in ${diffHr}h`;
    const diffDay = Math.round(diffHr / 24);
    return `in ${diffDay}d`;
  };

  if (isEditing) {
    return (
      <div className={SECTION_CLASS}>
        <div className="flex flex-col gap-3">
          <div className="flex items-center gap-2">
            <span className="flex-1 min-w-0 truncate text-xs font-medium text-text-secondary">
              {needsInitialization ? 'Configure Schedule' : 'Edit Schedule'}
            </span>
            <Button variant="text" color="tertiary" size="xs" onClick={handleCancel} disabled={isProcessing}>
              Cancel
            </Button>
            {isDirty && (
              <Button variant="contained" color="primary" size="xs" onClick={handleSave} disabled={isProcessing}>
                Save
              </Button>
            )}
          </div>
          <div className="flex items-center gap-2">
            <Button
              variant={mode === 'cron' ? 'contained' : 'outline'}
              color="primary"
              size="xs"
              onClick={handleCronModeClick}
            >
              Cron Schedule
            </Button>
            <Button
              variant={mode === 'periodic' ? 'contained' : 'outline'}
              color="primary"
              size="xs"
              onClick={handlePeriodicModeClick}
            >
              Periodically
            </Button>
          </div>
          <div className="flex gap-2">
            {mode === 'cron' ? (
              <Input
                wrapperClassName="flex-[2] min-w-0"
                label="Cron Expression"
                placeholder="*/5 * * * *"
                value={cronExpression}
                onChange={handleCronExpressionChange}
                size="sm"
              />
            ) : (
              <Input
                wrapperClassName="flex-1 min-w-0"
                label="Delay (minutes)"
                type="number"
                value={delayMinutes}
                onChange={handleDelayMinutesChange}
                size="sm"
              />
            )}
            <Input
              wrapperClassName="w-24"
              label="Max Runs"
              placeholder="∞"
              value={maxRuns}
              onChange={handleMaxRunsChange}
              size="sm"
            />
          </div>
          {error && (
            <div className="text-xs text-error">{error}</div>
          )}
          {mode === 'cron' && cronExpression.trim() && (
            <div className="text-2xs text-text-muted">
              {cronDescription(cronExpression)}
            </div>
          )}
          <div className="flex flex-wrap gap-1.5">
            {mode === 'cron'
              ? QUICK_PRESETS.map((preset) => (
                  <button
                    key={preset.label}
                    onClick={() => setCronExpression(preset.cron)}
                    className="px-2 py-0.5 text-2xs rounded border border-border-dark-light bg-bg-tertiary-emphasis hover:bg-bg-tertiary text-text-secondary transition-colors"
                  >
                    {preset.label}
                  </button>
                ))
              : PERIODIC_PRESETS.map((preset) => (
                  <button
                    key={preset.label}
                    onClick={() => setDelayMinutes(String(preset.minutes))}
                    className="px-2 py-0.5 text-2xs rounded border border-border-dark-light bg-bg-tertiary-emphasis hover:bg-bg-tertiary text-text-secondary transition-colors"
                  >
                    {preset.label}
                  </button>
                ))}
          </div>
        </div>
      </div>
    );
  }

  const describeSchedule = () => {
    if (schedule.cron) {
      try {
        return cronstrue.toString(schedule.cron);
      } catch {
        return schedule.cron;
      }
    }
    if (schedule.delayMinutes) {
      return `Every ${schedule.delayMinutes} minutes`;
    }
    return 'Scheduled';
  };

  return (
    <>
      <div className={SECTION_CLASS}>
        <div className="flex items-start justify-between">
          <div className="flex flex-col gap-1.5">
            <div className="flex gap-2 items-center">
              <MdOutlineScheduleSend className="w-4 h-4 flex-shrink-0 text-text-secondary" />
              <span className="flex-1 min-w-0 truncate text-text-primary">{describeSchedule()}</span>
            </div>
            {schedule.paused ? (
              <div className="ml-4 text-3xs text-warning px-2">
                Schedule is paused. The task will not run until resumed.
              </div>
            ) : (schedule.awaitingSubtaskCompletion || schedule.nextRunAt) && (
              <div className="flex items-center gap-2 text-2xs text-text-muted pl-6">
                {schedule.awaitingSubtaskCompletion ? (
                  <span>Awaiting subtask completion</span>
                ) : schedule.nextRunAt ? (
                  <span>
                    Next run: {formatRelativeTime(schedule.nextRunAt)}
                  </span>
                ) : null}
              </div>
            )}
          </div>
          <div className="flex flex-col gap-1">
            <div className="flex items-center gap-2 text-xs">
              <div className="flex flex-col items-end shrink-0 ml-1 gap-1.5">
                <div className="flex items-center">
                  {schedule.paused ? (
                    <span className="text-warning shrink-0 font-medium mr-2">Paused</span>
                  ) : (
                    <span className="text-success-light shrink-0 font-medium mr-2">Active</span>
                  )}
                  <IconButton
                    className='p-1 hover:bg-bg-secondary rounded'
                    icon={<MdSync className="w-4 h-4" />}
                    tooltip="Run Now"
                    onClick={handleRunNow}
                    disabled={isProcessing}
                  />
                  <IconButton
                    className='p-1 hover:bg-bg-secondary rounded'
                    icon={schedule.paused ? <MdPlayArrow className="w-4 h-4" /> : <MdPause className="w-4 h-4" />}
                    tooltip={schedule.paused ? 'Resume' : 'Pause'}
                    onClick={handlePauseResume}
                    disabled={isProcessing}
                  />
                  <IconButton
                    className='p-1 hover:bg-bg-secondary rounded'
                    icon={<MdOutlineEdit className="w-4 h-4" />}
                    tooltip="Edit Schedule"
                    onClick={handleEdit}
                    disabled={isProcessing}
                  />
                  <IconButton
                    className='p-1 hover:bg-bg-secondary rounded hover:text-error'
                    icon={<MdStop className="w-4 h-4" />}
                    tooltip="Cancel Schedule"
                    onClick={handleCancelSchedule}
                    disabled={isProcessing}
                  />
                </div>
                {schedule.runsCompleted > 0 && (
                  <span className="text-2xs text-text-muted">Runs completed: {schedule.runsCompleted}</span>
                )}
              </div>
            </div>
          </div>
        </div>
      </div>
      {task?.state !== 'SCHEDULED' && renderDefaultTaskActions ? renderDefaultTaskActions() : null}
    </>
  );
};
