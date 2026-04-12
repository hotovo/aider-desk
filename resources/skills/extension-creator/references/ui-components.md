# UI Components Reference

This document describes how to create UI extensions that add React components to the AiderDesk interface.

## Overview

UI extensions allow you to add custom React components to various locations in the AiderDesk interface. Components are defined as JSX/TSX strings and rendered using the `string-to-react-component` library.

## Registering UI Components

Implement the `getUIComponents()` method to return an array of UI component definitions:

```typescript
getUIComponents(context: ExtensionContext): UIComponentDefinition[] {
  return [{
    id: 'my-component',
    placement: 'task-status-bar-right',
    jsx: `({ data, task }) => {
      return <div>Task: {task.name}</div>;
    }`,
    loadData: true,
    noDataCache: false,
  }];
}
```

### UIComponentDefinition Properties

- **id** (string, required): Unique identifier for the component
- **placement** (UIComponentPlacement, required): Where to render the component
- **jsx** (string, required): JSX/TSX component code as a string
- **loadData** (boolean, optional): Whether to load data via `getUIExtensionData()` (default: false)
- **noDataCache** (boolean, optional): Always fetch fresh data on render (default: false)

## Available Placements

UI components can be placed in various locations throughout the AiderDesk interface. Each placement has specific characteristics and recommended use cases.

### Task Page - Top Section

- **task-status-bar-left**: Left side of the task status bar (very top of task page)
  - *Use for*: Task-level status indicators, breadcrumbs
  - *Layout*: Horizontal row, left-aligned

- **task-status-bar-right**: Right side of the task status bar
  - *Use for*: Quick actions, global task settings
  - *Layout*: Horizontal row, right-aligned

- **task-top-bar-left**: Left side of task top bar (just above chat messages)
  - *Use for*: Context information, file indicators
  - *Layout*: Horizontal row, left-aligned

- **task-top-bar-right**: Right side of task top bar
  - *Use for*: View controls, filters
  - *Layout*: Horizontal row, right-aligned

### Task Page - Messages Area

- **task-messages-top**: Above all messages in the chat
  - *Use for*: Warnings, announcements, persistent information
  - *Layout*: Full width, vertical stack
  - *Note*: Appears once per task

- **task-messages-bottom**: Below all messages in the chat
  - *Use for*: Summary information, pagination
  - *Layout*: Full width, vertical stack
  - *Note*: Appears once per task

- **task-message-above**: Above each individual message
  - *Use for*: Message metadata, timestamps, labels
  - *Layout*: Full message width, per-message
  - *Props*: Includes `message` prop with current message data

- **task-message-below**: Below each individual message
  - *Use for*: Message-specific actions, reactions, metrics
  - *Layout*: Full message width, per-message
  - *Props*: Includes `message` prop with current message data

- **task-message-bar**: In the message action bar (right side, appears on hover)
  - *Use for*: Quick actions on specific messages (copy, edit, delete)
  - *Layout*: Inline with other message actions
  - *Props*: Includes `message` prop with current message data

### Task Page - Usage Info

- **task-usage-info-bottom**: Below the usage info section (tokens, costs display)
  - *Use for*: Additional metrics, statistics, performance data
  - *Layout*: Full width within usage info card
  - *Note*: Only visible when usage info is shown

### Task Page - Input Area

- **task-input-above**: Above the input field
  - *Use for*: Context selectors, mode switchers, warnings
  - *Layout*: Full width above input
  - *Example*: Multi-model selector, context warnings

- **task-input-toolbar-left**: Left side of input toolbar (below input field)
  - *Use for*: Input-related actions, toggles
  - *Layout*: Horizontal row, left side of toolbar

- **task-input-toolbar-right**: Right side of input toolbar
  - *Use for*: Secondary actions, settings
  - *Layout*: Horizontal row, right side of toolbar

### Task Page - State Actions

- **task-state-actions**: Task state action buttons (when task is stopped/waiting)
  - *Use for*: Actions available when task is not running
  - *Layout*: Horizontal row with other state actions
  - *Note*: Only visible when task is stopped or waiting

- **task-state-actions-all**: Task state action buttons (visible in all states)
  - *Use for*: Actions available regardless of task state
  - *Layout*: Horizontal row with other state actions
  - *Note*: Always visible

### Sidebar Placements

- **tasks-sidebar-header**: Header of the tasks sidebar (left panel)
  - *Use for*: Sidebar controls, filters, project actions
  - *Layout*: Full sidebar width at top

- **tasks-sidebar-bottom**: Bottom of the tasks sidebar
  - *Use for*: Persistent sidebar actions, status
  - *Layout*: Full sidebar width at bottom

### Global Placements

- **header-left**: Left side of the main application header
  - *Use for*: Global navigation, branding
  - *Layout*: Horizontal row, left side of header

- **header-right**: Right side of the main application header
  - *Use for*: Global actions, user menu, settings
  - *Layout*: Horizontal row, right side of header

- **welcome-page**: Full welcome page (when no task is open)
  - *Use for*: Onboarding, workflow selection, project setup
  - *Layout*: Full page layout
  - *Note*: Replaces default welcome screen entirely

## Component Props

All UI components receive these props via the `data` prop passed by `string-to-react-component`.

**Note:** The `React` object is globally available within components (not passed as a prop). Access hooks via `React.useState`, `React.useEffect`, etc.

### Core Props

```typescript
{
  // Current task data (may be undefined)
  task?: TaskData,
  
  // Current project directory
  projectDir?: string,
  
  // Current agent profile
  agentProfile?: AgentProfile,
  
  // Available models
  models: Model[],
  
  // Available providers
  providers: ProviderProfile[],
  
  // Application API reference
  api: ApplicationAPI,
  
  // Current mode string
  mode: string,
  
  // UI component library
  ui: UIComponents,
  
  // React Icons library (organized by icon set)
  icons: {
    Ai: { ... },  // Ant Design Icons
    Bi: { ... },  // BoxIcons
    Bs: { ... },  // Bootstrap Icons
    Cg: { ... },  // css.gg
    Ci: { ... },  // Coolicons
    Di: { ... },  // Devicons
    Fa: { ... },  // Font Awesome 5
    Fc: { ... },  // Flat Color Icons
    Fi: { ... },  // Feather
    Gi: { ... },  // Game Icons
    Go: { ... },  // Github Octicons
    Gr: { ... },  // Grommet Icons
    Hi: { ... },  // Heroicons
    Im: { ... },  // IcoMoon Free
    Io5: { ... }, // Ionicons 5
    Lu: { ... },  // Lucide
    Md: { ... },  // Material Design Icons
    Pi: { ... },  // Phosphor Icons
    Ri: { ... },  // Remix Icon
    Rx: { ... },  // Radix Icons
    Si: { ... },  // Simple Icons
    Sl: { ... },  // Simple Line Icons
    Tb: { ... },  // Tabler Icons
    Tfi: { ... }, // Themify Icons
    Ti: { ... },  // Typicons
    Vsc: { ... }, // VS Code Icons
    Wi: { ... },  // Weather Icons
  },
  
  // Extension action executor
  executeExtensionAction: (action: string, ...args: unknown[]) => Promise<unknown>,
  
  // Data returned from getUIExtensionData() (if loadData: true)
  data?: unknown,
}
```

### Message-Specific Props

For components placed in `task-message-above`, `task-message-below`, or `task-message-bar`:

```typescript
{
  // All core props above, plus:
  
  // The message being rendered
  message: MessageData,
}
```

## Available UI Components

The `ui` prop provides pre-built AiderDesk components:

### Button
```jsx
<ui.Button 
  onClick={handleClick}
  variant="solid" // or "outline"
  color="primary" // or "secondary", "tertiary", "danger"
  size="sm" // or "xs", "md", "lg"
  disabled={false}
>
  Click me
</ui.Button>
```

### IconButton
```jsx
<ui.IconButton 
  onClick={handleClick}
  title="Click me"
  size="sm"
  disabled={false}
>
  <FiSettings className="w-4 h-4" />
</ui.IconButton>
```

### Checkbox
```jsx
<ui.Checkbox 
  label="Enable feature"
  checked={isChecked}
  onChange={handleChange}
  size="sm" // or "xs", "md"
/>
```

### RadioButton
```jsx
<ui.RadioButton 
  name="option"
  value="value1"
  checked={selectedValue === 'value1'}
  onChange={handleChange}
  label="Option 1"
/>
```

### Input
```jsx
<ui.Input 
  value={text}
  onChange={handleChange}
  placeholder="Enter text"
  type="text" // or "password", "email", "number"
  disabled={false}
/>
```

### TextArea
```jsx
<ui.TextArea 
  value={text}
  onChange={handleChange}
  placeholder="Enter text"
  rows={4}
/>
```

### Select
```jsx
<ui.Select 
  value={selectedValue}
  onChange={handleChange}
  options={[
    { value: 'opt1', label: 'Option 1' },
    { value: 'opt2', label: 'Option 2' },
  ]}
/>
```

### MultiSelect
```jsx
<ui.MultiSelect 
  value={selectedValues}
  onChange={handleChange}
  options={[
    { value: 'opt1', label: 'Option 1' },
    { value: 'opt2', label: 'Option 2' },
  ]}
/>
```

### ModelSelector
```jsx
<ui.ModelSelector 
  models={models}
  providers={providers}
  selectedModelId={modelId}
  onChange={handleModelChange}
  popupPlacement="top" // or "bottom"
/>
```

### Slider
```jsx
<ui.Slider 
  value={sliderValue}
  onChange={handleChange}
  min={0}
  max={100}
  step={1}
/>
```

### DatePicker
```jsx
<ui.DatePicker 
  value={dateValue}
  onChange={handleChange}
/>
```

### Chip
```jsx
<ui.Chip 
  label="Feature"
  color="primary" // or "secondary", "success", "warning", "error"
  size="sm"
  onDelete={handleDelete} // Optional
/>
```

### Tooltip
```jsx
<ui.Tooltip content="Helpful tooltip text">
  <button>Hover me</button>
</ui.Tooltip>
```

### LoadingOverlay
```jsx
<ui.LoadingOverlay message="Loading..." />
```

### ConfirmDialog
```jsx
<ui.ConfirmDialog
  title="Confirm Action"
  onConfirm={handleConfirm}
  onCancel={handleCancel}
  confirmButtonText="Confirm"
  confirmButtonColor="danger"
  disabled={false}
>
  <p>Are you sure you want to do this?</p>
</ui.ConfirmDialog>
```

## Using React

The `React` object is globally available in all components (provided by `string-to-react-component`):

```jsx
(props) => {
  // Access React hooks directly from the React object
  const { useState, useEffect, useCallback, useMemo } = React;
  
  const [count, setCount] = useState(0);
  
  const handleClick = useCallback(() => {
    setCount(count + 1);
  }, [count]);
  
  return <button onClick={handleClick}>Count: {count}</button>;
}
```

## Using React Icons

The `icons` prop provides access to all react-icons libraries:

```jsx
({ icons }) => {
  // Import icons from different sets
  const FiSettings = icons.Fi.FiSettings;
  const HiCheck = icons.Hi.HiCheck;
  const CgSpinner = icons.Cg.CgSpinner;
  
  return (
    <div>
      <FiSettings className="w-4 h-4" />
      <HiCheck className="w-5 h-5 text-success" />
      <CgSpinner className="w-4 h-4 animate-spin" />
    </div>
  );
}
```

## Providing Data to Components

When `loadData: true`, implement `getUIExtensionData()`:

```typescript
async getUIExtensionData(
  componentId: string, 
  context: ExtensionContext
): Promise<unknown> {
  if (componentId === 'my-component') {
    return {
      count: this.messageCount,
      status: this.currentStatus,
    };
  }
  return undefined;
}
```

The data is passed to the component as the `data` prop.

### Data Caching

- **Default**: Data is cached and reused on subsequent renders
- **noDataCache: true**: Fresh data is fetched on every render
- Use `context.triggerUIDataRefresh(componentId)` to manually refresh data

## Handling Component Actions

Implement `executeUIExtensionAction()` to handle actions from components:

```typescript
async executeUIExtensionAction(
  componentId: string,
  action: string,
  args: unknown[],
  context: ExtensionContext
): Promise<unknown> {
  if (componentId === 'my-component') {
    if (action === 'increment') {
      this.count++;
      context.triggerUIDataRefresh('my-component');
      return { success: true };
    }
  }
  return undefined;
}
```

Call from component via `executeExtensionAction`:

```jsx
({ executeExtensionAction }) => {
  const handleClick = async () => {
    const result = await executeExtensionAction('increment');
    console.log(result);
  };
  
  return <button onClick={handleClick}>Increment</button>;
}
```

## Triggering UI Updates

### Refresh Component Data

```typescript
// Refresh specific component
context.triggerUIDataRefresh('my-component');

// Refresh specific component for specific task
context.triggerUIDataRefresh('my-component', taskId);

// Refresh all components from this extension
context.triggerUIDataRefresh();
```

### Reload Component Definitions

```typescript
// Reload all components (e.g., when settings change)
context.triggerUIComponentsReload();
```

## Loading JSX from External Files

For larger components, separate JSX into .jsx files:

```typescript
import { readFileSync } from 'fs';
import { join } from 'path';

getUIComponents(context: ExtensionContext): UIComponentDefinition[] {
  const jsx = readFileSync(join(__dirname, './MyComponent.jsx'), 'utf-8');
  
  return [{
    id: 'my-component',
    placement: 'task-status-bar-right',
    jsx,
    loadData: true,
  }];
}
```

**MyComponent.jsx:**
```jsx
({ data, task, ui }) => {
  const { useState } = React;
  const [count, setCount] = useState(0);
  
  return (
    <ui.Button onClick={() => setCount(count + 1)}>
      Clicked {count} times
    </ui.Button>
  );
}
```

## Component Examples

### Simple Status Indicator

```jsx
(props) => {
  const { data } = props;
  
  if (!data?.active) return null;
  
  return (
    <div className="flex items-center gap-2 text-xs">
      <span className="w-2 h-2 rounded-full bg-success animate-pulse" />
      <span>Active</span>
    </div>
  );
}
```

### Interactive Counter

```jsx
(props) => {
  const { data, executeExtensionAction, ui } = props;
  const { Button } = ui;
  const count = data?.count ?? 0;
  
  const handleIncrement = async () => {
    await executeExtensionAction('increment');
  };
  
  return (
    <div className="flex items-center gap-2">
      <span className="text-sm">Count: {count}</span>
      <Button size="xs" onClick={handleIncrement}>+</Button>
    </div>
  );
}
```

### Model Selector

```jsx
(props) => {
  const { models, providers, data, executeExtensionAction, ui } = props;
  const { ModelSelector } = ui;
  
  const handleModelChange = async (model) => {
    const modelId = model ? `${model.providerId}/${model.id}` : '';
    await executeExtensionAction('set-model', modelId);
  };
  
  return (
    <ModelSelector
      models={models}
      providers={providers}
      selectedModelId={data?.selectedModel}
      onChange={handleModelChange}
    />
  );
}
```

### Message-Specific Component

```jsx
(props) => {
  const { message, data } = props;
  
  if (!message?.id || !data) return null;
  
  const messageData = data[message.id];
  if (!messageData) return null;
  
  return (
    <span className="text-xs text-text-muted">
      {messageData.tokensPerSecond} TPS
    </span>
  );
}
```

## Best Practices

### Performance

- **Memoize callbacks**: Use `useCallback` for event handlers
- **Memoize values**: Use `useMemo` for expensive computations
- **Avoid unnecessary renders**: Return `null` early when possible
- **Use noDataCache sparingly**: Only when data must always be fresh

### Styling

- **Use Tailwind CSS**: All Tailwind classes are available
- **Follow design system**: Use color tokens (text-primary, bg-secondary, etc.)
- **Responsive design**: Use Tailwind responsive classes (sm:, md:, lg:)
- **Dark mode**: Colors automatically adapt to theme

### Error Handling

- **Null checks**: Always check for undefined props (task, data, message)
- **Try-catch**: Wrap risky operations in try-catch
- **Error boundaries**: Components are wrapped in error boundaries automatically

### Data Management

- **Refresh after mutations**: Call `triggerUIDataRefresh()` after changing state
- **Use loadData flag**: Set to `true` when component needs data
- **Cache intelligently**: Use `noDataCache: true` only when needed

### Code Organization

- **External files**: Use .jsx files for components > 20 lines
- **One component per file**: Keep components focused and reusable
- **Shared logic**: Extract common logic to extension methods
- **Type safety**: Use TypeScript in extension, JSX in components
