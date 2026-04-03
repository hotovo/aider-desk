({ agentProfile, data, ui }) => {
  const formatResetTime = (timestamp) => {
    if (!timestamp) return null;
    const date = new Date(timestamp);
    return date.toLocaleString(undefined, {
      weekday: 'short',
      month: 'short',
      day: 'numeric',
      hour: '2-digit',
      minute: '2-digit',
    });
  };

  return agentProfile?.provider === 'synthetic' && data?.synthetic ? (
    data.synthetic.error ? (
      <span className="pt-1">Quota unavailable</span>
    ) : (
      <div className="flex items-center gap-2 pt-1 justify-between w-full">
        <span>Synthetic:</span>
        <div className="flex items-center gap-2">
          <span>{data.synthetic.used}/{data.synthetic.limit}</span>
          <span>({data.synthetic.percentage}%)</span>
        </div>
      </div>
    )
  ) : agentProfile?.provider === 'zai-plan' && data?.zai ? (
    <div className="flex items-center gap-2 pt-1 justify-between w-full">
      <span>Z.ai:</span>
      <div className="flex items-center gap-2">
        <ui.Tooltip content={data.zai.hourlyNextResetTime ? `Resets at ${formatResetTime(data.zai.hourlyNextResetTime)}` : ''}>
          <span>5 Hours: {data.zai.hourlyPercentage}%</span>
        </ui.Tooltip>
        <span>|</span>
        <ui.Tooltip content={data.zai.weeklyNextResetTime ? `Resets at ${formatResetTime(data.zai.weeklyNextResetTime)}` : ''}>
          <span>Weekly: {data.zai.weeklyPercentage}%</span>
        </ui.Tooltip>
      </div>
    </div>
  ) : null;
}
