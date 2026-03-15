({ data, models, providers, ui, executeExtensionAction }) => {
  const { useState, useEffect, useCallback } = React;
  const { Button, ModelSelector, IconButton, Checkbox } = ui;

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
    <div className="flex flex-col gap-2 pb-2 w-full">
      <div className="flex gap-4 w-full justify-between items-center">
        <div className="flex items-center gap-2 flex-wrap">
          {modelSelections.map((selection, index) => (
            <div key={selection.index} className="flex items-center gap-1">
              <ModelSelector
                models={models}
                providers={providers}
                selectedModelId={getModelId(selection.modelId)}
                onChange={handleModelChange(index)}
                popupPlacement="top"
              />
              <button
                onClick={handleRemoveModel(index)}
                className="text-text-muted hover:text-text-primary text-sm p-1.5"
                title="Remove model"
              >
                ×
              </button>
            </div>
          ))}
        </div>
        <div className="flex flex-shrink-0 gap-2 items-center">
          <Checkbox
            label="Use worktrees"
            checked={useWorktrees}
            onChange={handleUseWorktreesChange}
            size="xs"
          />
          <Button
            variant="outline"
            color="tertiary"
            size="xs"
            onClick={handleAddModel}
          >
            + Add model
          </Button>
        </div>
      </div>
    </div>
  );
};
