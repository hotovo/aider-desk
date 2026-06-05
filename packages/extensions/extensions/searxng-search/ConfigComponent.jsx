({ config, updateConfig, ui }) => {
  const { Input, Select } = ui;

  const handleModeChange = (value) => {
    updateConfig({ ...config, mode: value });
  };

  const handleUrlChange = (e) => {
    updateConfig({ ...config, url: e.target.value });
  };

  return (
    <div className="flex flex-col gap-4">
      <Select
        label="Source"
        value={config?.mode || 'docker'}
        onChange={handleModeChange}
        options={[
          { value: 'docker', label: 'Docker (auto-start SearXNG container)' },
          { value: 'url', label: 'Existing SearXNG instance' },
        ]}
      />
      <p className="text-xs text-text-secondary -mt-2">
        {config?.mode === 'docker'
          ? 'Automatically starts a SearXNG container via Docker. Requires Docker to be installed and running.'
          : 'Connect to an already running SearXNG instance. Make sure JSON format is enabled in its settings.'}
      </p>
      {config?.mode === 'url' && (
        <Input
          label="SearXNG URL"
          value={config?.url || ''}
          onChange={handleUrlChange}
          placeholder="http://localhost:8080"
        />
      )}
    </div>
  );
}
