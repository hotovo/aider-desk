({ data, message }) => {
  if (!data || !message?.id) return null;

  const messageId = message.responseMessage?.id || message.id;
  const messageTps = data[messageId];

  if (!messageTps) return null;

  const label = messageTps.isStreaming ? 'Live' : 'TPS';

  return (
    <span
      className="text-2xs mt-[4px] pl-2 border-l border-border-dark-light text-text-muted group-hover:text-text-secondary transition-colors"
      title={`${messageTps.tokens} tokens in ${messageTps.duration.toFixed(2)}s; peak ${Math.round(messageTps.peakTps)} TPS`}
    >
      {label} {Math.round(messageTps.tps)} TPS
    </span>
  );
};
