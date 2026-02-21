/**
 * AiderDesk Extension API Type Definitions
 *
 * This module exports all types needed to create extensions for AiderDesk.
 *
 * @example
 * ```typescript
 * import type { Extension, ExtensionContext, ToolDefinition } from '@aider-desk/extensions';
 * import { z } from 'zod';
 *
 * class MyExtension implements Extension {
 *   async onLoad(context: ExtensionContext) {
 *     context.log('Extension loaded!', 'info');
 *   }
 *
 *   getTools(): ToolDefinition[] {
 *     return [{
 *       name: 'my-tool',
 *       description: 'My custom tool',
 *       parameters: z.object({ input: z.string() }),
 *       async execute(args, signal, context) {
 *         return { content: [{ type: 'text', text: args.input }] };
 *       },
 *     }];
 *   }
 * }
 *
 * export default MyExtension;
 * ```
 *
 * @module @aider-desk/extensions
 */

// Core Extension Types
export type { Extension, ExtensionContext, ExtensionMetadata, ExtensionConstructor } from './types';

// Tool Types
export type { ToolDefinition, ToolResult } from './types';

// UI Element Types
export type { UIElementDefinition, UIElementType } from './types';

// UI Placement Enum
export { UIPlacement } from './types';

// Task Event Types
export type { TaskCreatedEvent, TaskInitializedEvent, TaskClosedEvent } from './types';

// Prompt Event Types
export type { PromptStartedEvent, PromptFinishedEvent } from './types';

// Agent Event Types
export type { AgentStartedEvent, AgentFinishedEvent, AgentStepFinishedEvent } from './types';

// Tool Event Types
export type { ToolApprovalEvent, ToolCalledEvent, ToolFinishedEvent } from './types';

// File Event Types
export type { FilesAddedEvent, FilesDroppedEvent } from './types';

// Message Event Types
export type { ResponseMessageProcessedEvent } from './types';

// Approval Event Types
export type { HandleApprovalEvent } from './types';

// Subagent Event Types
export type { SubagentStartedEvent, SubagentFinishedEvent } from './types';

// Question Event Types
export type { QuestionAskedEvent, QuestionAnsweredEvent } from './types';

// Command Event Types
export type { CommandExecutedEvent, CustomCommandExecutedEvent } from './types';

// Aider Legacy Event Types
export type { AiderPromptStartedEvent, AiderPromptFinishedEvent } from './types';
