// JSON types
export type JSONValue = null | string | number | boolean | JSONObject | JSONArray;
export type JSONObject = { [key: string]: JSONValue };
export type JSONArray = JSONValue[];

// Data content type for binary data
export type DataContent = string | Uint8Array | ArrayBuffer | Buffer;

export type FileDataData = {
  type: 'data';
  data: DataContent;
};

type ProviderReference = Record<string, string> & {
  type?: never;
};

export type FileDataReference = {
  type: 'reference';
  reference: ProviderReference;
};

export type FileDataUrl = {
  type: 'url';
  url: URL;
};

export type FileDataText = {
  type: 'text';
  text: string;
};

export type FileData = FileDataData | FileDataUrl | FileDataReference | FileDataText;

export type ProviderOptions = Record<string, JSONObject>;

// Tool result output union
export type ToolResultOutput =
  | { type: 'text'; value: string; providerOptions?: ProviderOptions }
  | { type: 'json'; value: JSONValue; providerOptions?: ProviderOptions }
  | { type: 'error-text'; value: string; providerOptions?: ProviderOptions }
  | { type: 'error-json'; value: JSONValue; providerOptions?: ProviderOptions }
  | {
      type: 'content';
      value: Array<
        | {
            type: 'text';
            text: string;
            providerOptions?: ProviderOptions;
          }
        | {
            type: 'file';
            data: FileData;
            mediaType: string;
            filename?: string;
            providerOptions?: ProviderOptions;
          }
        | {
            type: 'custom';
            providerOptions?: ProviderOptions;
          }
      >;
    };

// Content part interfaces
export interface TextPart {
  type: 'text';
  text: string;
}

export interface ImagePart {
  type: 'image';
  image: DataContent | URL;
  mediaType?: string;
}

export interface FilePart {
  type: 'file';
  data: DataContent | URL;
  filename?: string;
  mediaType: string;
}

export interface ReasoningPart {
  type: 'reasoning';
  text: string;
}

export interface ToolCallPart {
  type: 'tool-call';
  toolCallId: string;
  toolName: string;
  input: unknown;
}

export interface ToolResultPart {
  type: 'tool-result';
  toolCallId: string;
  toolName: string;
  output: ToolResultOutput;
}

// Content types
export type UserContent = string | Array<TextPart | ImagePart | FilePart>;
export type AssistantContent = string | Array<TextPart | FilePart | ReasoningPart | ToolCallPart | ToolResultPart>;
export type ToolContent = Array<ToolResultPart>;

export interface LocalizedString {
  key: string;
  params?: Record<string, unknown>;
}

export interface Group {
  id: string;
  name?: string | LocalizedString;
  color?: string;
  finished?: boolean;
  interruptId?: string;
}

export interface UsageReportData {
  model: string;
  sentTokens: number;
  receivedTokens: number;
  messageCost: number;
  cacheWriteTokens?: number;
  cacheReadTokens?: number;
  aiderTotalCost?: number;
  agentTotalCost?: number;
}

export interface PromptContext {
  id: string;
  group?: Group;
}

export enum MessageRole {
  User = 'user',
  Assistant = 'assistant',
}

// Base interface for all context messages with usage reporting
interface BaseContextMessage {
  id: string;
  timestamp?: number;
  usageReport?: UsageReportData;
  promptContext?: PromptContext;
}

// User message with usage report
export interface ContextUserMessage extends BaseContextMessage {
  role: 'user';
  content: UserContent;
}

// Assistant message with full response metadata
export interface ContextAssistantMessage extends BaseContextMessage {
  role: 'assistant';
  content: AssistantContent;
  reflectedMessage?: string;
  editedFiles?: string[];
  commitHash?: string;
  commitMessage?: string;
  diff?: string;
}

// Tool message with usage report
export interface ContextToolMessage extends BaseContextMessage {
  role: 'tool';
  content: ToolContent;
}

// Union type for enhanced context messages
export type ContextMessage = ContextUserMessage | ContextAssistantMessage | ContextToolMessage;

export interface ConnectorMessage {
  role: MessageRole;
  content: string;
}

export interface ContextFile {
  path: string;
  readOnly?: boolean;
  source?: 'global-rule' | 'project-rule' | 'agent-rule';
}

export enum ContextMemoryMode {
  Off = 'off',
  FullContext = 'full-context',
  LastMessage = 'last-message',
}
