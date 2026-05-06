({ config, updateConfig, ui }) => {
  const { Input } = ui;

  return (
    <div className="flex flex-col gap-4">
      <Input
        label="Skill Folders"
        value={config?.skillFolders || ''}
        onChange={(e) => updateConfig({ ...config, skillFolders: e.target.value })}
        placeholder=".claude/skills,.cursor/skills"
      />
      <p className="text-xs text-text-secondary -mt-2">
        Comma-separated folder paths relative to project root. Each folder is scanned for subdirectories containing SKILL.md files.
      </p>
    </div>
  );
};
