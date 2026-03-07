# Command Definition

Structure for defining slash commands in extensions.

## CommandDefinition Interface

```typescript
interface CommandDefinition {
  name: string;           // Command name (without /)
  description: string;    // Shown in command palette
  arguments?: CommandArgument[];
  execute(args: string[], context: ExtensionContext): Promise<void>;
}

interface CommandArgument {
  description: string;
  required: boolean;
  options?: string[];     // Predefined options for autocomplete
}
```

## Simple Command Example

```typescript
const HELLO_COMMAND: CommandDefinition = {
  name: 'hello',
  description: 'Say hello',
  arguments: [
    { description: 'Name to greet', required: true }
  ],
  async execute(args: string[], context: ExtensionContext): Promise<void> {
    const taskContext = context.getTaskContext();
    if (!taskContext) {
      context.log('No task context', 'error');
      return;
    }

    const name = args[0] || 'World';
    taskContext.addLogMessage('info', `Hello, ${name}!`);
  }
};
```

## Command with Options

```typescript
const THEME_COMMAND: CommandDefinition = {
  name: 'theme',
  description: 'Switch the AiderDesk theme',
  arguments: [
    {
      description: 'Name of the theme to apply',
      required: true,
      options: ['dark', 'light', 'ocean', 'forest']
    }
  ],
  async execute(args: string[], context: ExtensionContext): Promise<void> {
    const taskContext = context.getTaskContext();
    const themeName = args[0];

    if (!themeName) {
      taskContext?.addLogMessage('warning', 'Usage: /theme <theme-name>');
      return;
    }

    await context.updateSettings({ theme: themeName });
    taskContext?.addLogMessage('info', `Theme changed to: ${themeName}`);
  }
};
```

## Command with Config

```typescript
// In extension class
private config: MyConfig;

async onLoad(context: ExtensionContext): Promise<void> {
  this.config = await loadConfig();
}

getCommands(_context: ExtensionContext): CommandDefinition[] {
  return [{
    name: 'my-setting',
    description: 'Get or set a value',
    arguments: [
      { description: 'Value to set (optional)', required: false }
    ],
    execute: async (args: string[], context: ExtensionContext) => {
      const taskContext = context.getTaskContext();
      const [value] = args;

      if (!value) {
        // Show current value
        taskContext?.addLogMessage('info', `Current: ${this.config.mySetting}`);
      } else {
        // Update value
        this.config.mySetting = value;
        await saveConfig(this.config);
        taskContext?.addLogMessage('info', `Updated to: ${value}`);
      }
    }
  }];
}
```

## Multi-Argument Commands

```typescript
const CONFIG_COMMAND: CommandDefinition = {
  name: 'config',
  description: 'Manage extension settings',
  arguments: [
    { description: 'Setting name', required: true },
    { description: 'Setting value', required: false }
  ],
  async execute(args: string[], context: ExtensionContext): Promise<void> {
    const taskContext = context.getTaskContext();
    const [setting, value] = args;

    if (!setting) {
      // Show all settings
      const config = await loadConfig();
      taskContext?.addLogMessage('info', `Settings:\n${JSON.stringify(config, null, 2)}`);
      return;
    }

    if (!value) {
      // Show specific setting
      const config = await loadConfig();
      taskContext?.addLogMessage('info', `${setting}: ${config[setting]}`);
      return;
    }

    // Update setting
    const config = await loadConfig();
    config[setting] = value;
    await saveConfig(config);
    taskContext?.addLogMessage('info', `${setting} updated to: ${value}`);
  }
};
```

## Error Handling

```typescript
execute: async (args: string[], context: ExtensionContext) => {
  const taskContext = context.getTaskContext();
  if (!taskContext) {
    context.log('No active task context', 'error');
    return;
  }

  try {
    // Command logic
  } catch (error) {
    taskContext.addLogMessage('error', `Command failed: ${error}`);
  }
}
```

## Registering Commands

```typescript
class MyExtension implements Extension {
  getCommands(_context: ExtensionContext): CommandDefinition[] {
    return [COMMAND_1, COMMAND_2];
  }
}
```
