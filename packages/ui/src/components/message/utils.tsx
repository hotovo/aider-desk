import React from 'react';
import ReactMarkdown from 'react-markdown';
import { type Components } from 'react-markdown';
import remarkGfm from 'remark-gfm';
import { Group } from '@aider-desk/common/types';

import { CustomCommandBashBlock } from './CustomCommandBashBlock';
import { ThinkingAnswerBlock } from './ThinkingAnswerBlock';

import { CodeBlock } from '@/components/common/CodeBlock';
import { MermaidDiagram } from '@/components/common/MermaidDiagram';
import { CodeInline } from '@/components/common/CodeInline';
import { AssistantGroupMessage, GroupMessage, isResponseMessage, isToolMessage, Message, ResponseMessage, ToolMessage } from '@/types/message';

const ALL_FENCES = [
  ['````', '````'],
  ['```', '```'],
  ['<source>', '</source>'],
  ['<code>', '</code>'],
  ['<pre>', '</pre>'],
  ['<codeblock>', '</codeblock>'],
  ['<sourcecode>', '</sourcecode>'],
] as const;

const REMARK_PLUGINS = [remarkGfm];
const MARKDOWN_COMPONENTS: Components = {
  h1: (props) => <h1 className="text-2xl font-bold my-4 first:mt-0 last:mb-0" {...props} />,
  h2: (props) => <h2 className="text-xl font-bold my-3 first:mt-0 last:mb-0" {...props} />,
  h3: (props) => <h3 className="text-lg font-bold my-2 first:mt-0 last:mb-0" {...props} />,
  h4: (props) => <h4 className="text-base font-bold my-1 first:mt-0 last:mb-0" {...props} />,
  h5: (props) => <h5 className="text-sm font-bold first:mt-0 last:mb-0" {...props} />,
  h6: (props) => <h6 className="text-xs font-bold first:mt-0 last:mb-0" {...props} />,
  p: (props) => <p className="text-xs my-2 first:mt-0 last:mb-0" {...props} />,
  ul: (props) => <ul className="list-disc list-inside ml-2 my-1 first:mt-0 last:mb-0" {...props} />,
  ol: (props) => <ol className="list-decimal list-inside ml-2 my-1 first:mt-0 last:mb-0" {...props} />,
  li: (props) => <li className="my-0.5" {...props} />,
  blockquote: (props) => <blockquote className="border-l-4 border-border-default pl-4 italic my-0 text-text-muted-light" {...props} />,
  strong: (props) => <strong className="font-bold" {...props} />,
  em: (props) => <em className="italic" {...props} />,
  a: (props) => <a className="text-info-light hover:underline" target="_blank" rel="noopener noreferrer" {...props} />,
  // Handle code blocks - check if it's a mermaid diagram or regular code
  code: (props) => {
    const { className, children } = props;

    // Check if this is a mermaid code block (className includes 'language-mermaid')
    const language = className?.replace(/language-/, '') || '';
    if (language === 'mermaid' && typeof children === 'string') {
      return <MermaidDiagram code={children} />;
    }

    // Use CodeInline for inline code elements
    return <CodeInline {...props} />;
  },
  // Basic styling for preformatted blocks (e.g., indented code)
  pre: (props) => <pre className="bg-bg-primary-light p-2 rounded my-2 overflow-x-auto" {...props} />,
  // Table styling
  table: (props) => <table className="divide-y divide-border-default border-border-default mb-2 rounded-sm" {...props} />,
  thead: (props) => <thead className="bg-bg-secondary-light" {...props} />,
  tbody: (props) => <tbody className="bg-bg-primary-light-strong divide-y divide-border-default" {...props} />,
  tr: (props) => <tr {...props} />,
  th: (props) => <th className="px-5 py-2 text-left text-xs font-medium text-text-secondary uppercase tracking-wider" {...props} />,
  td: (props) => <td className="px-4 py-2 text-xs text-text-primary whitespace-nowrap" {...props} />,
};

export const parseMessageContent = (baseDir: string, content: string, allFiles: string[], renderMarkdown = false, renderThinking = true) => {
  // First check if the content matches the thinking/answer format
  const thinkingAnswerContent = parseThinkingAnswerFormat(content, baseDir, allFiles, renderMarkdown, renderThinking);
  if (thinkingAnswerContent) {
    return thinkingAnswerContent;
  }

  const parts: React.ReactNode[] = [];
  const lines = content.split('\n');
  let currentText = '';
  let isInCodeBlock = false;
  let currentFence: (typeof ALL_FENCES)[number] | null = null;
  let language = '';
  let codeContent: string[] = [];
  let currentFile: string | undefined;
  let foundClosingFence = false;

  const processTextBlock = () => {
    if (currentText.trimEnd()) {
      if (renderMarkdown) {
        parts.push(
          <ReactMarkdown key={parts.length} remarkPlugins={REMARK_PLUGINS} components={MARKDOWN_COMPONENTS}>
            {currentText.trimEnd()}
          </ReactMarkdown>,
        );
      } else {
        parts.push(currentText.trimEnd());
      }
      currentText = '';
    }
  };

  const processCodeBlock = () => {
    if (codeContent.length > 0) {
      parts.push(
        <CodeBlock key={parts.length} baseDir={baseDir} language={language} file={currentFile} isComplete={foundClosingFence}>
          {codeContent.join('\n').trim()}
        </CodeBlock>,
      );
      codeContent = [];
      language = '';
      currentFile = undefined;
      foundClosingFence = false;
    }
  };

  const findFileInPreviousLine = (currentLine: number): { file?: string; removeLine: boolean } => {
    if (currentLine <= 0) {
      return { removeLine: false };
    }

    const prevLine = lines[currentLine - 1].trim();
    if (!prevLine) {
      return { removeLine: false };
    }

    // Check if the line is just a filepath
    if (allFiles.includes(prevLine)) {
      return { file: prevLine, removeLine: true };
    }

    // Check if line ends with a filepath
    const lastWord = prevLine.split(/\s+/).pop();
    if (lastWord && allFiles.includes(lastWord)) {
      return { file: lastWord, removeLine: true };
    }

    return { removeLine: false };
  };

  const findFileInNextLine = (currentLine: number): { file?: string; skipLine: boolean } => {
    if (currentLine >= lines.length - 1) {
      return { skipLine: false };
    }

    const nextLine = lines[currentLine + 1].trim();
    if (!nextLine) {
      return { skipLine: false };
    }

    // Check if the next line is just a filepath
    if (allFiles.includes(nextLine)) {
      return { file: nextLine, skipLine: true };
    }

    // Check if the next line starts with a filepath
    const firstWord = nextLine.split(/\s+/)[0];
    if (firstWord && allFiles.includes(firstWord)) {
      return { file: firstWord, skipLine: true };
    }

    return { skipLine: false };
  };

  for (let i = 0; i < lines.length; i++) {
    const line = lines[i];

    if (!isInCodeBlock) {
      // Check for custom-command-bash blocks
      if (line.trim() === '<custom-command-bash>') {
        // Process any accumulated text first
        processTextBlock();

        // Find the end of the custom-command-bash block
        let endIndex = -1;
        for (let j = i + 1; j < lines.length; j++) {
          if (lines[j].trim() === '</custom-command-bash>') {
            endIndex = j;
            break;
          }
        }

        if (endIndex !== -1) {
          // Extract the content between the tags
          const blockContent = lines.slice(i, endIndex + 1).join('\n');
          const customCommandBashContent = parseCustomCommandBashFormat(baseDir, blockContent);

          if (customCommandBashContent) {
            parts.push(customCommandBashContent);
          }

          // Skip to after the closing tag
          i = endIndex;
          continue;
        }
      }

      // Check if line starts a code block
      const matchingFence = ALL_FENCES.find(([start]) => line.trim().startsWith(start));
      if (matchingFence) {
        let file: string | undefined;

        // Try finding the file in the previous line first
        const prevLineResult = findFileInPreviousLine(i);
        if (prevLineResult.file) {
          file = prevLineResult.file;

          if (prevLineResult.removeLine) {
            // Remove the last line from currentText if it contains the filename
            currentText = currentText.split('\n').slice(0, -2).join('\n') + '\n';
          }
        } else {
          // If not found in the previous line, check the next line
          const nextLineResult = findFileInNextLine(i);
          if (nextLineResult.file) {
            file = nextLineResult.file;

            if (nextLineResult.skipLine) {
              // Skip the next line in the loop
              i++;
            }
          }
        }

        processTextBlock();
        isInCodeBlock = true;
        currentFence = matchingFence;
        currentFile = file;
        foundClosingFence = false;

        // Extract language for ``` fence
        if (matchingFence[0].startsWith('```')) {
          language = line.trim().slice(matchingFence[0].length).trim();
        }
        continue;
      }

      if (renderMarkdown) {
        currentText += line + '\n';
      } else {
        // Handle inline code ticks
        let lineText = '';
        let isInSingleTick = false;

        for (let j = 0; j < line.length; j++) {
          const char = line[j];

          if (char === '`') {
            if (!isInSingleTick) {
              if (lineText) {
                currentText += lineText;
                lineText = '';
              }
              isInSingleTick = true;
            } else {
              parts.push(currentText);
              parts.push(<CodeInline key={parts.length}>{lineText}</CodeInline>);
              currentText = '';
              lineText = '';
              isInSingleTick = false;
            }
          } else {
            if (isInSingleTick) {
              lineText += char;
            } else {
              currentText += char;
            }
          }
        }

        if (lineText) {
          currentText += lineText;
        }
        currentText += '\n';
      }
    } else {
      // Check if line ends the code block
      if (line.trim() === currentFence![1]) {
        foundClosingFence = true;
        processCodeBlock();
        isInCodeBlock = false;
        currentFence = null;
      } else {
        codeContent.push(line);
      }
    }
  }

  // Handle any remaining content
  if (isInCodeBlock) {
    processCodeBlock();
  } else {
    processTextBlock();
  }

  return parts;
};

export const parseThinkingAnswerFormat = (
  content: string,
  baseDir: string = '',
  allFiles: string[] = [],
  renderMarkdown = false,
  renderThinking = true,
): React.ReactNode | null => {
  // Check for the thinking section first
  const thinkingRegex = /[-]{3,}\s*\n\s*►\s*\*\*THINKING\*\*\s*\n\s*([\s\S]*?)(?:\s*[-]{3,}\s*\n\s*►\s*\*\*ANSWER\*\*|$)/i;
  const thinkingMatch = content.match(thinkingRegex);

  if (thinkingMatch) {
    const thinking = thinkingMatch[1].trim();

    // Check if the answer section exists
    const answerRegex = /[-]{3,}\s*\n\s*►\s*\*\*ANSWER\*\*\s*\n\s*([\s\S]*)/i;
    const answerMatch = content.match(answerRegex);

    const answer = answerMatch && answerMatch[1].trim();

    return renderThinking ? (
      <ThinkingAnswerBlock thinking={thinking} answer={answer} baseDir={baseDir} allFiles={allFiles} renderMarkdown={renderMarkdown} />
    ) : (
      parseMessageContent(baseDir, answer || thinking, allFiles, renderMarkdown)
    );
  }

  return null;
};

export const parseCustomCommandBashFormat = (baseDir: string, content: string): React.ReactNode | null => {
  // Find the opening tag
  const openTagStart = content.indexOf('<custom-command-bash>');
  if (openTagStart === -1) {
    return null;
  }

  // Find the closing tag
  const closeTagStart = content.lastIndexOf('</custom-command-bash>');
  if (closeTagStart === -1 || closeTagStart <= openTagStart) {
    return null;
  }

  // Extract content between opening and closing tags
  const innerContent = content.substring(openTagStart + '<custom-command-bash>'.length, closeTagStart);

  // Find command tags
  const commandStart = innerContent.indexOf('<command>');
  const commandEnd = innerContent.indexOf('</command>');

  if (commandStart === -1 || commandEnd === -1 || commandEnd <= commandStart) {
    return null;
  }

  // Find output tags (search after the command closing tag)
  const outputStart = innerContent.indexOf('<output>', commandEnd);
  const outputEnd = innerContent.lastIndexOf('</output>');

  if (outputStart === -1 || outputEnd === -1 || outputEnd <= outputStart) {
    return null;
  }

  // Extract command and output content
  const command = innerContent.substring(commandStart + '<command>'.length, commandEnd).trim();
  const output = innerContent.substring(outputStart + '<output>'.length, outputEnd).trim();

  return <CustomCommandBashBlock baseDir={baseDir} command={command} output={output} />;
};

// --- Tool Message Parsing ---
interface ParsedToolContentItem {
  type: string;
  text?: string;
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  [key: string]: any; // Allow other properties
}

interface ParsedToolMessage {
  content: ParsedToolContentItem[];
  isError: boolean;
}

export interface ToolContentResult {
  extractedText: string | null;
  json: object | null;
  isError: boolean | null;
  rawContent: string; // Always include the original raw content
}

/**
 * Parses the content string from a ToolMessage.
 * Expected format: A JSON string containing an object with 'content' (an array) and 'isError' (boolean).
 * The 'content' array items should have a 'text' property.
 * The concatenated 'text' properties might themselves be a JSON string.
 */
export const parseToolContent = (rawContent: string): ToolContentResult => {
  const result: ToolContentResult = {
    extractedText: null,
    json: null,
    isError: null,
    rawContent: rawContent,
  };

  if (!rawContent) {
    return result; // Return default if rawContent is empty
  }

  try {
    const parsedOuter: unknown = JSON.parse(rawContent);

    if (typeof parsedOuter === 'string') {
      result.extractedText = parsedOuter;
      return result;
    }

    // Type check for the expected outer structure
    if (typeof parsedOuter === 'object' && parsedOuter !== null) {
      if ('content' in parsedOuter && Array.isArray(parsedOuter.content)) {
        const toolMessage = parsedOuter as ParsedToolMessage;
        result.isError = toolMessage.isError || false;

        // Extract text from the 'content' array
        const textParts = toolMessage.content
          .map((item) => (item.type === 'text' && item.text ? item.text : null))
          .filter((text): text is string => text !== null);

        if (textParts.length > 0) {
          result.extractedText = textParts.join('');

          // Try parsing the extracted text as JSON
          try {
            const innerJson = JSON.parse(result.extractedText);
            if (typeof innerJson === 'object' && innerJson !== null) {
              result.json = innerJson;
            }
          } catch (innerError) {
            // Ignore error if inner content is not valid JSON
            // eslint-disable-next-line no-console
            console.debug('Inner content is not valid JSON:', innerError);
          }
        }
      } else {
        result.json = parsedOuter;
      }
    } else {
      // eslint-disable-next-line no-console
      console.warn('Parsed tool content does not match expected structure:', parsedOuter);
    }
  } catch (outerError) {
    // Ignore error if the raw content is not valid JSON
    // eslint-disable-next-line no-console
    console.debug('Raw tool content is not valid JSON:', outerError);
  }

  return result;
};

/**
 * Groups ResponseMessage with their following ToolMessages into AssistantGroupMessage.
 * This is used for the compact view mode where assistant turns are displayed as a single unit.
 *
 * Rules:
 * - A ResponseMessage followed by ToolMessages forms a single group
 * - A new ResponseMessage starts a new group
 * - Orphan ToolMessages (without preceding ResponseMessage) remain standalone
 * - Other message types remain standalone
 */
export const groupAssistantMessages = (messages: Message[]): Message[] => {
  const result: Message[] = [];
  let currentResponse: ResponseMessage | null = null;
  let currentToolMessages: ToolMessage[] = [];

  const flushCurrentGroup = () => {
    if (currentResponse) {
      if (currentToolMessages.length > 0) {
        // Create an AssistantGroupMessage
        const assistantGroup: AssistantGroupMessage = {
          id: currentResponse.id,
          type: 'assistant-group',
          content: '',
          responseMessage: currentResponse,
          toolMessages: currentToolMessages,
        };
        result.push(assistantGroup);
      } else {
        // No tool messages, just push the response as-is
        result.push(currentResponse);
      }
      currentResponse = null;
      currentToolMessages = [];
    }
  };

  for (const message of messages) {
    if (isResponseMessage(message)) {
      // Flush any previous group before starting a new one
      flushCurrentGroup();
      currentResponse = message;
    } else if (isToolMessage(message)) {
      if (currentResponse) {
        // Add to current group
        currentToolMessages.push(message);
      } else {
        // Orphan tool message - push as-is
        result.push(message);
      }
    } else {
      // Other message types - flush current group and push as-is
      flushCurrentGroup();
      result.push(message);
    }
  }

  // Flush any remaining group
  flushCurrentGroup();

  return result;
};

export const areMessagesEqual = (prevMessage: Message, nextMessage: Message): boolean => {
  // Check basic message properties
  if (prevMessage.id !== nextMessage.id || prevMessage.content !== nextMessage.content) {
    return false;
  }

  // Check usageReport for ResponseMessage and ToolMessage
  if ((isResponseMessage(prevMessage) || isToolMessage(prevMessage)) && (isResponseMessage(nextMessage) || isToolMessage(nextMessage))) {
    const prevHasUsageReport = !!prevMessage.usageReport;
    const nextHasUsageReport = !!nextMessage.usageReport;
    if (prevHasUsageReport !== nextHasUsageReport) {
      return false;
    }
  }

  // Check args for ToolMessage
  if (isToolMessage(prevMessage) && isToolMessage(nextMessage)) {
    const prevToolMessage = prevMessage as ToolMessage;
    const nextToolMessage = nextMessage as ToolMessage;
    if (JSON.stringify(prevToolMessage.args) !== JSON.stringify(nextToolMessage.args)) {
      return false;
    }
  }

  return true;
};

export const groupMessagesByPromptContext = (messages: Message[]): Message[] => {
  const result: Message[] = [];
  const groups: Record<string, Message[]> = {};
  const latestGroupInfo: Record<string, Group> = {};

  // First pass: collect messages with groups
  messages.forEach((message) => {
    const groupId = message.promptContext?.group?.id;
    if (groupId) {
      if (!groups[groupId]) {
        groups[groupId] = [];
      }
      groups[groupId].push(message);
      // Track the latest group information for this group ID, but only update if current group isn't finished
      if (message.promptContext?.group && !latestGroupInfo[groupId]?.finished) {
        latestGroupInfo[groupId] = message.promptContext.group;
      }
    }
  });

  messages.forEach((message) => {
    const groupId = message.promptContext?.group?.id;
    if (groupId && groups[groupId].length > 0) {
      // Create GroupMessage for the first message in the group
      const groupMessages = groups[groupId];
      const firstMessage = groupMessages[0];

      // Only create the group once
      if (firstMessage === message) {
        const groupMessage: GroupMessage = {
          id: groupId,
          type: 'group',
          content: '',
          group: latestGroupInfo[groupId],
          children: groupMessages,
        };
        result.push(groupMessage);
      }
    } else if (!groupId) {
      result.push(message);
    }
  });

  return result;
};
