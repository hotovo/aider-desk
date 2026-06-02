({ config, updateConfig, ui }) => {
  const { Input, Checkbox } = ui;

  return (
    <div className="flex flex-col gap-4">
      <Input
        label="Server URL"
        value={config?.serverUrl || ''}
        onChange={(e) => updateConfig({ ...config, serverUrl: e.target.value })}
        placeholder="http://127.0.0.1:43190"
      />
      <p className="text-xs text-text-secondary -mt-2">
        URL of the pi-agent-observability server to send events to.
      </p>

      <Input
        label="Auth Token"
        value={config?.authToken || ''}
        onChange={(e) => updateConfig({ ...config, authToken: e.target.value })}
        placeholder="Bearer token for server authentication"
        type="password"
      />
      <p className="text-xs text-text-secondary -mt-2">
        Must match the OBS_AUTH_TOKEN set on the observability server.
      </p>

      <Input
        label="Pool"
        value={config?.pool || ''}
        onChange={(e) => updateConfig({ ...config, pool: e.target.value })}
        placeholder="default"
      />
      <p className="text-xs text-text-secondary -mt-2">
        Logical pool name for grouping sessions in the observability UI.
      </p>

      <Input
        label="Tags (comma-separated)"
        value={config?.tags || ''}
        onChange={(e) => updateConfig({ ...config, tags: e.target.value })}
        placeholder="e.g. team-alpha, experiment-1"
      />

      <Input
        label="Agent Name"
        value={config?.agentName || ''}
        onChange={(e) => updateConfig({ ...config, agentName: e.target.value })}
        placeholder="Optional friendly name for the agent"
      />

      <Checkbox
        label="Disable observability"
        checked={config?.disabled ?? false}
        onChange={(checked) => updateConfig({ ...config, disabled: checked })}
      />
      <p className="text-xs text-text-secondary -mt-2">
        When enabled, no events will be sent to the observability server.
      </p>
    </div>
  );
};
