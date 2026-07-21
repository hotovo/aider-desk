({ data, ui, icons, libraries }) => {
  const { Tooltip } = ui;
  const MdOutlineSchedule = icons.Md.MdOutlineSchedule;
  const MdPause = icons.Md.MdPause;

  const schedule = data?.schedule;

  if (!schedule || !schedule.isActive) {
    return null;
  }

  const cronstrue = libraries?.cronstrue?.default || libraries?.cronstrue;

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

  const tooltipParts = [describeSchedule()];
  if (schedule.paused) {
    tooltipParts.push('Paused');
  } else if (schedule.awaitingSubtaskCompletion) {
    tooltipParts.push('Awaiting subtask completion');
  } else if (schedule.nextRunAt) {
    tooltipParts.push(`Next: ${formatRelativeTime(schedule.nextRunAt)}`);
  }
  if (schedule.runsCompleted > 0) {
    tooltipParts.push(`Runs: ${schedule.runsCompleted}`);
  }

  return (
    <Tooltip content={tooltipParts.join(' · ')}>
      <span className="flex items-center">
        {schedule.paused ? (
          <MdPause className="w-3 h-3 text-accent-primary" />
        ) : (
          <MdOutlineSchedule className="w-3 h-3 text-accent-primary" />
        )}
      </span>
    </Tooltip>
  );
};
