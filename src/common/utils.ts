import fs from 'fs/promises';

import { TOOL_GROUP_NAME_SEPARATOR } from '@common/tools';

import { ProjectSettings, SettingsData, UsageReportData } from './types';

type TextContent =
  | string
  | {
      type: 'text';
      text: string;
    };

// eslint-disable-next-line @typescript-eslint/no-explicit-any
export const isTextContent = (content: any): content is TextContent => content?.type === 'text' || typeof content === 'string';

export const extractTextContent = (content: unknown): string => {
  if (typeof content === 'string') {
    return content;
  }

  if (Array.isArray(content)) {
    return content
      .filter(isTextContent)
      .map((c) => (typeof c === 'string' ? c : c.text))
      .join('\n\n');
  }

  if (typeof content === 'object' && content !== null && 'content' in content) {
    return extractTextContent((content as { content: unknown }).content);
  }

  return '';
};

export const delay = (ms: number): Promise<void> => new Promise((resolve) => setTimeout(resolve, ms));

export const parseUsageReport = (model: string, report: string): UsageReportData => {
  const sentMatch = report.match(/Tokens: ([\d.]+k?) sent/);
  const cacheWriteMatch = report.match(/([\d.]+k?) cache write/);
  const cacheReadMatch = report.match(/([\d.]+k?) cache hit/);
  const receivedMatch = report.match(/([\d.]+k?) received/);
  const messageCostMatch = report.match(/Cost: \$(\d+\.\d+) message/);
  const totalCostMatch = report.match(/Total cost: \$(\d+\.\d+) session/);

  const parseTokens = (tokenStr: string): number => {
    if (tokenStr.includes('k')) {
      return parseFloat(tokenStr.replace('k', '')) * 1000;
    }
    return parseFloat(tokenStr);
  };

  const sentTokens = sentMatch ? parseTokens(sentMatch[1]) : 0;
  const cacheWriteTokens = cacheWriteMatch ? parseTokens(cacheWriteMatch[1]) : 0;
  const cacheReadTokens = cacheReadMatch ? parseTokens(cacheReadMatch[1]) : 0;
  const receivedTokens = receivedMatch ? parseTokens(receivedMatch[1]) : 0;

  const messageCost = messageCostMatch ? parseFloat(messageCostMatch[1]) : 0;
  const aiderTotalCost = totalCostMatch ? parseFloat(totalCostMatch[1]) : 0;

  return {
    model,
    sentTokens,
    receivedTokens,
    messageCost,
    aiderTotalCost,
    cacheWriteTokens,
    cacheReadTokens,
  };
};

export const normalizeBaseDir = (baseDir: string): string => {
  if (process.platform === 'win32') {
    // On Windows, paths are case-insensitive so we normalize to lowercase
    return baseDir.toLowerCase();
  } else {
    // Handle WSL paths like \\wsl.localhost\Ubuntu\home\user\...
    const wslPrefix = '\\\\wsl.localhost\\';
    if (baseDir.startsWith(wslPrefix)) {
      // Find the third backslash which marks the end of the distro name
      const thirdBackslashIndex = baseDir.indexOf('\\', wslPrefix.length);
      if (thirdBackslashIndex !== -1) {
        // Extract the path after \\wsl.localhost\<distro_name>\
        const actualPath = baseDir.substring(thirdBackslashIndex + 1);
        // Replace backslashes with forward slashes
        return '/' + actualPath.replace(/\\/g, '/');
      }
    }
    // Otherwise, return the path as is
    return baseDir;
  }
};

export const fileExists = async (fileName: string): Promise<boolean> => {
  return (await fs.stat(fileName).catch(() => null)) !== null;
};

export const extractServerNameToolName = (toolCallName: string): [string, string] => {
  const [serverName, ...toolNameParts] = toolCallName.split(TOOL_GROUP_NAME_SEPARATOR);
  const toolName = toolNameParts.join(TOOL_GROUP_NAME_SEPARATOR);

  return [serverName, toolName];
};

export const isMessageEmpty = (content: unknown): boolean => {
  if (typeof content === 'string') {
    return content.trim().length === 0;
  }

  if (Array.isArray(content)) {
    return content.every((part) => {
      if (typeof part === 'string') {
        return part.trim().length === 0;
      }
      if (part && typeof part === 'object' && 'type' in part && part.type === 'text' && 'text' in part) {
        return typeof part.text === 'string' ? part.text.trim().length === 0 : true;
      }
      return false;
    });
  } else if (typeof content === 'object' && content !== null && 'content' in content) {
    return isMessageEmpty((content as { content: unknown }).content);
  }

  return true;
};

export const getLanguageFromPath = (path: string): string => {
  const extension = path.split('.').pop()?.toLowerCase();
  // Add more mappings as needed
  switch (extension) {
    case 'js':
    case 'jsx':
      return 'javascript';
    case 'ts':
    case 'tsx':
      return 'typescript';
    case 'py':
      return 'python';
    case 'json':
      return 'json';
    case 'html':
      return 'html';
    case 'css':
      return 'css';
    case 'md':
      return 'markdown';
    default:
      return 'text'; // Default to plain text
  }
};

export const getActiveAgentProfile = (settings: SettingsData | null, projectSettings: ProjectSettings | null) => {
  if (!settings || !projectSettings) {
    return null;
  }

  const activeProfile = settings.agentProfiles.find((profile) => profile.id === projectSettings.agentProfileId);
  return activeProfile || null;
};
