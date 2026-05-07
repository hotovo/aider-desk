({ config, updateConfig, ui }) => {
  const { Input } = ui;

  const handleChange = (e) => {
    const value = parseInt(e.target.value, 10);
    if (!isNaN(value) && value >= 1 && value <= 20) {
      updateConfig({ ...config, maxRetries: value });
    }
  };

  return (
    <div className="flex flex-col gap-4">
      <Input
        label="Max Retries"
        type="number"
        value={config?.maxRetries ?? 3}
        onChange={handleChange}
        min={1}
        max={20}
      />
      <p className="text-xs text-text-secondary -mt-2">
        Maximum number of review-and-fix cycles before giving up. Each cycle reviews the implementation against the plan and requests fixes if issues are found.
      </p>
    </div>
  );
};
