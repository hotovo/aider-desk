/**
 * AiderDesk Extensions API
 *
 * This module provides runtime values for TypeScript enums that are needed
 * when extensions are loaded at runtime.
 *
 * Type definitions are provided by extensions.d.ts.
 */

// Re-export runtime values (enums, constants)
// Types are already declared in extensions.d.ts
export { ToolApprovalState, InvocationMode, ContextMemoryMode } from './runtime';
