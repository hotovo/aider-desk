import fs from 'fs/promises';

import { EXTENSION_TOOL_GROUP_NAME, TOOL_GROUP_NAME_SEPARATOR } from '@common/tools';

import { OS, UsageReportData } from './types';

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

export const normalizeBaseDir = (
  baseDir: string,
  os: OS = process.platform === 'win32' ? OS.Windows : process.platform === 'darwin' ? OS.MacOS : OS.Linux,
): string => {
  if (os === OS.Windows) {
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

export const compareBaseDirs = (baseDir1: string, baseDir2: string, os?: OS): boolean => {
  return normalizeBaseDir(baseDir1, os) === normalizeBaseDir(baseDir2, os);
};

/**
 * Extracts the inner error message from Electron IPC errors.
 * Electron wraps errors with format: "Error invoking remote method 'METHOD_NAME': InnerError"
 * This function extracts just the "InnerError" part.
 *
 * @param error - The error object or string
 * @returns The extracted error message without Electron's wrapper
 */
export const extractIpcErrorMessage = (error: unknown): string => {
  const message = error instanceof Error ? error.message : String(error);

  // Check for Electron IPC error format: "Error invoking remote method 'METHOD_NAME': ..."
  const ipcErrorPrefix = "Error invoking remote method '";
  const ipcErrorIndex = message.indexOf(ipcErrorPrefix);

  if (ipcErrorIndex !== -1) {
    // Find the colon after the method name
    const colonIndex = message.indexOf(': ', ipcErrorIndex);
    if (colonIndex !== -1) {
      // Return everything after the colon and space
      return message.substring(colonIndex + 2).trim();
    }
  }

  // If no IPC error format found, return the original message
  return message;
};

export const fileExists = async (fileName: string): Promise<boolean> => {
  return (await fs.stat(fileName).catch(() => null)) !== null;
};

export const extractServerNameToolName = (toolCallName: string): [string, string] => {
  const [serverName, ...toolNameParts] = toolCallName.split(TOOL_GROUP_NAME_SEPARATOR);
  let toolName = toolNameParts.join(TOOL_GROUP_NAME_SEPARATOR);
  let effectiveServerName = serverName;

  if (!toolName) {
    toolName = serverName;
    effectiveServerName = EXTENSION_TOOL_GROUP_NAME;
  }

  return [effectiveServerName.startsWith('mcp__local__') ? effectiveServerName.slice('mcp__local__'.length) : effectiveServerName, toolName];
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

const extToLang: Record<string, string> = {
  // JavaScript/TypeScript
  js: 'javascript',
  jsx: 'jsx',
  ts: 'typescript',
  tsx: 'tsx',
  mjs: 'javascript',
  cjs: 'javascript',

  // Web
  html: 'markup',
  htm: 'markup',
  xml: 'markup',
  svg: 'markup',
  astro: 'markup',
  css: 'css',
  scss: 'scss',
  sass: 'sass',
  less: 'less',
  stylus: 'stylus',

  // Python
  py: 'python',
  pyw: 'python',
  pyi: 'python',

  // Java/JVM
  java: 'java',
  kt: 'kotlin',
  kts: 'kotlin',
  scala: 'scala',
  groovy: 'groovy',

  // C/C++
  c: 'c',
  cpp: 'cpp',
  cc: 'cpp',
  cxx: 'cpp',
  h: 'cpp',
  hpp: 'cpp',
  hh: 'cpp',
  hxx: 'cpp',

  // C#/.NET
  cs: 'csharp',
  vb: 'vbnet',
  fs: 'fsharp',

  // Rust
  rs: 'rust',

  // Go
  go: 'go',

  // Ruby
  rb: 'ruby',
  rake: 'ruby',

  // PHP
  php: 'php',
  phtml: 'php',

  // Shell
  sh: 'bash',
  bash: 'bash',
  zsh: 'bash',
  fish: 'bash',

  // Data formats
  json: 'json',
  json5: 'json5',
  yml: 'yaml',
  yaml: 'yaml',
  toml: 'toml',
  ini: 'ini',
  csv: 'csv',

  // Markdown/Docs
  md: 'markdown',
  markdown: 'markdown',
  mdx: 'markdown',
  tex: 'latex',

  // Swift/Objective-C
  swift: 'swift',
  m: 'objectivec',
  mm: 'objectivec',

  // SQL
  sql: 'sql',

  // Other languages
  r: 'r',
  lua: 'lua',
  perl: 'perl',
  pl: 'perl',
  dart: 'dart',
  elm: 'elm',
  ex: 'elixir',
  exs: 'elixir',
  erl: 'erlang',
  clj: 'clojure',
  cljs: 'clojure',
  lisp: 'lisp',
  hs: 'haskell',
  ml: 'ocaml',

  // Config files
  dockerfile: 'docker',
  gitignore: 'ignore',

  // Other
  graphql: 'graphql',
  proto: 'protobuf',
  wasm: 'wasm',
  vim: 'vim',
  zig: 'zig',
  mermaid: 'mermaid',
};

export const getLanguageFromPath = (path: string | undefined): string => {
  const extension = path?.split('.').pop()?.toLowerCase();
  return extToLang[extension || ''] || 'text';
};

export const isURL = (url: string): boolean => {
  try {
    new URL(url);
    return true;
  } catch {
    return false;
  }
};

export const extractProviderModel = (modelId: string): [string, string] => {
  const [providerId, ...modelParts] = modelId.split('/');
  return [providerId, modelParts.join('/')];
};
