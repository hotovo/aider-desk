({ config, updateConfig, ui }) => {
  const { Input, Select, Checkbox } = ui;

  const handleProviderChange = (value) => {
    updateConfig({ ...config, provider: value });
  };

  const handleApiKeyChange = (e) => {
    updateConfig({ ...config, apiKey: e.target.value });
  };

  const handleModelChange = (e) => {
    updateConfig({ ...config, model: e.target.value });
  };

  const handleConcurrencyChange = (e) => {
    const n = parseInt(e.target.value, 10);
    updateConfig({ ...config, concurrency: Number.isFinite(n) && n > 0 ? n : 16 });
  };

  const isTypesafe = (config?.provider || 'typesafe') === 'typesafe';
  const providerHint = isTypesafe
    ? 'Native TypeSafe SystemOne endpoint. Get a key at typesafe.ai.'
    : (config?.provider || 'typesafe') === 'openrouter'
      ? 'Uses the OpenRouter decisions endpoint (native Jev contract).'
      : 'Uses Requesty Chat Completions with the questions response format.';

  return (
    <div className="flex flex-col gap-4">
      <Select
        label="Provider"
        value={config?.provider || 'typesafe'}
        onChange={handleProviderChange}
        options={[
          { value: 'typesafe', label: 'TypeSafe (native API)' },
          { value: 'openrouter', label: 'OpenRouter (decisions endpoint)' },
          { value: 'requesty', label: 'Requesty' },
          { value: 'mock', label: 'Mock (offline, no network)' },
        ]}
      />
      <p className="text-xs text-text-secondary -mt-2">{providerHint}</p>
      <Input
        label="API Key (optional override)"
        type="password"
        value={config?.apiKey || ''}
        onChange={handleApiKeyChange}
        placeholder={isTypesafe ? 'TYPESAFE_API_KEY' : 'falls back to provider settings, then env'}
      />
      <p className="text-xs text-text-secondary -mt-2">
        {isTypesafe
          ? 'TypeSafe has no profile in AiderDesk settings, so set the key here or in the TYPESAFE_API_KEY environment variable.'
          : 'Leave empty to use the key saved in AiderDesk Provider settings (OpenRouter / Requesty); the key is used as a fallback from the environment otherwise.'}
      </p>
      <Input
        label="Model (optional)"
        value={config?.model || ''}
        onChange={handleModelChange}
        placeholder="default: jev-latest / ~typesafe/jev-latest / typesafe/jev-latest"
      />
      <Checkbox
        label="Gate ask-jev commands through Jev (block irreversible/destructive)"
        checked={config?.commandGate !== undefined ? config.commandGate : true}
        onChange={(checked) => updateConfig({ ...config, commandGate: checked })}
      />
      <Input
        label="ask-jev-files concurrency"
        type="number"
        value={String(config?.concurrency || 16)}
        onChange={handleConcurrencyChange}
        placeholder="16"
      />
    </div>
  );
}
