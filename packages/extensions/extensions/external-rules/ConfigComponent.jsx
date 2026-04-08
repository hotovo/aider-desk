({ config, updateConfig, ui }) => {
  const { Input } = ui;

  return (
    <div className="flex flex-col gap-4">
      <Input
        label="Rule Folders"
        value={config?.ruleFolders || ''}
        onChange={(e) => updateConfig({ ...config, ruleFolders: e.target.value })}
        placeholder=".cursor/rules,.roo/rules,CLAUDE.md"
      />
      <p className="text-xs text-text-secondary -mt-2">
        Comma-separated folder paths relative to project root. Scanned in addition to built-in sources (.cursor/rules, .roo/rules, CLAUDE.md).
      </p>
    </div>
  );
};
