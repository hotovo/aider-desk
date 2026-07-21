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
- **name** (string, optional): Display name for the component (used as floating panel title)
- **jsx** (string, required): JSX/TSX component code as a string
- **loadData** (boolean, optional): Whether to load data via `getUIExtensionData()` (default: false)
- **noDataCache** (boolean, optional): Always fetch fresh data on render (default: false)
- **messageFilter** (object, optional): Filter for which messages this component handles (required for `task-message` placement)
  - **types** (string[], optional): Message types to handle (e.g. `'user'`, `'tool'`, `'response'`, `'log'`, `'loading'`, `'reflected-message'`, `'command-output'`, `'group'`, `'assistant-group'`). If omitted, matches all types.
  - **serverName** (string, optional): For tool messages — filter by server name (e.g. your extension ID)
  - **toolName** (string, optional): For tool messages — filter by tool name

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

- **task-message**: Replaces the entire default message rendering for matched messages
  - *Use for*: Custom rendering of user, assistant, tool, log, or any other message types
  - *Layout*: Full message width, replaces the default message block entirely
  - *Props*: Includes `message` prop with current message data
  - *Requires*: `messageFilter` property to specify which messages this component handles
  - *Note*: First matching component wins. The `task-message-above` and `task-message-below` wrappers still render around the custom component.

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

- **tasks-sidebar-actions-left**: Left side of tasks sidebar action area
  - *Use for*: Task sidebar action buttons (left group)
  - *Layout*: Horizontal row, left-aligned

- **tasks-sidebar-actions-right**: Right side of tasks sidebar action area
  - *Use for*: Task sidebar action buttons (right group)
  - *Layout*: Horizontal row, right-aligned

- **tasks-sidebar-bottom**: Bottom of the tasks sidebar
  - *Use for*: Persistent sidebar actions, status
  - *Layout*: Full sidebar width at bottom

- **task-sidebar-item-badges**: Inside each task item in the sidebar (between state chip and worktree badge)
  - *Use for*: Per-task badges, indicators, schedule status icons
  - *Layout*: Inline, compact — renders directly in each sidebar task row
  - *Props*: Receives `task` (the TaskData for this specific sidebar item) and `taskId`
  - *Important*: Unlike most placements, this renders **once per task** in the sidebar, not just for the active task. Use `loadData: true` and `noDataCache: true` so each item fetches its own data. Call `context.triggerUIDataRefresh(componentId, taskId)` to refresh a specific task's badge.

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

### Floating Panels

- **task-floating**: Draggable, resizable floating panel rendered as a React portal, scoped to the current task
  - *Use for*: Side-by-side tools that need to coexist with the chat (inspectors, previews, dashboards, scratchpads)
  - *Layout*: Free-form floating panel — extension JSX is the panel content, panel chrome (title bar, resize handles) is automatic
  - *Portal*: Rendered inside the task area via a portal host — has access to current task context
  - *Title*: Set via the `name` property on `UIComponentDefinition` — used as the floating panel title
  - *Behavior*: Draggable by title bar, resizable from edges, minimizable. Position and size are persisted in local storage
  - *Note*: Extension JSX should only contain the inner content — never wrap in a panel component

- **project-floating**: Draggable, resizable floating panel rendered as a React portal, scoped to the current project
  - *Use for*: Project-level tools and dashboards that span multiple tasks
  - *Layout*: Same free-form floating panel as `task-floating`
  - *Portal*: Rendered inside the project area via a portal host

- **app-floating**: Draggable, resizable floating panel rendered as a React portal, at the application level
  - *Use for*: Global tools, settings panels, or utilities not tied to a specific project or task
  - *Layout*: Same free-form floating panel as `task-floating`
  - *Portal*: Rendered at the app level via a portal host

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
  
  // External libraries loaded via getUIComponentsLibraries()
  libraries: Record<string, Record<string, unknown>>,
  
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

### ModalOverlayLayout
```jsx
<ui.ModalOverlayLayout
  title="My Modal"
  onClose={handleClose}
>
  <p>Modal content here</p>
</ui.ModalOverlayLayout>
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

## Using External Libraries

The `libraries` prop provides access to third-party npm packages declared via `getUIComponentsLibraries()`. Each key in the returned Record becomes a property on `props.libraries`.

Libraries are loaded asynchronously — on first render, `props.libraries.<key>` will be `undefined`. Always check availability before use:

```jsx
(props) => {
  var chartLib = props.libraries.chart;

  if (!chartLib) {
    return <span className="text-text-secondary text-sm">Loading chart…</span>;
  }

  var LineChart = chartLib.LineChart;
  return <LineChart data={props.data} />;
}
```

For full documentation on declaring and using external libraries, see [external-libraries.md](external-libraries.md).

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

### Custom Message Renderer (task-message placement)

Replace the default message rendering entirely for specific message types:

```typescript
// In your extension's getUIComponents():
getUIComponents(context: ExtensionContext): UIComponentDefinition[] {
  return [{
    id: 'my-custom-tool-message',
    placement: 'task-message',
    jsx: readFileSync(join(__dirname, './CustomToolMessage.jsx'), 'utf-8'),
    loadData: true,
    messageFilter: {
      types: ['tool'],
      serverName: 'my-extension',  // Only render for tools from this extension
    },
  }];
}
```

```jsx
// CustomToolMessage.jsx
(props) => {
  const { message, data, executeExtensionAction, ui } = props;
  const { useState } = React;
  const [expanded, setExpanded] = useState(false);

  if (!message || message.type !== 'tool') return null;

  const isExecuting = message.content === '';

  return (
    <div className="rounded-md border border-border-dark-light bg-bg-secondary p-3 text-xs">
      <div className="flex items-center gap-2 mb-2">
        <span className="font-semibold text-text-primary">{message.toolName}</span>
        {isExecuting && <span className="text-text-muted animate-pulse">Running...</span>}
      </div>
      <ui.Button size="xs" variant="outline" onClick={() => setExpanded(!expanded)}>
        {expanded ? 'Collapse' : 'Expand'}
      </ui.Button>
      {expanded && !isExecuting && (
        <pre className="mt-2 p-2 bg-bg-primary-light rounded text-2xs overflow-auto max-h-[300px]">
          {message.content}
        </pre>
      )}
    </div>
  );
}
```

You can also replace rendering for non-tool message types:

```typescript
// Replace user message rendering
{
  id: 'custom-user-message',
  placement: 'task-message',
  jsx: `...`,
  messageFilter: {
    types: ['user'],
  },
}

// Replace assistant response rendering
{
  id: 'custom-response-message',
  placement: 'task-message',
  jsx: `...`,
  messageFilter: {
    types: ['response'],
  },
}

// Replace all tool messages from a specific server
{
  id: 'custom-mcp-tool-message',
  placement: 'task-message',
  jsx: `...`,
  messageFilter: {
    types: ['tool'],
    serverName: 'my-mcp-server',
    toolName: 'specific-tool',  // Optional: narrow to a specific tool
  },
}

// Replace grouped assistant messages (compact mode)
{
  id: 'custom-assistant-group',
  placement: 'task-message',
  jsx: readFileSync(join(__dirname, './AssistantGroupMessage.jsx'), 'utf-8'),
  messageFilter: {
    types: ['assistant-group'],
  },
}
```

When handling `assistant-group` messages, access `message.responseMessage` and `message.toolMessages` to render the grouped content:

```jsx
// AssistantGroupMessage.jsx
(props) => {
  const message = props.message;
  if (!message || message.type !== 'assistant-group') return null;

  return (
    <div className="rounded-md border border-border-dark-light bg-bg-secondary">
      {message.responseMessage && (
        <div className="p-3 prose text-sm">
          {message.responseMessage.content}
        </div>
      )}
      {message.toolMessages?.length > 0 && (
        <div className="border-t border-border-dark-light">
          {message.toolMessages.map((tm) => (
            <div key={tm.id} className="px-3 py-1 text-xs border-b border-border-dark-light last:border-b-0">
              <span className="font-medium">{tm.toolName}</span>
              <pre className="mt-1 text-2xs opacity-80 max-h-24 overflow-auto">{tm.content}</pre>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
```

### Floating Panel (task-floating placement)

A draggable, resizable floating panel for side-by-side tools. Use `task-floating` for task-scoped panels, `project-floating` for project-scoped panels, or `app-floating` for app-level panels:

```typescript
// In your extension's getUIComponents():
getUIComponents(context: ExtensionContext): UIComponentDefinition[] {
  return [{
    id: 'my-panel',
    placement: 'task-floating',
    name: 'My Panel',  // Becomes the floating panel title
    loadData: true,
    noDataCache: true,
    jsx: readFileSync(join(__dirname, './MyPanel.jsx'), 'utf-8'),
  }];
}

async getUIExtensionData(componentId: string, context: ExtensionContext): Promise<unknown> {
  if (componentId !== 'my-panel') return null;
  const taskDir = context.getTaskContext()?.getTaskDir();
  return { taskDir, status: 'active' };
}

async executeUIExtensionAction(
  componentId: string, action: string, args: unknown[], context: ExtensionContext,
): Promise<unknown> {
  if (componentId !== 'my-panel') return null;
  if (action === 'refresh') {
    context.triggerUIDataRefresh(componentId);
  }
  return null;
}
```

```jsx
// MyPanel.jsx
(props) => {
  const data = props.data || {};
  const { useCallback } = React;

  const handleRefresh = useCallback(() => {
    props.executeExtensionAction('refresh');
  }, []);

  return (
    <div className="p-4 space-y-3">
      <div className="text-sm font-medium">Status: {data.status || 'unknown'}</div>
      <props.ui.Button size="sm" onClick={handleRefresh}>Refresh</props.ui.Button>
    </div>
  );
}
```

#### Floating Panel with Toggles

A floating panel with checkboxes that conditionally register other UI components:

```typescript
class MyExtension implements Extension {
  private enabledFeatures = new Set<string>();

  getUIComponents(context: ExtensionContext): UIComponentDefinition[] {
    const components: UIComponentDefinition[] = [{
      id: 'feature-toggle-panel',
      placement: 'task-floating',
      name: 'Feature Toggles',
      loadData: true,
      noDataCache: true,
      jsx: `
        (props) => {
          const data = props.data || {};
          const features = data.enabledFeatures || {};
          return (
            <div className="p-3 space-y-2">
              {Object.entries(features).map(([key, enabled]) => (
                <props.ui.Checkbox
                  key={key}
                  label={key}
                  checked={!!enabled}
                  onChange={() => props.executeExtensionAction('toggle', key)}
                />
              ))}
            </div>
          );
        }
      `,
    }];

    // Only register these components when their feature is enabled
    if (this.enabledFeatures.has('dashboard')) {
      components.push({
        id: 'dashboard',
        placement: 'task-status-bar-right',
        jsx: `...`,
      });
    }

    return components;
  }

  async getUIExtensionData(componentId: string, context: ExtensionContext): Promise<unknown> {
    if (componentId !== 'feature-toggle-panel') return null;
    return {
      enabledFeatures: {
        dashboard: this.enabledFeatures.has('dashboard'),
        inspector: this.enabledFeatures.has('inspector'),
      },
    };
  }

  async executeUIExtensionAction(
    componentId: string, action: string, args: unknown[], context: ExtensionContext,
  ): Promise<unknown> {
    if (action === 'toggle' && args[0]) {
      const feature = args[0] as string;
      if (this.enabledFeatures.has(feature)) {
        this.enabledFeatures.delete(feature);
      } else {
        this.enabledFeatures.add(feature);
      }
      // Reload components so getUIComponents() returns the updated list
      context.triggerUIComponentsReload();
      // Refresh the toggle panel's data
      context.triggerUIDataRefresh('feature-toggle-panel');
    }
    return null;
  }
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
