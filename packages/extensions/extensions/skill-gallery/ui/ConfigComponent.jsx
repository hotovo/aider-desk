({ config, updateConfig, ui }) => {
  const { TextArea } = ui;

  return (
    <div className="flex flex-col gap-4">
      <TextArea
        label="Custom Skill Source Repositories"
        value={config?.customSources || ''}
        onChange={(e) => updateConfig({ ...config, customSources: e.target.value })}
        placeholder={"https://github.com/user/skills-repo\nhttps://github.com/user/another-repo|skills"}
        rows={4}
      />
      <div className="space-y-1 text-xs text-text-secondary">
        <p>One GitHub repository URL per line. Each repository is scanned for directories containing SKILL.md files.</p>
        <p>
          Use <code className="px-1 py-0.5 rounded bg-bg-tertiary text-2xs">|</code> to specify a subdirectory:{' '}
          <code className="px-1 py-0.5 rounded bg-bg-tertiary text-2xs">https://github.com/user/repo|skills</code>
        </p>
        <p>Default sources (Anthropic Official Skills and Awesome Claude Skills) are always included.</p>
      </div>
    </div>
  );
};
