({ config, updateConfig, ui }) => {
  const { Input, Checkbox } = ui;

  return (
    <div className="flex flex-col gap-4">
      <Input
        label="Server Host / Base URL"
        value={config?.host || ''}
        onChange={(e) => updateConfig({ ...config, host: e.target.value })}
        placeholder="localhost (or 192.168.1.5 / https://plannotator.example.com)"
      />
      <p className="text-xs text-text-secondary -mt-2">
        The hostname (or full origin, e.g. <code>https://plannotator.example.com</code>) the browser uses to reach this AiderDesk server. Leave blank to default to localhost. Required when AiderDesk runs as a remote/headless server so the plan/code review UI is reachable.
      </p>
      <Checkbox
        label="Use browser-based review"
        checked={config?.browserReview === true}
        onChange={(checked) => updateConfig({ ...config, browserReview: checked })}
      />
      <p className="text-xs text-text-secondary -mt-2">
        When enabled, plan and code reviews open in a separate browser/overlay window via the local HTTP server. When disabled (recommended for headless/server setups where a browser cannot be opened), reviews render inline in the AiderDesk chat.
      </p>
    </div>
  );
};
