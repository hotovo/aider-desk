import fs from 'fs/promises';

import { TOOL_GROUP_NAME_SEPARATOR } from '@common/tools';

import { OS, UsageReportData } from './types';

type TextContent =
  | string
  | {
      type: 'text';
      text: string;
    };

type CodeBlockContent = {
  type: 'code-block';
  code?: unknown;
  language?: unknown;
};

// eslint-disable-next-line @typescript-eslint/no-explicit-any
export const isTextContent = (content: any): content is TextContent => content?.type === 'text' || typeof content === 'string';

export const extractTextContent = (content: unknown): string => {
  if (typeof content === 'string') {
    return content;
  }

  if (Array.isArray(content)) {
    const textParts: string[] = [];

    for (const part of content) {
      if (isTextContent(part)) {
        textParts.push(typeof part === 'string' ? part : part.text);
        continue;
      }

      if (typeof part === 'object' && part !== null && 'type' in part && (part as { type?: string }).type === 'code-block') {
        const codePart = part as CodeBlockContent;
        const code = typeof codePart.code === 'string' ? codePart.code : '';
        const language = typeof codePart.language === 'string' ? codePart.language : '';
        if (code.trim().length > 0 || language.trim().length > 0) {
          textParts.push(formatCodeBlockText(code, language));
        }
      }
    }

    return textParts.join('\n\n');
  }

  if (typeof content === 'object' && content !== null && 'content' in content) {
    return extractTextContent((content as { content: unknown }).content);
  }

  return '';
};

const maxFenceLength = (text: string): number => {
  let maxLength = 0;
  let currentLength = 0;

  for (const char of text) {
    if (char === '`') {
      currentLength += 1;
      if (currentLength > maxLength) {
        maxLength = currentLength;
      }
    } else {
      currentLength = 0;
    }
  }

  return maxLength;
};

export const formatCodeBlockText = (code: string, language?: string): string => {
  const rawLanguage = typeof language === 'string' ? language : '';
  const normalizedLanguage = rawLanguage.trim().split(/\r?\n/)[0].replace(/`/g, '');
  const fenceLength = Math.max(3, maxFenceLength(code) + 1);
  const fence = '`'.repeat(fenceLength);

  return normalizedLanguage.length > 0 ? `${fence}${normalizedLanguage}\n${code}\n${fence}` : `${fence}\n${code}\n${fence}`;
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

export const fileExists = async (fileName: string): Promise<boolean> => {
  return (await fs.stat(fileName).catch(() => null)) !== null;
};

export const extractServerNameToolName = (toolCallName: string): [string, string] => {
  const [serverName, ...toolNameParts] = toolCallName.split(TOOL_GROUP_NAME_SEPARATOR);
  const toolName = toolNameParts.join(TOOL_GROUP_NAME_SEPARATOR);

  return [serverName.startsWith('mcp__local__') ? serverName.slice('mcp__local__'.length) : serverName, toolName];
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
