({ config, updateConfig, executeExtensionAction, ui, icons }) => {
  const { useState, useMemo } = React;
  const { Select, Input, IconButton, RadioButton } = ui;
  const FiPlay = icons.Fi.FiPlay;
  const FiRefreshCw = icons.Fi.FiRefreshCw;
  const [busyKey, setBusyKey] = useState('');
  const [error, setError] = useState('');

  const packs = config?.packs || [];
  const entries = [
    {
      key: 'agentFinished',
      label: 'Task Finished',
      value: config?.agentFinished || {
        pack: 'peasant',
        sound: 'PeasantJobDone',
      },
    },
    {
      key: 'questionAsked',
      label: 'Question Asked',
      value: config?.questionAsked || { pack: 'peasant', sound: '' },
    },
  ];
  const packOptions = useMemo(
    () => [...packs].sort((a, b) => a.displayName.localeCompare(b.displayName)).map((p) => ({ value: p.name, label: p.displayName })),
    [packs],
  );
  const sourceOptions = [
    { value: 'pack', label: 'Sound pack' },
    { value: 'custom', label: 'Custom file' },
  ];

  const getSoundsForPack = (packName) => {
    const pack = packs.find((p) => p.name === packName);
    return [
      { value: '', label: 'None' },
      ...(pack?.sounds || []).map((s) => {
        const fileName = s.file.split('/').pop();
        const name = fileName.replace(/\.(wav|mp3)$/, '');
        return { value: name, label: name };
      }),
    ];
  };

  const updateEntry = (key, changes) => {
    setError('');
    updateConfig((previous) => ({
      ...previous,
      [key]: {
        ...entries.find((entry) => entry.key === key).value,
        ...previous?.[key],
        ...changes,
      },
    }));
  };

  const handlePlay = async (entry) => {
    setError('');
    setBusyKey(entry.key);
    try {
      const result =
        entry.value.source === 'custom'
          ? await executeExtensionAction('play-custom-sound', entry.value.filePath || '')
          : await executeExtensionAction('play-sound', entry.value.pack, entry.value.sound);
      if (!result?.success) {
        setError('Could not play the sound. Check the file path, format, and installed audio players.');
      }
    } catch {
      setError('Could not play the sound. Check the file path, format, and installed audio players.');
    } finally {
      setBusyKey('');
    }
  };

  const handleUpload = async (event, key) => {
    const file = event.target.files?.[0];
    event.target.value = '';
    if (!file) return;
    setError('');
    if (!file.size || file.size > 10 * 1024 * 1024) {
      setError('Choose a non-empty audio file up to 10 MB.');
      return;
    }
    setBusyKey(key);
    try {
      const base64 = await new Promise((resolve, reject) => {
        const reader = new FileReader();
        reader.onload = () => resolve(reader.result.split(',')[1]);
        reader.onerror = () => reject(reader.error);
        reader.readAsDataURL(file);
      });
      const result = await executeExtensionAction('upload-audio', file.name, base64);
      if (!result?.success) throw new Error('Upload failed');
      updateEntry(key, { source: 'custom', filePath: result.filePath });
    } catch {
      setError('Could not upload the audio file. Check its format and try again.');
    } finally {
      setBusyKey('');
    }
  };

  const handleRefresh = async () => {
    setError('');
    setBusyKey('refresh');
    try {
      const refreshedPacks = await executeExtensionAction('refresh-packs');
      updateConfig((previous) => ({ ...previous, packs: refreshedPacks }));
    } catch {
      setError('Could not refresh sound packs.');
    } finally {
      setBusyKey('');
    }
  };

  const handleSourceChange = (entry, source) => updateEntry(entry.key, { source });
  const handlePackChange = (entry, pack) => updateEntry(entry.key, { pack, sound: '' });
  const handleSoundChange = (entry, sound) => updateEntry(entry.key, { sound });
  const handlePathChange = (entry, event) => updateEntry(entry.key, { filePath: event.target.value });

  return (
    <div className="relative flex flex-col gap-4">
      <div className="absolute top-1 right-1">
        <IconButton icon={<FiRefreshCw className="w-4 h-4" />} tooltip={'Refresh Packs'} onClick={handleRefresh} disabled={!!busyKey} />
      </div>
      {entries.map((entry) => {
        const custom = entry.value.source === 'custom';
        const handleSource = (source) => {
          if (!busyKey) handleSourceChange(entry, source);
        };
        const handlePack = (pack) => handlePackChange(entry, pack);
        const handleSound = (sound) => handleSoundChange(entry, sound);
        const handlePath = (event) => handlePathChange(entry, event);
        const handleFile = (event) => handleUpload(event, entry.key);
        const handlePreview = () => handlePlay(entry);
        return (
          <div key={entry.key} className="flex flex-col gap-2">
            <h3 className="text-sm font-semibold text-text-primary">{entry.label}</h3>
            <fieldset disabled={!!busyKey} className="flex items-center gap-4">
              {sourceOptions.map((option) => (
                <label key={option.value} htmlFor={`${entry.key}-source-${option.value}`}>
                  <RadioButton
                    id={`${entry.key}-source-${option.value}`}
                    name={`${entry.key}-source`}
                    value={option.value}
                    checked={(entry.value.source || 'pack') === option.value}
                    onChange={handleSource}
                    label={option.label}
                  />
                </label>
              ))}
            </fieldset>
            <div className="flex items-center gap-2">
              {custom ? (
                <div className="flex-1 flex flex-col gap-2">
                  <Input
                    label={'Audio file path'}
                    placeholder={'Absolute path on the machine running AiderDesk'}
                    value={entry.value.filePath || ''}
                    onChange={handlePath}
                    disabled={!!busyKey}
                  />
                  <label className="text-sm text-text-secondary flex flex-col gap-1">
                    {'Upload audio file (up to 10 MB)'}
                    <input
                      type="file"
                      accept=".wav,.mp3,.ogg,.flac,.m4a,.aac,.aiff,.aif,.opus,.wma"
                      onChange={handleFile}
                      disabled={!!busyKey}
                      className="text-xs"
                    />
                  </label>
                </div>
              ) : (
                <div className="flex-1 flex gap-2">
                  <div className="flex-1">
                    <Select label={'Sound pack'} value={entry.value.pack} onChange={handlePack} options={packOptions} disabled={!!busyKey} />
                  </div>
                  <div className="flex-1">
                    <Select
                      label={'Sound'}
                      value={entry.value.sound}
                      onChange={handleSound}
                      options={getSoundsForPack(entry.value.pack)}
                      disabled={!!busyKey}
                    />
                  </div>
                </div>
              )}
              <IconButton
                icon={<FiPlay className="w-4 h-4" />}
                tooltip={'Play'}
                onClick={handlePreview}
                disabled={!!busyKey || !(custom ? entry.value.filePath : entry.value.sound)}
                className="mt-6 ml-1"
              />
            </div>
          </div>
        );
      })}
      {busyKey && (
        <p role="status" className="text-xs text-text-secondary">
          {'Processing audio…'}
        </p>
      )}
      {error && (
        <p role="alert" className="text-sm text-error">
          {error}
        </p>
      )}
    </div>
  );
};
