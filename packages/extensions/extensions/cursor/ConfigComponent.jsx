({ config, updateConfig, ui }) => {
  const { Input, Select, Checkbox } = ui;

  const handleApiKeyChange = (e) => {
    updateConfig({ ...config, apiKey: e.target.value });
  };

  const handleNativeToolsModeChange = (value) => {
    updateConfig({ ...config, nativeToolsMode: value });
  };

  const handleMaxModeChange = (checked) => {
    updateConfig({ ...config, maxMode: checked });
  };

  const handleFastChange = (checked) => {
    updateConfig({ ...config, fast: checked });
  };

  const handleThinkingChange = (checked) => {
    updateConfig({ ...config, thinking: checked });
  };

  const handleMaxRetriesChange = (value) => {
    updateConfig({ ...config, maxRetries: parseInt(value, 10) });
  };

  return (
    <div className="flex flex-col gap-4">
      <Input
        label="Cursor API Key"
        type="password"
        value={config?.apiKey || ''}
        onChange={handleApiKeyChange}
        placeholder="cursor_..."
      />
      <p className="text-xs text-text-secondary -mt-2">
        Get your key from{' '}
        <a href="https://cursor.com/dashboard" target="_blank" rel="noopener noreferrer" className="underline">
          cursor.com/dashboard
        </a>
        . Falls back to CURSOR_API_KEY env var if empty.
      </p>

      <Select
        label="Native Tools Mode"
        value={config?.nativeToolsMode || 'reject'}
        onChange={handleNativeToolsModeChange}
        options={[
          { label: 'Reject (use AiderDesk tools only)', value: 'reject' },
          { label: 'Redirect (route to AiderDesk tools)', value: 'redirect' },
          { label: 'Native (execute in proxy)', value: 'native' },
        ]}
      />
      <div className="flex flex-col gap-1 -mt-2">
        <p className="text-xs text-text-secondary">
          <strong>Reject</strong>: Cursor's native tools are rejected. Only AiderDesk's tools are available with full approval control.
        </p>
        <p className="text-xs text-text-secondary">
          <strong>Redirect</strong>: Cursor's native tools are redirected to AiderDesk's power tools. Tools execute through AiderDesk with approval.
        </p>
        <p className="text-xs text-text-secondary">
          <strong>Native</strong>: Proxy executes tools locally with path sandboxing. Fastest but no AiderDesk approval.
        </p>
      </div>

      <Checkbox
        label="Max Mode (larger context window)"
        checked={config?.maxMode || false}
        onChange={handleMaxModeChange}
      />

      <Checkbox
        label="Fast Mode"
        checked={config?.fast || false}
        onChange={handleFastChange}
      />

      <Checkbox
        label="Thinking (reasoning/deliberation)"
        checked={config?.thinking !== undefined ? config.thinking : true}
        onChange={handleThinkingChange}
      />

      <Select
        label="Max Retries"
        value={String(config?.maxRetries ?? 2)}
        onChange={handleMaxRetriesChange}
        options={[
          { label: '0 (no retries)', value: '0' },
          { label: '1', value: '1' },
          { label: '2', value: '2' },
          { label: '3', value: '3' },
          { label: '5', value: '5' },
        ]}
      />
      <p className="text-xs text-text-secondary -mt-2">
        Maximum retry attempts for transient failures (blob not found, resource exhausted, timeout).
      </p>
    </div>
  );
};
