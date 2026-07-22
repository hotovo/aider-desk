({ config, updateConfig, ui }) => {
  const { Input, Select, Tooltip, Checkbox } = ui;

  const connectionStateText = {
    disconnected: 'Disconnected',
    connecting: 'Starting daemon...',
    connected: 'Connected',
    error: 'Error',
  };

  const stateColor = {
    disconnected: 'text-text-muted',
    connecting: 'text-yellow-500',
    connected: 'text-green-500',
    error: 'text-red-500',
  };

  const apiKeyLabels = {
    gemini: 'Gemini API Key',
    anthropic: 'Anthropic API Key',
    openai: 'OpenAI API Key',
    groq: 'Groq API Key',
    ollama: 'Ollama URL',
  };

  const apiKeyPlaceholders = {
    gemini: 'AIza...',
    anthropic: 'sk-ant-...',
    openai: 'sk-...',
    groq: 'gsk_...',
    ollama: 'http://localhost:11434',
  };

  const apiKeyEnvMap = {
    gemini: 'GEMINI_API_KEY',
    anthropic: 'ANTHROPIC_API_KEY',
    openai: 'OPENAI_API_KEY',
    groq: 'GROQ_API_KEY',
    ollama: 'OLLAMA_BASE_URL',
  };

  const handleProviderChange = (value) => {
    const newEnv = {};
    const oldProviderEnv = Object.values(apiKeyEnvMap);
    for (const [key, value] of Object.entries(config?.env || {})) {
      if (!oldProviderEnv.includes(key)) {
        newEnv[key] = value;
      }
    }
    if (config?.apiKey) {
      const envKey = apiKeyEnvMap[value];
      if (envKey) {
        newEnv[envKey] = config.apiKey;
      }
    }
    updateConfig({ ...config, provider: value, env: newEnv });
  };

  const handleApiKeyChange = (e) => {
    const value = e.target.value;
    const newEnv = { ...(config?.env || {}) };
    const oldProviderEnv = Object.values(apiKeyEnvMap);
    for (const key of oldProviderEnv) {
      delete newEnv[key];
    }
    const provider = config?.provider || '';
    const envKey = apiKeyEnvMap[provider];
    if (envKey && value) {
      newEnv[envKey] = value;
    }
    updateConfig({ ...config, apiKey: value, env: newEnv });
  };

  const handleHybridSearchChange = (checked) => {
    const newEnv = { ...(config?.env || {}) };
    if (checked) {
      newEnv.WIGOLO_SEARCH = 'hybrid';
    } else {
      delete newEnv.WIGOLO_SEARCH;
    }
    updateConfig({ ...config, hybridSearch: checked, env: newEnv });
  };

  const currentProvider = config?.provider || '';

  return (
    <div className="flex flex-col gap-4">
      <div className="flex items-center gap-2">
        <span className={`text-xs font-medium ${stateColor[config?.connectionState] || 'text-text-muted'}`}>
          ● {connectionStateText[config?.connectionState] || 'Disconnected'}
        </span>
        {config?.connectionState === 'error' && config?.connectionError && (
          <Tooltip content={config.connectionError}>
            <span className="text-xs text-red-400 cursor-help">ⓘ</span>
          </Tooltip>
        )}
      </div>

      <Select
        label="LLM Provider (optional)"
        value={currentProvider}
        onChange={handleProviderChange}
        options={[
          { value: '', label: 'None — keyless mode' },
          { value: 'gemini', label: 'Gemini' },
          { value: 'anthropic', label: 'Anthropic' },
          { value: 'openai', label: 'OpenAI' },
          { value: 'groq', label: 'Groq' },
          { value: 'ollama', label: 'Ollama (local)' },
        ]}
      />
      <p className="text-xs text-text-secondary -mt-2">
        Powers research/agent synthesis. Core search, fetch, crawl & cache work without any provider.
      </p>

      {currentProvider && (
        <Input
          label={apiKeyLabels[currentProvider] || 'API Key'}
          value={config?.apiKey || ''}
          onChange={handleApiKeyChange}
          placeholder={apiKeyPlaceholders[currentProvider] || ''}
          type={currentProvider === 'ollama' ? 'text' : 'password'}
        />
      )}

      <Checkbox
        label="Hybrid Search"
        description="Wider retrieval funnel — core engines plus aggregator fallback for more results."
        checked={config?.hybridSearch || false}
        onChange={handleHybridSearchChange}
      />

      <Input
        label="Command override (optional)"
        value={config?.command || ''}
        onChange={(e) => updateConfig({ ...config, command: e.target.value })}
        placeholder="Leave empty for bundled wigolo"
      />
    </div>
  );
};
