import { ApplicationAPI } from '@common/api';

const LIBRARY_CACHE = new Map<string, Record<string, unknown>>();

const convertAsAliases = (exports: string): string => {
  return exports.replace(/(\w+)\s+as\s+(\w+)/g, '$1: $2');
};

type Replacer = (...args: string[]) => string;

const MODULE_PATTERNS: { specifier: string; global: string; patterns: [RegExp, Replacer][] }[] = [
  {
    specifier: 'react-dom',
    global: 'window.__AiderDeskLibs__.ReactDOM',
    patterns: [
      [/import\s*\*\s*as\s+(\w+)\s*from\s*["']react-dom["'];?/g, (_match, name) => `const ${name} = window.__AiderDeskLibs__.ReactDOM;`],
      [/import\s*\{([^}]+)\}\s*from\s*["']react-dom["'];?/g, (_match, exp) => `const { ${convertAsAliases(exp.trim())} } = window.__AiderDeskLibs__.ReactDOM;`],
      [
        /import\s+(\w+)\s*,\s*\{([^}]+)\}\s*from\s*["']react-dom["'];?/g,
        (_match, def, exp) =>
          `const ${def} = window.__AiderDeskLibs__.ReactDOM;\nconst { ${convertAsAliases(exp.trim())} } = window.__AiderDeskLibs__.ReactDOM;`,
      ],
      [/import\s+(\w+)\s+from\s*["']react-dom["'];?/g, (_match, name) => `const ${name} = window.__AiderDeskLibs__.ReactDOM;`],
    ],
  },
  {
    specifier: 'react/jsx-dev-runtime',
    global: 'window.__AiderDeskLibs__.ReactJsxDevRuntime',
    patterns: [
      [
        /import\s*\{([^}]+)\}\s*from\s*["']react\/jsx-dev-runtime["'];?/g,
        (_match, exp) => `const { ${convertAsAliases(exp.trim())} } = window.__AiderDeskLibs__.ReactJsxDevRuntime;`,
      ],
      [/import\s*\*\s*as\s+(\w+)\s*from\s*["']react\/jsx-dev-runtime["'];?/g, (_match, name) => `const ${name} = window.__AiderDeskLibs__.ReactJsxDevRuntime;`],
      [/import\s+(\w+)\s+from\s*["']react\/jsx-dev-runtime["'];?/g, (_match, name) => `const ${name} = window.__AiderDeskLibs__.ReactJsxDevRuntime;`],
    ],
  },
  {
    specifier: 'react/jsx-runtime',
    global: 'window.__AiderDeskLibs__.ReactJsxRuntime',
    patterns: [
      [
        /import\s*\{([^}]+)\}\s*from\s*["']react\/jsx-runtime["'];?/g,
        (_match, exp) => `const { ${convertAsAliases(exp.trim())} } = window.__AiderDeskLibs__.ReactJsxRuntime;`,
      ],
      [/import\s*\*\s*as\s+(\w+)\s*from\s*["']react\/jsx-runtime["'];?/g, (_match, name) => `const ${name} = window.__AiderDeskLibs__.ReactJsxRuntime;`],
      [/import\s+(\w+)\s+from\s*["']react\/jsx-runtime["'];?/g, (_match, name) => `const ${name} = window.__AiderDeskLibs__.ReactJsxRuntime;`],
    ],
  },
  {
    specifier: 'react',
    global: 'window.__AiderDeskLibs__.React',
    patterns: [
      [/import\s*\*\s*as\s+(\w+)\s*from\s*["']react["'];?/g, (_match, name) => `const ${name} = window.__AiderDeskLibs__.React;`],
      [/import\s*\{([^}]+)\}\s*from\s*["']react["'];?/g, (_match, exp) => `const { ${convertAsAliases(exp.trim())} } = window.__AiderDeskLibs__.React;`],
      [
        /import\s+(\w+)\s*,\s*\{([^}]+)\}\s*from\s*["']react["'];?/g,
        (_match, def, exp) => `const ${def} = window.__AiderDeskLibs__.React;\nconst { ${convertAsAliases(exp.trim())} } = window.__AiderDeskLibs__.React;`,
      ],
      [/import\s+(\w+)\s+from\s*["']react["'];?/g, (_match, name) => `const ${name} = window.__AiderDeskLibs__.React;`],
    ],
  },
];

const rewriteImports = (source: string): string => {
  let result = source;

  for (const module of MODULE_PATTERNS) {
    for (const [regex, replacer] of module.patterns) {
      result = result.replace(regex, replacer);
    }
  }

  return result;
};

export const initExtensionLibraryLoader = async (): Promise<void> => {
  if (typeof window !== 'undefined') {
    const React = await import('react');
    const ReactDOM = await import('react-dom');
    const ReactJsxRuntime = await import('react/jsx-runtime');
    const ReactJsxDevRuntime = await import('react/jsx-dev-runtime');
    (window as unknown as Record<string, unknown>).__AiderDeskLibs__ = {
      React,
      ReactDOM,
      ReactJsxRuntime,
      ReactJsxDevRuntime,
    };
  }
};

export const loadExtensionLibrary = async (api: ApplicationAPI, librarySpec: string): Promise<Record<string, unknown>> => {
  const cached = LIBRARY_CACHE.get(librarySpec);
  if (cached) {
    return cached;
  }

  const source = await api.loadExtensionLibrary(librarySpec);
  const rewritten = rewriteImports(source);

  const blob = new Blob([rewritten], { type: 'application/javascript' });
  const url = URL.createObjectURL(blob);

  try {
    const module = await import(/* @vite-ignore */ url);
    URL.revokeObjectURL(url);
    LIBRARY_CACHE.set(librarySpec, module);
    return module;
  } catch (error) {
    URL.revokeObjectURL(url);
    throw error;
  }
};

export const loadAllLibraries = async (api: ApplicationAPI, libraries: Record<string, string>): Promise<Record<string, Record<string, unknown>>> => {
  if (!libraries || Object.keys(libraries).length === 0) {
    return {};
  }

  const results: Record<string, Record<string, unknown>> = {};
  const entries = Object.entries(libraries);

  const settled = await Promise.allSettled(
    entries.map(async ([key, spec]) => {
      const module = await loadExtensionLibrary(api, spec);
      return { key, module };
    }),
  );

  for (const result of settled) {
    if (result.status === 'fulfilled') {
      results[result.value.key] = result.value.module;
    } else {
      // eslint-disable-next-line no-console
      console.error('[ExtensionLibLoader] Failed to load extension library:', result.reason);
    }
  }

  return results;
};
