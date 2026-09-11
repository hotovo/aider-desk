({ data }) => {
  if (!data || (data.messageCount === 0 && !data.isStreaming)) return null;

  const liveLabel = data.isStreaming ? 'Live tokens/s:' : 'Last tokens/s:';
  const liveTps = Math.round(data.currentTps);

  return (
    <div className="flex flex-col gap-1 text-2xs mt-1 w-full">
      <div className="flex items-center justify-between">
        <span>{liveLabel}</span>
        <span>{liveTps}</span>
      </div>
      {!data.isStreaming && (
        <div className="flex items-center justify-between">
          <span>Avg. tokens/s:</span>
          <span>{Math.round(data.averageTps)}</span>
        </div>
      )}
      {data.peakTps > 0 && (
        <div className="flex items-center justify-between text-text-muted">
          <span>Peak:</span>
          <span>{Math.round(data.peakTps)}</span>
        </div>
      )}
      {data.subagentCount > 0 && (
        <div className="flex items-center justify-between text-text-muted">
          <span>Subagents ({data.subagentCount}):</span>
          <span>{Math.round(data.subagentTps)} tokens/s</span>
        </div>
      )}
    </div>
  );
};
