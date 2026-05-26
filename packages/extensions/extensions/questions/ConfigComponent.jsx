({ config, updateConfig, ui }) => {
  const { useCallback } = React;
  const { ModelSelector } = ui;

  const customModelId = config?.customModelId || '';

  const handleModelChange = useCallback((model) => {
    const modelId = model ? `${model.providerId}/${model.id}` : '';
    updateConfig({
      ...config,
      customModelId: modelId,
    });
  }, [config, updateConfig]);

  return (
    <div className="flex flex-col gap-1">
      <label className="block text-sm font-medium text-text-primary mb-1">Model</label>
      <div className="w-full p-2 bg-bg-secondary-light border-2 border-border-default rounded focus-within:outline-none focus-within:border-border-light">
        <ModelSelector
          className="w-full justify-between"
          selectedModelId={customModelId || null}
          onChange={handleModelChange}
          labelOnNull="Inherited"
          skipPreferredModelsUpdate
          usePortal
        />
      </div>
      <p className="text-xs text-text-secondary">
        {customModelId
          ? 'Using a custom model for question extraction.'
          : 'Uses the model from the current task\'s agent profile.'}
      </p>
    </div>
  );
};
