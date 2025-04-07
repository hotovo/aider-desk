import React from 'react';

import { CodeBlock } from './CodeBlock';
import { CodeInline } from './CodeInline';
import { ThinkingAnswerBlock } from './ThinkingAnswerBlock';

const ALL_FENCES = [
  ['````', '````'],
  ['```', '```'],
  ['<source>', '</source>'],
  ['<code>', '</code>'],
  ['<pre>', '</pre>'],
  ['<codeblock>', '</codeblock>'],
  ['<sourcecode>', '</sourcecode>'],
] as const;

export const parseMessageContent = (baseDir: string, content: string, allFiles: string[]) => {
  // First check if the content matches the thinking/answer format
  const thinkingAnswerContent = parseThinkingAnswerFormat(content, baseDir, allFiles);
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
    if (currentText.trim()) {
      parts.push(currentText.trim());
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

  for (let i = 0; i < lines.length; i++) {
    const line = lines[i];

    if (!isInCodeBlock) {
      // Check if line starts a code block
      const matchingFence = ALL_FENCES.find(([start]) => line.trim().startsWith(start));
      if (matchingFence) {
        const { file, removeLine } = findFileInPreviousLine(i);
        if (removeLine) {
          // Remove the last line from currentText if it contains the filename
          currentText = currentText.split('\n').slice(0, -2).join('\n') + '\n';
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

export const parseThinkingAnswerFormat = (content: string, baseDir: string = '', allFiles: string[] = []): React.ReactNode | null => {
  // Check for the thinking section first
  const thinkingRegex = /[-]{3,}\s*\n\s*►\s*\*\*THINKING\*\*\s*\n\s*([\s\S]*?)(?:\s*[-]{3,}\s*\n\s*►\s*\*\*ANSWER\*\*|$)/i;
  const thinkingMatch = content.match(thinkingRegex);

  if (thinkingMatch) {
    const thinking = thinkingMatch[1].trim();

    // Check if the answer section exists
    const answerRegex = /[-]{3,}\s*\n\s*►\s*\*\*ANSWER\*\*\s*\n\s*([\s\S]*)/i;
    const answerMatch = content.match(answerRegex);

    const answer = answerMatch && answerMatch[1].trim();

    return <ThinkingAnswerBlock thinking={thinking} answer={answer} baseDir={baseDir} allFiles={allFiles} />;
  }

  return null;
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
  parsedInnerJson: object | null;
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
    parsedInnerJson: null,
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
    if (typeof parsedOuter === 'object' && parsedOuter !== null && 'content' in parsedOuter && Array.isArray(parsedOuter.content)) {
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
            result.parsedInnerJson = innerJson;
          }
        } catch (innerError) {
          // Ignore error if inner content is not valid JSON
          console.debug('Inner content is not valid JSON:', innerError);
        }
      }
    } else {
      console.warn('Parsed tool content does not match expected structure:', parsedOuter);
    }
  } catch (outerError) {
    // Ignore error if the raw content is not valid JSON
    console.debug('Raw tool content is not valid JSON:', outerError);
  }

  return result;
};
