import * as path from 'path';

const LANGUAGE_MAP: Record<string, string> = {
  '.py': 'python',
  '.js': 'javascript',
  '.jsx': 'javascript',
  '.ts': 'typescript',
  '.tsx': 'tsx',
  '.mjs': 'javascript',
  '.cjs': 'javascript',
  '.java': 'java',
  '.go': 'go',
  '.rs': 'rust',
  '.c': 'c',
  '.cpp': 'cpp',
  '.cc': 'cpp',
  '.cxx': 'cpp',
  '.h': 'c',
  '.hpp': 'cpp',
  '.hxx': 'cpp',
  '.cs': 'c_sharp',
  '.dart': 'dart',
  '.hs': 'haskell',
  '.lhs': 'haskell',
  '.jl': 'julia',
  '.ml': 'ocaml',
  '.mli': 'ocaml_interface',
  '.php': 'php',
  '.rb': 'ruby',
  '.rake': 'ruby',
  '.gemspec': 'ruby',
  '.scala': 'scala',
  '.sc': 'scala',
};

export const detectLanguage = (filePath: string): string | null => {
  const ext = path.extname(filePath).toLowerCase();
  return LANGUAGE_MAP[ext] || null;
};

export const isLanguageSupported = (filePath: string): boolean => {
  return detectLanguage(filePath) !== null;
};

export const getSupportedExtensions = (): string[] => {
  return Object.keys(LANGUAGE_MAP);
};
