({ data, message }) => {
  if (!data || !message?.id) return null;

  const messageTps = data[message.id];

  if (!messageTps) return null;

  return (
    <span
      className="text-2xs mt-[4px] text-text-muted group-hover:text-text-secondary transition-colors"
      title={`${messageTps.tokens} tokens in ${messageTps.duration.toFixed(2)}s`}
    >
      {Math.round(messageTps.tps)} TPS
    </span>
  );
};
