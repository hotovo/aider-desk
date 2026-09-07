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

  const fiveHourWindowSeconds = 5 * 3600;
  const weeklyWindowSeconds = 7 * 86400;
  const usageWindows = [data?.primary, data?.secondary];
  const fiveHourUsage = usageWindows.find(
    (window) => window?.limit_window_seconds === fiveHourWindowSeconds,
  );
  const weeklyUsage = usageWindows.find(
    (window) => window?.limit_window_seconds === weeklyWindowSeconds,
  );

  const renderWindow = (label, usageWindow, withRemaining) => (
    <ui.Tooltip content={usageWindow.reset_at ? `Resets at ${formatResetTime(usageWindow.reset_at)}` : ''}>
      <span>{label}: {100 - usageWindow.used_percent}%{withRemaining ? ' remaining' : ''}</span>
    </ui.Tooltip>
  );

  if (!weeklyUsage && !fiveHourUsage) {
    return (
      <div className="flex items-center gap-2 pt-1 justify-end w-full">
        <span>Usage unavailable</span>
      </div>
    );
  }

  return (
    <div className="flex items-center gap-2 pt-1 justify-end w-full">
      <div className="flex items-center gap-2">
        {fiveHourUsage && renderWindow('5 Hours', fiveHourUsage, false)}
        {fiveHourUsage && weeklyUsage && <span>|</span>}
        {weeklyUsage && renderWindow('Weekly', weeklyUsage, true)}
      </div>
    </div>
  );
}
