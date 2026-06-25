({ data, models, providers, ui, icons, task, executeExtensionAction }) => {
  const { useCallback } = React;
  const { ModelSelector, Checkbox, IconButton } = ui;
  const Tooltip = ui.Tooltip;
  const FiPlus = icons.Fi.FiPlus;
  const FiX = icons.Fi.FiX;
  const GrMultiple = icons.Gr.GrMultiple;

  const AIDER_MODES = ["code", "ask", "architect", "context"];
  const currentMode = task?.currentMode;
  if (!currentMode || AIDER_MODES.includes(currentMode)) {
    return null;
  }

  const modelSelections = data?.models ?? [];
  const useWorktrees = data?.useWorktrees ?? true;

  const handleAddModel = useCallback(async () => {
    await executeExtensionAction("add-model");
  }, [executeExtensionAction]);

  const handleRemoveModel = useCallback(
    (index) => async () => {
      await executeExtensionAction("remove-model", index);
    },
    [executeExtensionAction],
  );

  const handleModelChange = useCallback(
    (index) => async (model) => {
      const modelId = model ? `${model.providerId}/${model.id}` : "";
      await executeExtensionAction("update-model", index, modelId);
    },
    [executeExtensionAction],
  );

  const getModelId = (modelId) => {
    if (!modelId) return undefined;
    return modelId;
  };

  const handleUseWorktreesChange = useCallback(
    async (checked) => {
      await executeExtensionAction("set-use-worktrees", checked);
    },
    [executeExtensionAction],
  );

  return (
    <div className="flex items-center gap-2 ml-3">
      {modelSelections.length > 0 && (
        <Tooltip content="Additional models">
          <GrMultiple className="w-3 h-3"/>
        </Tooltip>
      )}
      <div className="flex items-center gap-3 flex-wrap">
        {modelSelections.map((selection, index) => (
          <div key={selection.index} className="flex items-center ml-1 gap-1">
            <ModelSelector
              models={models}
              providers={providers}
              selectedModelId={getModelId(selection.modelId)}
              onChange={handleModelChange(index)}
              popupPlacement="bottom"
            />
            <Tooltip content="Remove model">
              <IconButton
                icon={<FiX className="w-3 h-3" />}
                onClick={handleRemoveModel(index)}
              />
            </Tooltip>
          </div>
        ))}
      </div>
      <IconButton
        icon={<FiPlus className="w-4 h-4" />}
        tooltip="Add model"
        onClick={handleAddModel}
        className="p-1.5 rounded-md hover:bg-bg-tertiary"
      />
      <Checkbox
        label="Use worktrees"
        checked={useWorktrees}
        onChange={handleUseWorktreesChange}
        size="xs"
      />
    </div>
  );
};
