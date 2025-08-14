# EditFormatSelector Component PRD

## Purpose
Add a new EditFormatSelector component to allow users to choose the edit format for code changes, similar to the existing ModelSelector. This will be integrated with the backend to persist settings and communicate format changes to the Aider process.

## User Stories
1. As a developer, I want to choose between different code edit formats (diff, whole, etc.)
2. As a user, I want my edit format preference to persist between sessions
3. As a contributor, I want to see visual feedback when changing edit formats

## Features
1. Dropdown selector showing available edit formats
2. Current format display with arrow icon
3. Integration with:
   - Project settings persistence
   - Connector communication
   - Real-time format updates in the UI

## Technical Implementation

### 1. Component Structure
```tsx
// src/renderer/src/components/EditFormatSelector.tsx
import { EditFormat } from '@common/types';

type Props = {
  currentFormat: EditFormat;
  onFormatChange: (format: EditFormat) => void;
};

const EditFormatSelector = ({ currentFormat, onFormatChange }: Props) => {
  // Implementation similar to ModelSelector
  // with format options from EditFormat enum
};
```

### 2. UI Integration
Add EditFormatSelector to ProjectBar after Weak model selector:
```tsx
// src/renderer/src/components/project/ProjectBar.tsx
<div className="flex items-center space-x-1">
  <BsFilter className="w-4 h-4 text-text-primary mr-1" />
  <EditFormatSelector
    currentFormat={modelsData.editFormat || 'diff'}
    onFormatChange={(format) => runCommand(`set-edit-format ${format}`)}
  />
</div>
```

### 3. API Changes
Add new API function to update edit format:
```ts
// src/preload/index.ts
updateEditFormat: (baseDir: string, format: EditFormat) => ipcRenderer.send('update-edit-format', baseDir, format)
```

### 4. IPC Handlers
Add handler to process edit format updates:
```ts
// src/main/ipc-handlers.ts
ipcMain.on('update-edit-format', (_, baseDir: string, format: EditFormat) => {
  const projectSettings = store.getProjectSettings(baseDir);
  projectSettings.editFormat = format;
  store.saveProjectSettings(baseDir, projectSettings);
  projectManager.getProject(baseDir).updateModels(
    projectSettings.mainModel,
    projectSettings.weakModel,
    format
  );
});
```

### 5. Project Model Updates
Add editFormat parameter to updateModels:
```ts
// src/main/project.ts
public updateModels(
  mainModel: string,
  weakModel: string | null,
  editFormat?: EditFormat
) {
  logger.info('Updating models:', {
    mainModel,
    weakModel,
    editFormat
  });
  this.findMessageConnectors('set-models').forEach((connector) =>
    connector.sendSetModelsMessage(mainModel, weakModel, editFormat)
  );
}
```

### 6. Connector Communication
Update set-models message to include editFormat:
```py
# resources/connector/connector.py
elif action == "set-models":
  main_model = message.get('mainModel')
  weak_model = message.get('weakModel')
  edit_format = message.get('editFormat')
  if not main_model:
    return

  if not edit_format:
    edit_format = main_model.edit_format

  model = models.Model(main_model, weak_model=weak_model)
  models.sanity_check_models(self.coder.io, model)

  self.coder = Coder.create(
    from_coder=self.coder,
    main_model=model,
    edit_format=edit_format
  )
```

### 7. Type Definitions
Ensure EditFormat is properly exported:
```ts
// src/common/types.ts
export type EditFormat = 'diff' | 'diff-fenced' | 'whole' | 'udiff' | 'udiff-simple' | 'patch';
```

## Success Criteria
1. User can select different edit formats from the UI
2. Format changes persist in project settings
3. Selected format is used for code edits
4. Format selector updates automatically when settings change
5. Format changes are reflected in both Aider and Agent modes
