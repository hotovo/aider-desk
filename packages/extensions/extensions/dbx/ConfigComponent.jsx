({ config, updateConfig, ui }) => {
  const { useState, useEffect, useRef } = React;
  const { Input, Select, TextArea } = ui;

  const parseDrives = (text) => text.split('\n').map((line) => line.trim()).filter(Boolean);

  const mountPathFor = (drive) => `/dbx-mounts/${drive.split('/').filter(Boolean).pop()}`;

  const [drivesValue, setDrivesValue] = useState(() => (config?.drives || []).join('\n'));
  const lastSentDrivesRef = useRef(config?.drives || []);

  const handleModeChange = (value) => {
    updateConfig({ ...config, mode: value });
  };

  const handleUrlChange = (e) => {
    updateConfig({ ...config, url: e.target.value });
  };

  const handleDrivesChange = (e) => {
    const raw = e.target.value;
    const drives = parseDrives(raw);
    setDrivesValue(raw);
    lastSentDrivesRef.current = drives;
    updateConfig({ ...config, drives });
  };

  useEffect(() => {
    const drives = config?.drives || [];
    if (JSON.stringify(drives) === JSON.stringify(lastSentDrivesRef.current)) {
      return;
    }
    lastSentDrivesRef.current = drives;
    setDrivesValue(drives.join('\n'));
  }, [config?.drives]);

  return (
    <div className="flex flex-col gap-4">
      <Select
        label="Source"
        value={config?.mode || 'docker'}
        onChange={handleModeChange}
        options={[
          { value: 'docker', label: 'Docker (auto-start DBX container)' },
          { value: 'url', label: 'Existing DBX Web instance' },
        ]}
      />
      <p className="text-xs text-text-secondary -mt-2">
        {config?.mode === 'docker'
          ? 'Automatically starts a DBX container via testcontainers. Requires Docker to be installed and running. Connection data is persisted in the extension state folder.'
          : 'Connect to an already running DBX Web instance (Docker deployment or dbx-web backend).'}
      </p>
      {config?.mode === 'url' && (
        <Input
          label="DBX Web URL"
          value={config?.url || ''}
          onChange={handleUrlChange}
          placeholder="http://localhost:4224"
        />
      )}
      {config?.mode === 'docker' && (
        <TextArea
          label="Drives (host folders mounted into the container)"
          value={drivesValue}
          onChange={handleDrivesChange}
          placeholder={'/home/you/projects\n/mnt/data/dbfiles\n(one absolute folder path per line)'}
          rows={3}
        />
      )}
      {config?.mode === 'docker' && parseDrives(drivesValue).length > 0 && (
        <div className="-mt-2">
          <p className="text-xs text-text-secondary mb-1">These lines will be mounted at:</p>
          <div className="flex flex-col gap-0.5">
            {parseDrives(drivesValue).map((drive, index) => (
              <code
                key={index}
                className="text-xs text-text-primary bg-bg-secondary-light border border-border-default rounded px-2 py-1 w-fit font-mono select-text"
              >
                {mountPathFor(drive)}
              </code>
            ))}
          </div>
        </div>
      )}
      {config?.mode === 'docker' && (
        <p className="text-xs text-text-secondary -mt-2">
          Mounted folders let you open local SQLite (and similar file-based) databases from the panel: add a connection and
          use the path <code>/dbx-mounts/&lt;folder-name&gt;/my.db</code>. Mounting a folder requires restarting the
          container (it happens automatically after saving). Opening local folders with the built-in folder browser remains
          a DBX desktop-only feature — inside the container SQL files can be opened by drag &amp; drop or via an absolute
          mounted path.
        </p>
      )}
      <p className="text-xs text-text-muted">
        DBX Web may ask you to set an admin password on first use inside the panel. Connections you create are stored in the
        DBX instance itself.
      </p>
    </div>
  );
}
