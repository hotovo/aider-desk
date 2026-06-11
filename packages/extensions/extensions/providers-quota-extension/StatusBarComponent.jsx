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

  const currencySymbols = {
    USD: '$',
    CNY: '¥',
    EUR: '€',
    GBP: '£',
    JPY: '¥',
    KRW: '₩',
  };

  const formatCurrency = (amount, currency) => {
    const symbol = currencySymbols[currency] || currency;
    return `${symbol}${amount}`;
  };

  if (agentProfile?.provider === 'synthetic' && data?.synthetic) {
    return data.synthetic.error ? (
      <span className="pt-1">Quota unavailable</span>
    ) : (
      <div className="flex items-center gap-2 pt-1 justify-between w-full">
        <span>Usage:</span>
        <div className="flex items-center gap-2">
          <span>{data.synthetic.used}/{data.synthetic.limit}</span>
          <span>({data.synthetic.percentage}%)</span>
        </div>
      </div>
    );
  }

  if (agentProfile?.provider === 'zai-plan' && data?.zai) {
    return (
      <div className="flex items-center gap-2 pt-1 justify-between w-full">
        <span>Usage:</span>
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
    );
  }

  if (agentProfile?.provider === 'deepseek' && data?.deepseek) {
    const ds = data.deepseek;
    const balance = ds.balance;

    if (!balance) {
      return (
        <div className="flex items-center gap-2 pt-1 justify-between w-full">
          <span>DeepSeek:</span>
          <span>Balance unavailable</span>
        </div>
      );
    }

    return (
      <div className="flex items-center gap-2 pt-1 justify-between w-full">
        <span>DeepSeek:</span>
        <div className="flex items-center gap-2">
          <span>{formatCurrency(balance.total_balance, balance.currency)}</span>
        </div>
      </div>
    );
  }

  if (agentProfile?.provider === 'neuralwatt' && data?.neuralwatt) {
    const nw = data.neuralwatt;

    if (nw.isSubscription) {
      const kwhUsed = nw.kwhUsed?.toFixed(2) ?? '0.00';
      const kwhIncluded = nw.kwhIncluded?.toFixed(1) ?? '0.0';
      const periodEnd = nw.currentPeriodEnd ? formatResetTime(nw.currentPeriodEnd) : null;

      return (
        <div className="flex items-center gap-2 pt-1 justify-between w-full">
          <span>Usage:</span>
          <div className="flex items-center gap-2">
            <ui.Tooltip content={periodEnd ? `Renews at ${periodEnd}` : ''}>
              <span>{kwhUsed}/{kwhIncluded} kWh</span>
            </ui.Tooltip>
            <span>({nw.kwhPercentage}%)</span>
            {nw.inOverage && (
              <span className="text-red-400 text-xs">overage</span>
            )}
          </div>
        </div>
      );
    }

    const creditsRemaining = nw.creditsRemaining?.toFixed(2) ?? '0.00';

    return (
      <div className="flex items-center gap-2 pt-1 justify-between w-full">
        <span>Neuralwatt:</span>
        <div className="flex items-center gap-2">
          <ui.Tooltip content={`Accounting: ${nw.accountingMethod || 'energy'}`}>
            <span>${creditsRemaining}</span>
          </ui.Tooltip>
          <span>({nw.creditsPercentage}%)</span>
        </div>
      </div>
    );
  }

  return null;
}
