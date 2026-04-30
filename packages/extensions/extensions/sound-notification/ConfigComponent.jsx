({ config, updateConfig, executeExtensionAction, ui, icons }) => {
  const { useState, useCallback, useMemo } = React;
  const { Select, IconButton } = ui;
  const FiPlay = icons.Fi.FiPlay;
  const FiRefreshCw = icons.Fi.FiRefreshCw;

  const packs = config?.packs || [];
  const agentFinished = config?.agentFinished || { pack: 'peasant', sound: 'PeasantJobDone' };
  const questionAsked = config?.questionAsked || { pack: 'peasant', sound: '' };

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

  return (
    <div className="relative flex flex-col gap-4">
      <div className="absolute top-1 right-1">
        <IconButton
          icon={<FiRefreshCw className="w-4 h-4" />}
          tooltip="Refresh Packs"
          onClick={handleRefresh}
        />
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
