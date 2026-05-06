import os, { tmpdir } from 'os';
import fs from 'fs/promises';
import path from 'path';

// @ts-expect-error istextorbinary is not typed properly
import { isBinary } from 'istextorbinary';
import { encode } from 'gpt-tokenizer/model/gpt-4o';
import { ContextMessage, ContextUserMessage, MessageRole, PromptContext } from '@common/types';

export const THINKING_RESPONSE_STAR_TAG = '---\n► **THINKING**\n';
export const ANSWER_RESPONSE_START_TAG = '---\n► **ANSWER**\n';

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

/**
 * Reads a file and returns its content with optional line numbering and line range.
 * @param absolutePath - The absolute path to the file
 * @param withLines - Whether to return the file content with line numbers in format "lineNumber|content"
 * @param lineOffset - The starting line number (0-based) to begin reading from
 * @param lineLimit - The maximum number of lines to read
 * @param sizeLimit - Maximum file size in KB; files exceeding this are truncated. Defaults to 5% of lineLimit
 * @returns The file content as a string, formatted according to the parameters
 * @throws Error if the file is binary or cannot be read
 */
export const readFileContent = async (
  absolutePath: string,
  withLines = false,
  lineOffset = 0,
  lineLimit = 1000,
  sizeLimit = 0.05 * lineLimit,
): Promise<string> => {
  const fileContentBuffer = await fs.readFile(absolutePath);

  if (isBinary(absolutePath, fileContentBuffer)) {
    throw new Error('Binary files cannot be read.');
  }

  const fileSizeKB = fileContentBuffer.length / 1024;

  if (fileSizeKB > sizeLimit) {
    const truncatedBytes = fileContentBuffer.subarray(0, Math.floor(sizeLimit * 1024));
    const truncatedContent = truncatedBytes.toString('utf8');
    const truncatedLines = truncatedContent.split('\n');
    if (withLines) {
      return (
        truncatedLines.map((line, index) => `${index + 1}|${line}`).join('\n') +
        `\n\nFile size limit (${sizeLimit.toFixed(1)} KB) exceeded. Use shell commands (e.g., head, tail, grep) to read specific parts.`
      );
    }
    return truncatedContent + `\n\nFile size limit (${sizeLimit.toFixed(1)} KB) exceeded. Use shell commands (e.g., head, tail, grep) to read specific parts.`;
  }

  const fileContent = fileContentBuffer.toString('utf8');
  const lines = fileContent.split('\n');
  const totalLines = lines.length;

  const startIndex = Math.max(0, lineOffset);
  const endIndex = Math.min(totalLines, startIndex + lineLimit);
  let limitedLines = lines.slice(startIndex, endIndex);

  if (withLines) {
    limitedLines = limitedLines.map((line, index) => `${startIndex + index + 1}|${line}`);
  }

  if (endIndex < totalLines) {
    limitedLines.push('...');
    limitedLines.push(`Total lines in the file: ${totalLines}`);
  }

  return limitedLines.join('\n');
};

export const truncateToolResult = async (content: string, maxLines = 1000, maxSizeKB = 50, maxTokens = 50000): Promise<string> => {
  const lines = content.split('\n');
  const sizeBytes = Buffer.byteLength(content, 'utf8');
  const sizeKB = sizeBytes / 1024;
  const tokenCount = maxTokens === Infinity ? 0 : encode(content).length;

  if (lines.length <= maxLines && sizeKB <= maxSizeKB && tokenCount <= maxTokens) {
    return content;
  }

  const id = Date.now().toString(36) + Math.random().toString(36).substring(2, 8);
  const tmpFileName = `aider-desk-tool-result-${id}.txt`;
  const tmpFilePath = path.join(tmpdir(), tmpFileName);

  await fs.writeFile(tmpFilePath, content, 'utf8');

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

  return preview + `\n... Content truncated (${reasons.join(', ')}). Full content saved to ${tmpFilePath}.`;
};
