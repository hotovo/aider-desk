({ config, updateConfig, executeExtensionAction, ui, icons }) => {
  const { useState, useCallback, useMemo } = React;
  const { Select, IconButton, Checkbox, Slider } = ui;
  const FiPlay = icons.Fi.FiPlay;
  const FiRefreshCw = icons.Fi.FiRefreshCw;
  const FiVolume2 = icons.Fi.FiVolume2;

  const packs = config?.packs || [];
  const agentFinished = config?.agentFinished || { pack: 'peasant', sound: 'PeasantJobDone' };
  const questionAsked = config?.questionAsked || { pack: 'peasant', sound: '' };
  const delivery = config?.delivery || 'local';
  const browser = config?.browser || {};
  const browserVolume = typeof browser.volume === 'number' ? browser.volume : 0.5;
  const browserKinds = {
    'task-finished': true,
    'input-needed': true,
    generic: false,
    ...(browser.kinds || {}),
  };
  const browserPresets = {
    'task-finished': 'bell',
    'input-needed': 'ding',
    generic: 'chime',
    ...(browser.presets || {}),
  };

  const updateBrowser = (patch) => {
    updateConfig({
      ...config,
      browser: { ...browser, ...patch },
    });
  };

  const executeAction = useCallback(
    async (action, ...args) => {
      return await executeExtensionAction(action, ...args);
    },
    [executeExtensionAction],
  );

  const packOptions = useMemo(
    () => [...packs].sort((a, b) => a.displayName.localeCompare(b.displayName)).map((p) => ({ value: p.name, label: p.displayName })),
    [packs],
  );

  const getSoundsForPack = useCallback(
    (packName) => {
      const pack = packs.find((p) => p.name === packName);
      if (!pack) return [{ value: '', label: 'None' }];
      return [
        { value: '', label: 'None' },
        ...pack.sounds.map((s) => {
          const fileName = s.file.split('/').pop();
          const nameWithoutExt = fileName.replace(/\.(wav|mp3)$/, '');
          return { value: nameWithoutExt, label: nameWithoutExt };
        }),
      ];
    },
    [packs],
  );

  const finishedSounds = useMemo(() => getSoundsForPack(agentFinished.pack), [agentFinished.pack, getSoundsForPack]);
  const questionSounds = useMemo(() => getSoundsForPack(questionAsked.pack), [questionAsked.pack, getSoundsForPack]);

  const handlePackChange = (newPack, setterKey, otherKey) => {
    const newSounds = getSoundsForPack(newPack);
    const firstSound = newSounds.length > 0 ? newSounds[0].value : '';
    updateConfig({
      ...config,
      [setterKey]: { pack: newPack, sound: firstSound },
      [otherKey]: config?.[otherKey],
    });
  };

  const handleSoundChange = (sound, key) => {
    const selectedPack = config?.[key]?.pack || 'peasant';
    updateConfig({
      ...config,
      [key]: { pack: selectedPack, sound },
    });
  };

  const handlePlay = (eventKey) => {
    const entry = config?.[eventKey];
    if (entry) {
      executeAction('play-sound', entry.pack, entry.sound);
    }
  };

  const handleRefresh = () => {
    executeAction('refresh-packs');
  };

  const deliveryOptions = [
    { value: 'local', label: 'Local (OS player on AiderDesk host)' },
    { value: 'browser', label: 'Remote browser (open tab required)' },
    { value: 'both', label: 'Both local and remote browser' },
  ];

  const presetOptions = [
    { value: 'bell', label: 'Bell' },
    { value: 'ding', label: 'Ding' },
    { value: 'chime', label: 'Chime' },
    { value: 'soft', label: 'Soft' },
    { value: 'none', label: 'Silent' },
  ];

  const browserKindRows = [
    { key: 'task-finished', label: 'Task finished' },
    { key: 'input-needed', label: 'Input needed' },
    { key: 'generic', label: 'Other' },
  ];

  return (
    <div className="relative flex flex-col gap-4">
      <div className="absolute top-1 right-1">
        <IconButton
          icon={<FiRefreshCw className="w-4 h-4" />}
          tooltip="Refresh Packs"
          onClick={handleRefresh}
        />
      </div>

      <div className="flex flex-col gap-2">
        <h3 className="text-sm font-semibold text-text-primary">Delivery</h3>
        <div className="flex-1 max-w-md">
          <Select
            label="Delivery Mode"
            value={delivery}
            onChange={(value) => updateConfig({ ...config, delivery: value })}
            options={deliveryOptions}
          />
        </div>

        <div className="flex flex-col gap-2 pl-1">
          <div className="flex items-center gap-2 max-w-md">
            <FiVolume2 className="w-4 h-4 text-text-secondary" />
            <div className="flex-1">
              <Slider
                label="Browser sound volume"
                min={0}
                max={100}
                step={1}
                value={Math.round(browserVolume * 100)}
                onChange={(value) => updateBrowser({ volume: (Number(value) || 0) / 100 })}
                formatValue={(value) => `${value}%`}
              />
            </div>
          </div>

          {browserKindRows.map((row) => (
            <div key={row.key} className="flex items-center gap-3">
              <div className="w-28 shrink-0">
                <Checkbox
                  label={row.label}
                  size="xs"
                  checked={!!browserKinds[row.key]}
                  onChange={(checked) => updateBrowser({ kinds: { ...browserKinds, [row.key]: checked } })}
                />
              </div>
              <div className="flex-1 max-w-48">
                <Select
                  value={browserPresets[row.key] || 'chime'}
                  onChange={(value) => updateBrowser({ presets: { ...browserPresets, [row.key]: value } })}
                  options={presetOptions}
                />
              </div>
            </div>
          ))}
        </div>

        <div className="text-2xs text-text-muted">
          Remote browser sounds are synthesized via Web Audio in each open AiderDesk tab after the
          user clicks "Enable sounds" in the Remote Sounds panel (browsers only allow audio after a
          user gesture). Multiple tabs elect a single primary tab, so each notification normally chimes in one tab (rare duplicates are possible when the primary lock expires or a tab disappears).
        </div>
      </div>

      <div className="flex flex-col gap-1">
        <h3 className="text-sm font-semibold text-text-primary">Task Finished</h3>
        <div className="flex items-center gap-2">
          <div className="flex-1">
            <Select
              label="Sound Pack"
              value={agentFinished.pack}
              onChange={(e) => handlePackChange(e, 'agentFinished', 'questionAsked')}
              options={packOptions}
            />
          </div>
          <div className="flex-1">
            <Select
              label="Sound"
              value={agentFinished.sound}
              onChange={(e) => handleSoundChange(e, 'agentFinished')}
              options={finishedSounds}
            />
          </div>
          <IconButton
            icon={<FiPlay className="w-4 h-4" />}
            tooltip="Play"
            onClick={() => handlePlay('agentFinished')}
            className="mt-6 ml-1"
          />
        </div>
      </div>

      <div className="flex flex-col gap-1">
        <h3 className="text-sm font-semibold text-text-primary">Question Asked</h3>
        <div className="flex items-center gap-2">
          <div className="flex-1">
            <Select
              label="Sound Pack"
              value={questionAsked.pack}
              onChange={(e) => handlePackChange(e, 'questionAsked', 'agentFinished')}
              options={packOptions}
            />
          </div>
          <div className="flex-1">
            <Select
              label="Sound"
              value={questionAsked.sound}
              onChange={(e) => handleSoundChange(e, 'questionAsked')}
              options={questionSounds}
            />
          </div>
          <IconButton
            icon={<FiPlay className="w-4 h-4" />}
            tooltip="Play"
            onClick={() => handlePlay('questionAsked')}
            className="mt-6 ml-1"
          />
        </div>
      </div>
    </div>
  );
};
