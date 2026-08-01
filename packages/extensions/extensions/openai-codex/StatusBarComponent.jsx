({ agentProfile, data, ui }) => {
  const formatResetTime = (timestamp) => {
    if (!timestamp) return null;
    const date = new Date(timestamp * 1000);
    return date.toLocaleString(undefined, {
      weekday: 'short',
      month: 'short',
      day: 'numeric',
      hour: '2-digit',
      minute: '2-digit',
    });
  };

  if (agentProfile?.provider !== 'openai-codex') {
    return null;
  }

  const weeklyWindowSeconds = 7 * 86400;
  const weeklyUsage = [data?.primary, data?.secondary].find(
    (window) => window?.limit_window_seconds === weeklyWindowSeconds,
  );

  if (!weeklyUsage) {
    return (
      <div className="flex items-center gap-2 pt-1 justify-between w-full">
        <span>Weekly usage limit:</span>
        <span>Usage unavailable</span>
      </div>
    );
  }

  const remainingPercentage = 100 - weeklyUsage.used_percent;

  return (
    <div className="flex items-center gap-2 pt-1 justify-between w-full">
      <span>Weekly usage limit:</span>
      <ui.Tooltip content={weeklyUsage.reset_at ? `Resets at ${formatResetTime(weeklyUsage.reset_at)}` : ''}>
        <span>{remainingPercentage}% remaining</span>
      </ui.Tooltip>
    </div>
  );
}
