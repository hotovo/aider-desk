/**
 * Runtime module for AiderDesk extensions
 * 
 * This module provides runtime values for TypeScript enums that are needed
 * when extensions are loaded at runtime. These enums are also available as
 * types in the main extensions.d.ts file.
 */

/**
 * Supported operating systems for extensions
 */
export enum OS {
  Windows = 'windows',
  Linux = 'linux',
  MacOS = 'macos',
}

/**
 * Autonomy modes for tasks/agents
 */
export enum AutonomyMode {
  Manual = 'manual',
  Guided = 'guided',
  Autonomous = 'autonomous',
}

/**
 * Tool approval states for agent profiles
 */
export enum ToolApprovalState {
  Always = 'always',
  Never = 'never',
  Ask = 'ask',
}

/**
 * Invocation mode for subagents
 */
export enum InvocationMode {
  OnDemand = 'on-demand',
  Automatic = 'automatic',
}

/**
 * Context memory mode for subagents
 */
export enum ContextMemoryMode {
  Off = 'off',
  FullContext = 'full-context',
  LastMessage = 'last-message',
}
