/**
 * Runtime module for AiderDesk extensions
 * 
 * This module provides runtime values for TypeScript enums that are needed
 * when extensions are loaded at runtime. These enums are also available as
 * types in the main extensions.d.ts file.
 */

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
