import os, { tmpdir } from 'os';
import fs from 'fs/promises';
import path from 'path';
import { createReadStream, createWriteStream } from 'fs';
import readline from 'readline';
import { StringDecoder } from 'string_decoder';

import type { ModelMessage } from 'ai';
// @ts-expect-error istextorbinary is not typed properly
import { isBinary } from 'istextorbinary';
import { encode } from 'gpt-tokenizer/model/gpt-4o';
import { z } from 'zod';
import { ContextMessage, ContextUserMessage, JSONValue, MessageRole, PromptContext, ToolResultOutput } from '@common/types';

/**
 * Zod schema that coerces string values to booleans before validation.
 * Handles the case where LLMs send boolean parameters as strings ("true"/"false").
 */
export const coerceBoolean = z.preprocess((val) => {
  if (typeof val === 'boolean') {
    return val;
  }
  if (typeof val === 'string') {
    if (val.toLowerCase() === 'true') {
      return true;
    }
    if (val.toLowerCase() === 'false') {
      return false;
    }
  }
  return val;
}, z.boolean());

/**
 * Extracts PromptContext from a tool result if available.
 * @param toolResult - The tool result object to extract PromptContext from
 * @returns PromptContext if found, undefined otherwise
 */
export const extractPromptContextFromToolResult = (toolResult: unknown): PromptContext | undefined => {
  if (toolResult && typeof toolResult === 'object' && 'promptContext' in toolResult) {
    return toolResult.promptContext as PromptContext;
  }

  return undefined;
};

export const findLastUserMessage = (messages: ContextMessage[]): ContextUserMessage | undefined => {
  return [...messages].reverse().find((msg) => msg.role === MessageRole.User) as ContextUserMessage | undefined;
};

/**
 * Matches the intro text the agent prepends before an image part (e.g.
 * "Here is image foo.png for your reference." or "Here is content of image file
 * foo.png"). Removed alongside image parts for models without vision support.
 */
const IMAGE_INTRO_TEXT_PATTERN = /^Here is (image .+ for your reference\.|content of image file .+)$/;

const IMAGE_OMITTED_NOTE = 'Image content was omitted because the selected model does not support image input.';

type ImageStripPart = { type: string; text?: string; mediaType?: string };

/**
 * Removes image parts (and their intro text) from user messages so that models
 * without vision support never receive image input. If a user message is left
 * empty, it is replaced with a short explanatory note to keep the message
 * sequence valid.
 */
export const stripImageParts = (messages: ModelMessage[]): ModelMessage[] => {
  return messages.map((message) => {
    if (!Array.isArray(message.content)) {
      return message;
    }

    const parts = message.content as ImageStripPart[];
    const isImagePart = (part: ImageStripPart): boolean =>
      part.type === 'image' || (part.type === 'file' && typeof part.mediaType === 'string' && part.mediaType.startsWith('image'));

    if (!parts.some(isImagePart)) {
      return message;
    }

    const remaining = parts.filter((part) => {
      if (isImagePart(part)) {
        return false;
      }
      return !(part.type === 'text' && typeof part.text === 'string' && IMAGE_INTRO_TEXT_PATTERN.test(part.text));
    });

    const content = remaining.length > 0 ? remaining : [{ type: 'text', text: IMAGE_OMITTED_NOTE }];
    return { ...message, content } as ModelMessage;
  });
};

/**
 * Expands a tilde (~) at the beginning of a path to the user's home directory.
 * @param filePath - The file path to expand
 * @returns The expanded path with ~ replaced by the home directory
 */
export const expandTilde = (filePath: string): string => {
  if (filePath.startsWith('~/') || filePath === '~') {
    return filePath.replace('~', os.homedir());
  }
  return filePath;
};

const ACCUMULATOR_HEAD_CHARS = 48 * 1024;
const ACCUMULATOR_TAIL_CHARS = 48 * 1024;
const ACCUMULATOR_SPILL_THRESHOLD_CHARS = ACCUMULATOR_HEAD_CHARS + ACCUMULATOR_TAIL_CHARS;
const ACCUMULATOR_SPILL_MAX_BYTES = 100 * 1024 * 1024;

/**
 * Accumulates process output with a constant memory footprint.
 *
 * Keeps the first/last slices of the output in memory and spills the full
 * content to a temporary file once it exceeds the in-memory threshold, so
 * commands producing gigabytes of output cannot exhaust the V8 heap.
 */
export class BoundedOutputAccumulator {
  private decoder = new StringDecoder('utf8');
  private buffered = '';
  private head = '';
  private tail = '';
  private totalChars = 0;
  private spillFilePath: string | null = null;
  private spillStream: ReturnType<typeof createWriteStream> | null = null;
  private spillBytes = 0;
  private spillOverflowed = false;
  private spillFailed = false;
  private closed = false;

  append(chunk: Buffer | string): void {
    if (this.closed) {
      return;
    }
    const text = typeof chunk === 'string' ? chunk : this.decoder.write(chunk);
    this.appendText(text);
  }

  private appendText(text: string): void {
    if (!text) {
      return;
    }
    this.totalChars += text.length;

    if (this.spillStream || this.spillFailed) {
      this.tail = (this.tail + text).slice(-ACCUMULATOR_TAIL_CHARS);
      this.writeToSpill(text);
      return;
    }

    if (this.totalChars <= ACCUMULATOR_SPILL_THRESHOLD_CHARS) {
      this.buffered += text;
      return;
    }

    const fullSoFar = this.buffered + text;
    this.buffered = '';
    this.head = fullSoFar.slice(0, ACCUMULATOR_HEAD_CHARS);
    this.tail = fullSoFar.slice(-ACCUMULATOR_TAIL_CHARS);
    this.startSpill(fullSoFar);
  }

  private startSpill(initialContent: string): void {
    const id = Date.now().toString(36) + Math.random().toString(36).substring(2, 8);
    const spillPath = path.join(tmpdir(), `aider-desk-tool-output-${id}.log`);
    try {
      const stream = createWriteStream(spillPath, { encoding: 'utf8' });
      stream.on('error', () => {
        this.spillFailed = true;
        this.spillStream = null;
      });
      this.spillFilePath = spillPath;
      this.spillStream = stream;
      this.writeToSpill(initialContent);
    } catch {
      this.spillFailed = true;
      this.spillStream = null;
      this.spillFilePath = null;
    }
  }

  private writeToSpill(text: string): void {
    const stream = this.spillStream;
    if (!stream || this.spillOverflowed || this.spillFailed) {
      return;
    }
    this.spillBytes += Buffer.byteLength(text, 'utf8');
    if (this.spillBytes > ACCUMULATOR_SPILL_MAX_BYTES) {
      this.spillOverflowed = true;
      this.spillStream = null;
      stream.end();
      return;
    }
    stream.write(text);
  }

  didSpill(): boolean {
    return this.spillFilePath !== null && !this.spillFailed;
  }

  getSpillFilePath(): string | null {
    return this.didSpill() ? this.spillFilePath : null;
  }

  getTotalChars(): number {
    return this.totalChars;
  }

  getPreview(maxChars: number): string {
    const current = this.buffered || this.tail;
    if (current.length <= maxChars) {
      return current;
    }
    return `…[${current.length - maxChars} earlier characters omitted]\n${current.slice(-maxChars)}`;
  }

  async finish(): Promise<string> {
    this.closed = true;
    const remaining = this.decoder.end();
    this.appendText(remaining);

    if (this.spillStream) {
      const stream = this.spillStream;
      this.spillStream = null;
      await new Promise<void>((resolve) => {
        const failSafe = setTimeout(resolve, 5000);
        failSafe.unref?.();
        stream.once('finish', () => resolve());
        stream.once('close', () => resolve());
        stream.once('error', () => resolve());
        stream.end();
      });
    }

    return this.composeResult();
  }

  private composeResult(): string {
    if (this.totalChars <= ACCUMULATOR_SPILL_THRESHOLD_CHARS) {
      return this.buffered;
    }

    const omitted = this.totalChars - this.head.length - this.tail.length;
    let note = `Output truncated: ${omitted} of ${this.totalChars} characters omitted.`;
    if (this.didSpill()) {
      note += ` Full output saved to ${this.spillFilePath}.`;
      if (this.spillOverflowed) {
        note += ` (saved output itself capped at ${Math.floor(ACCUMULATOR_SPILL_MAX_BYTES / (1024 * 1024))} MB)`;
      }
    } else {
      note += ' Full output could not be saved.';
    }

    return this.head + `\n\n[${note}]\n\n` + this.tail;
  }

  async dispose(): Promise<void> {
    this.closed = true;
    const filePath = this.spillFilePath;
    if (this.spillStream) {
      const stream = this.spillStream;
      this.spillStream = null;
      await new Promise<void>((resolve) => {
        let settled = false;
        const done = (): void => {
          if (!settled) {
            settled = true;
            resolve();
          }
        };
        stream.once('close', done);
        stream.once('error', done);
        stream.destroy();
      });
    }
    if (filePath) {
      this.spillFilePath = null;
      try {
        await fs.unlink(filePath);
      } catch {
        // file may not exist
      }
    }
  }
}

export const TOOL_RESULT_MAX_JSON_CHARS = 200_000;

/**
 * Serializes a value to JSON with a hard character budget. When the natural
 * serialization exceeds the budget, returns a valid-JSON envelope containing
 * a preview instead of the oversized payload.
 */
export const stringifyWithBudget = (value: unknown, maxChars = TOOL_RESULT_MAX_JSON_CHARS): { text: string; truncated: boolean } => {
  let serialized: string;
  try {
    serialized = JSON.stringify(value);
  } catch {
    return { text: JSON.stringify({ truncated: true, note: 'Value could not be serialized to JSON.' }), truncated: true };
  }

  if (serialized === undefined) {
    return { text: 'undefined', truncated: false };
  }

  if (serialized.length <= maxChars) {
    return { text: serialized, truncated: false };
  }

  return {
    text: JSON.stringify({
      truncated: true,
      note: 'Content truncated due to size.',
      originalLength: serialized.length,
      preview: serialized.slice(0, maxChars),
    }),
    truncated: true,
  };
};

export const safeJsonStringify = (value: unknown, maxChars = TOOL_RESULT_MAX_JSON_CHARS): string => {
  return stringifyWithBudget(value, maxChars).text;
};

const TEXT_PART_TYPES = new Set(['text', 'error-text']);

/**
 * Checks if a content array (e.g. MCP tool result parts) contains any non-text parts
 * (e.g. media, image, file). These parts carry binary data (base64) that must NOT be
 * truncated — truncating them corrupts the data and causes the model to receive a
 * broken text fragment instead of a proper multimodal attachment.
 */
export const contentArrayHasNonTextParts = (content: unknown): boolean => {
  if (!Array.isArray(content)) {
    return false;
  }
  return content.some((part) => part && typeof part === 'object' && 'type' in part && !TEXT_PART_TYPES.has(part.type as string));
};

/**
 * Checks if a value contains non-text parts (e.g. media, image, file) in its content array.
 * Handles multiple formats: direct arrays, { content: [...] }, and { type: 'content', value: [...] }.
 */
const hasNonTextContentParts = (value: unknown): boolean => {
  if (value === null || typeof value !== 'object') {
    return false;
  }

  if (Array.isArray(value)) {
    return contentArrayHasNonTextParts(value);
  }

  const obj = value as Record<string, unknown>;

  // { content: [...] } (MCP / extension tool result format)
  if ('content' in obj && contentArrayHasNonTextParts(obj.content)) {
    return true;
  }

  // { type: 'content', value: [...] } (wrapped ToolResultOutput)
  if ('value' in obj && contentArrayHasNonTextParts(obj.value)) {
    return true;
  }

  return false;
};

/**
 * Safely serializes a tool result output to JSON for storage in context/IPC.
 * When the output contains non-text parts (media, image, file), the full payload
 * is preserved via JSON.stringify to avoid corrupting binary data. For text-only
 * outputs, falls back to stringifyWithBudget for OOM protection.
 */
export const safeStringifyToolOutput = (value: unknown, maxChars = TOOL_RESULT_MAX_JSON_CHARS): string => {
  if (hasNonTextContentParts(value)) {
    try {
      return JSON.stringify(value);
    } catch {
      return JSON.stringify({ truncated: true, note: 'Value could not be serialized to JSON.' });
    }
  }
  return stringifyWithBudget(value, maxChars).text;
};

/**
 * Reads a file and returns its content with optional line numbering and line range.
 * Files larger than LARGE_FILE_READ_THRESHOLD_BYTES are streamed instead of loaded
 * into memory in full, keeping the heap footprint bounded.
 * @param absolutePath - The absolute path to the file
 * @param withLines - Whether to return the file content with line numbers in format "lineNumber|content"
 * @param lineOffset - The starting line number (0-based) to begin reading from
 * @param lineLimit - The maximum number of lines to read
 * @param sizeLimit - Maximum file size in KB; files exceeding this are truncated. Defaults to 5% of lineLimit
 * @returns The file content as a string, formatted according to the parameters
 * @throws Error if the file is binary or cannot be read
 */
export const LARGE_FILE_READ_THRESHOLD_BYTES = 10 * 1024 * 1024;
const LARGE_FILE_BINARY_SNIFF_BYTES = 8192;

export const readFileContent = async (
  absolutePath: string,
  withLines = false,
  lineOffset = 0,
  lineLimit = 1000,
  sizeLimit = Math.max(50, 0.05 * lineLimit),
): Promise<string> => {
  try {
    const stat = await fs.stat(absolutePath);
    if (stat.size > LARGE_FILE_READ_THRESHOLD_BYTES) {
      return readLargeFileContent(absolutePath, withLines, lineOffset, lineLimit, sizeLimit);
    }
  } catch {
    // stat failed, fall through to regular readFile path
  }

  const fileContentBuffer = await fs.readFile(absolutePath);

  if (isBinary(absolutePath, fileContentBuffer)) {
    throw new Error('Binary files cannot be read.');
  }

  const fileContent = fileContentBuffer.toString('utf8');
  const lines = fileContent.split('\n');
  const totalLines = lines.length;

  const startIndex = Math.max(0, lineOffset);
  const endIndex = Math.min(totalLines, startIndex + lineLimit);
  const limitedLines = lines.slice(startIndex, endIndex);
  const limitedContent = limitedLines.join('\n');
  const limitedSizeKB = Buffer.byteLength(limitedContent, 'utf8') / 1024;

  if (limitedSizeKB > sizeLimit) {
    const truncatedBytes = Buffer.from(limitedContent, 'utf8').subarray(0, Math.floor(sizeLimit * 1024));
    const truncatedContent = truncatedBytes.toString('utf8');
    const truncatedLines = truncatedContent.split('\n');
    if (withLines) {
      return (
        truncatedLines.map((line, index) => `${startIndex + index + 1}|${line}`).join('\n') +
        `\n\nFile size limit (${sizeLimit.toFixed(1)} KB) exceeded. Use shell commands (e.g., head, tail, grep) to read specific parts.`
      );
    }
    return truncatedContent + `\n\nFile size limit (${sizeLimit.toFixed(1)} KB) exceeded. Use shell commands (e.g., head, tail, grep) to read specific parts.`;
  }

  let resultLines = limitedLines;

  if (withLines) {
    resultLines = limitedLines.map((line, index) => `${startIndex + index + 1}|${line}`);
  }

  if (endIndex < totalLines) {
    resultLines = [...resultLines, '...', `Total lines in the file: ${totalLines}`];
  }

  return resultLines.join('\n');
};

const readLargeFileContent = async (absolutePath: string, withLines: boolean, lineOffset: number, lineLimit: number, sizeLimit: number): Promise<string> => {
  const headBuffer = Buffer.alloc(LARGE_FILE_BINARY_SNIFF_BYTES);
  const headFd = await fs.open(absolutePath, 'r');
  try {
    const { bytesRead } = await headFd.read(headBuffer, 0, LARGE_FILE_BINARY_SNIFF_BYTES, 0);
    if (isBinary(absolutePath, headBuffer.subarray(0, bytesRead))) {
      throw new Error('Binary files cannot be read.');
    }
  } finally {
    await headFd.close();
  }

  const startIndex = Math.max(0, lineOffset);
  const collected: string[] = [];
  let moreLinesExist = false;
  let currentIndex = 0;

  await new Promise<void>((resolve, reject) => {
    const input = createReadStream(absolutePath, { encoding: 'utf8' });
    const rl = readline.createInterface({ input, crlfDelay: Infinity });

    const finish = () => resolve();

    input.on('error', reject);
    rl.on('error', reject);
    rl.on('line', (line: string) => {
      if (currentIndex < startIndex) {
        currentIndex++;
        return;
      }
      if (collected.length >= lineLimit) {
        moreLinesExist = true;
        rl.close();
        input.destroy();
        finish();
        return;
      }
      collected.push(line);
      currentIndex++;
    });
    rl.on('close', finish);
  });

  let resultLines: string[];

  if (withLines) {
    resultLines = collected.map((line, index) => `${startIndex + index + 1}|${line}`);
  } else {
    resultLines = collected;
  }

  if (moreLinesExist) {
    resultLines = [...resultLines, '...', `Total lines in the file: ${startIndex + collected.length}+ (exact count skipped for large file)`];
  }

  let result = resultLines.join('\n');
  const resultSizeKB = Buffer.byteLength(result, 'utf8') / 1024;

  if (resultSizeKB > sizeLimit) {
    const truncatedBytes = Buffer.from(result, 'utf8').subarray(0, Math.floor(sizeLimit * 1024));
    result =
      truncatedBytes.toString('utf8') +
      `\n\nFile size limit (${sizeLimit.toFixed(1)} KB) exceeded. Use shell commands (e.g., head, tail, grep) to read specific parts.`;
  }

  return result;
};

export const truncateToolResult = async (
  content: string,
  maxLines = 1000,
  maxSizeKB = 50,
  maxTokens = 50000,
  saveToFile = true,
  truncationSuffix?: string,
): Promise<string> => {
  const lines = content.split('\n');
  const sizeBytes = Buffer.byteLength(content, 'utf8');
  const sizeKB = sizeBytes / 1024;

  // skip the expensive tokenizer pass when a cheaper limit is already exceeded
  let tokenCount = 0;
  if (lines.length <= maxLines && sizeKB <= maxSizeKB && maxTokens !== Infinity) {
    tokenCount = encode(content).length;
  }

  if (lines.length <= maxLines && sizeKB <= maxSizeKB && tokenCount <= maxTokens) {
    return content;
  }

  let tmpFilePath: string | undefined;

  if (saveToFile) {
    const id = Date.now().toString(36) + Math.random().toString(36).substring(2, 8);
    const tmpFileName = `aider-desk-tool-result-${id}.txt`;
    tmpFilePath = path.join(tmpdir(), tmpFileName);
    await fs.writeFile(tmpFilePath, content, 'utf8');
  }

  const reasons: string[] = [];
  if (lines.length > maxLines) {
    reasons.push(`${lines.length} lines exceeded limit of ${maxLines}`);
  }
  if (sizeKB > maxSizeKB) {
    reasons.push(`${sizeKB.toFixed(1)} KB exceeded limit of ${maxSizeKB} KB`);
  }
  if (tokenCount > maxTokens) {
    reasons.push(`${tokenCount} tokens exceeded limit of ${maxTokens}`);
  }

  const getSuffix = () => {
    if (truncationSuffix) {
      return truncationSuffix;
    }
    const fileNote = tmpFilePath ? ` Full content saved to ${tmpFilePath}.` : '';
    return `Content truncated (${reasons.join(', ')}).${fileNote}`;
  };

  if (tokenCount > maxTokens) {
    const headBudget = Math.floor(maxTokens / 2);
    const tailBudget = maxTokens - headBudget;

    const headLines: string[] = [];
    let headTokens = 0;
    for (const line of lines) {
      const lineTokens = encode(line).length;
      if (headTokens + lineTokens > headBudget) {
        break;
      }
      headLines.push(line);
      headTokens += lineTokens;
    }

    const tailLines: string[] = [];
    let tailTokens = 0;
    for (let i = lines.length - 1; i >= 0; i--) {
      if (headLines.length + tailLines.length >= lines.length) {
        break;
      }
      const lineTokens = encode(lines[i]).length;
      if (tailTokens + lineTokens > tailBudget) {
        break;
      }
      tailLines.unshift(lines[i]);
      tailTokens += lineTokens;
    }

    const omittedLines = lines.length - headLines.length - tailLines.length;
    const truncationNotice = `\n\n... ${omittedLines} lines omitted (${reasons.join(', ')}). Full content saved to ${tmpFilePath}.\n\n`;

    if (truncationSuffix) {
      const suffixNotice = `\n\n... ${omittedLines} lines omitted. ${truncationSuffix}\n\n`;
      return headLines.join('\n') + suffixNotice + tailLines.join('\n');
    }

    return headLines.join('\n') + truncationNotice + tailLines.join('\n');
  }

  let preview: string;

  if (sizeKB > maxSizeKB) {
    const maxBytes = Math.floor(maxSizeKB * 1024);
    const contentBuffer = Buffer.from(content, 'utf8');
    preview = contentBuffer.subarray(0, maxBytes).toString('utf8');
  } else {
    preview = lines.slice(0, maxLines).join('\n');
  }

  return preview + `\n... ${getSuffix()}`;
};

const NETWORK_ERROR_CODES = ['ECONNRESET', 'EPIPE', 'ETIMEDOUT', 'ECONNREFUSED', 'ENOTFOUND', 'ENETUNREACH', 'EAI_AGAIN'] as const;

const UNDICI_ERROR_PREFIX = 'UND_ERR_';

export const isNetworkError = (error: unknown): boolean => {
  if (!(error instanceof Error)) {
    return false;
  }

  if (error instanceof TypeError && error.message === 'terminated') {
    return true;
  }

  if ('code' in error) {
    const code = (error as { code: string }).code;
    if (typeof code === 'string') {
      if (code.startsWith(UNDICI_ERROR_PREFIX)) {
        return true;
      }
      if ((NETWORK_ERROR_CODES as readonly string[]).includes(code)) {
        return true;
      }
    }
  }

  if (error.cause instanceof Error && isNetworkError(error.cause)) {
    return true;
  }

  return false;
};

/**
 * Converts MCP tool result output to AI SDK's ToolResultOutput format,
 * extracting image parts into `content`-type output with `file` parts.
 * The AI SDK handles per-provider conversion (e.g. OpenAI `input_image`,
 * Anthropic `image` with base64, Google `inlineData`).
 *
 * Handles MCP content parts of type `image`, `image-data`, and `media`,
 * with `data` or `image` fields, and optional `mimeType`/`mediaType`.
 */
export const convertMcpResultToModelOutput = (output: unknown): ToolResultOutput => {
  if (output && typeof output === 'object' && 'content' in output && Array.isArray((output as { content: unknown[] }).content)) {
    const content = (output as { content: Array<Record<string, unknown>> }).content;

    if (contentArrayHasNonTextParts(content)) {
      const value: Array<{ type: 'text'; text: string } | { type: 'file'; data: { type: 'data'; data: string }; mediaType: string }> = [];

      for (const part of content) {
        if (!part || typeof part !== 'object') {
          continue;
        }

        if (part.type === 'text' && typeof part.text === 'string') {
          value.push({ type: 'text', text: part.text });
        } else if ((part.type === 'image' || part.type === 'image-data' || part.type === 'media') && typeof (part.data ?? part.image) === 'string') {
          const data = (part.data ?? part.image) as string;
          const mediaType = typeof (part.mimeType ?? part.mediaType) === 'string' ? ((part.mimeType ?? part.mediaType) as string) : 'image/png';
          value.push({ type: 'file', data: { type: 'data', data }, mediaType });
        }
      }

      if (value.length > 0) {
        return { type: 'content', value };
      }
    }

    const textParts = content
      .filter((part) => part && typeof part === 'object' && part.type === 'text' && typeof part.text === 'string')
      .map((part) => part.text as string);

    if (textParts.length > 0) {
      return { type: 'text', value: textParts.join('') };
    }
  }

  if (typeof output === 'string') {
    return { type: 'text', value: output };
  }

  return { type: 'json', value: (output as JSONValue) ?? null };
};

const IMAGE_TOKEN_ESTIMATE = 1000;

type CountableMessage = { role: string; content: unknown };

const extractToolResultText = (output: unknown): string => {
  if (!output || typeof output !== 'object') {
    return '';
  }
  const o = output as { type: string; value?: unknown };
  if (o.type === 'text' || o.type === 'error-text') {
    return String(o.value ?? '');
  }
  if (o.type === 'json' || o.type === 'error-json') {
    return JSON.stringify(o.value);
  }
  if (o.type === 'content' && Array.isArray(o.value)) {
    return o.value
      .map((v: { type: string; text?: string; data?: string }) => (v.type === 'text' ? (v.text ?? '') : v.type === 'media' ? '[media]' : ''))
      .join('\n');
  }
  return JSON.stringify(output);
};

export const estimateMessageTokens = (messages: CountableMessage[]): number => {
  let estimatedImageTokens = 0;
  const textOnlyMessages = messages.map((msg) => {
    if (typeof msg.content === 'string') {
      return msg;
    }

    if (!Array.isArray(msg.content)) {
      return { role: msg.role, content: '' };
    }

    const parts = msg.content as Array<Record<string, unknown>>;
    const textParts: string[] = [];

    for (const part of parts) {
      const type = part.type as string;
      if (type === 'text' && typeof part.text === 'string') {
        textParts.push(part.text);
      } else if (type === 'tool-call') {
        textParts.push(JSON.stringify(part.input ?? ''));
      } else if (type === 'tool-result') {
        textParts.push(extractToolResultText(part.output));
      } else if (type === 'reasoning' && typeof part.text === 'string') {
        textParts.push(part.text);
      } else if (type === 'image' || (type === 'file' && typeof part.mediaType === 'string' && part.mediaType.startsWith('image/'))) {
        estimatedImageTokens += IMAGE_TOKEN_ESTIMATE;
      }
    }

    return { role: msg.role, content: textParts.join('\n\n') };
  });

  return textOnlyMessages.reduce((sum, msg) => sum + encode(typeof msg.content === 'string' ? msg.content : '').length, 0) + estimatedImageTokens;
};
