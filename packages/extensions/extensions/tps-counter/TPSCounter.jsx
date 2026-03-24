({ data }) => {
  if (!data || data.messageCount === 0) return null;

  const { averageTps } = data;

  return (
    <div className="flex items-center gap-1 text-2xs mt-1 w-full justify-between">
      <span>Avg. tokens/s:</span>
      <span>{Math.round(averageTps)}</span>
    </div>
  );
};
