import { spawn, ChildProcessWithoutNullStreams } from 'child_process';
import path from 'path';
import { existsSync, readFileSync } from 'fs';

import { ExtensionContext } from '@aiderdesk/extensions';

interface SafeSpawnOptions {
  cwd: string;
  env?: NodeJS.ProcessEnv;
}

const safeSpawn = (
  command: string,
  args: string[],
  serverName: string,
  context: ExtensionContext,
  options: SafeSpawnOptions,
): Promise<ChildProcessWithoutNullStreams> => {
  return new Promise((resolve, reject) => {
    const proc = spawn(command, args, {
      cwd: options.cwd,
      env: options.env ?? process.env,
    });

    let resolved = false;

    proc.on('error', (error) => {
      context.log(`Failed to start ${serverName} LSP server: ${error.message}`, 'error');
      if (!resolved) {
        reject(error);
      }
    });

    setImmediate(() => {
      if (proc.pid !== undefined) {
        resolved = true;
        resolve(proc);
      }
    });
  });
};

export interface LspServerHandle {
  process: ChildProcessWithoutNullStreams;
  initializationOptions?: Record<string, unknown>;
}

export interface LspServerInfo {
  id: string;
  languageId: string;
  extensions: string[];
  spawn(rootDir: string, context: ExtensionContext): Promise<LspServerHandle | undefined>;
}

const TYPESCRIPT_EXTENSIONS = ['.ts', '.tsx', '.js', '.jsx', '.mjs', '.cjs', '.mts', '.cts'];
const PYTHON_EXTENSIONS = ['.py', '.pyi', '.pyw'];
const VUE_EXTENSIONS = ['.vue'];
const RUST_EXTENSIONS = ['.rs'];
const GO_EXTENSIONS = ['.go'];
const JAVA_EXTENSIONS = ['.java', '.gradle', '.groovy'];
const LUA_EXTENSIONS = ['.lua'];
const SVELTE_EXTENSIONS = ['.svelte'];
const ASTRO_EXTENSIONS = ['.astro'];
const CSHARP_EXTENSIONS = ['.cs', '.csx'];
const DENO_EXTENSIONS = ['.ts', '.tsx', '.js', '.jsx', '.mjs'];

const findBinary = (binaryName: string, projectDir: string): string | null => {
  const projectNodeModulesBin = path.join(projectDir, 'node_modules', '.bin', binaryName);
  if (existsSync(projectNodeModulesBin)) {
    return projectNodeModulesBin;
  }
  return null;
};

const findTsserverPath = (projectDir: string): string | null => {
  const possiblePaths = [path.join(projectDir, 'node_modules', 'typescript', 'lib', 'tsserver.js')];

  for (const p of possiblePaths) {
    if (existsSync(p)) {
      return p;
    }
  }
  return null;
};

const hasDependency = (projectDir: string, dependencyName: string): boolean => {
  const packageJsonPath = path.join(projectDir, 'package.json');
  if (!existsSync(packageJsonPath)) {
    return false;
  }
  try {
    const packageJson = JSON.parse(readFileSync(packageJsonPath, 'utf-8'));
    return !!(packageJson.dependencies?.[dependencyName] || packageJson.devDependencies?.[dependencyName]);
  } catch {
    return false;
  }
};

const hasFile = (projectDir: string, fileName: string): boolean => {
  return existsSync(path.join(projectDir, fileName));
};

export const TypescriptServer: LspServerInfo = {
  id: 'typescript',
  languageId: 'typescript',
  extensions: TYPESCRIPT_EXTENSIONS,
  async spawn(rootDir: string, context: ExtensionContext): Promise<LspServerHandle | undefined> {
    if (hasFile(rootDir, 'deno.json') || hasFile(rootDir, 'deno.jsonc')) {
      context.log('Deno project detected, skipping TypeScript LSP (use Deno LSP)', 'debug');
      return undefined;
    }

    const tsserverPath = findTsserverPath(rootDir);
    if (!tsserverPath) {
      context.log('TypeScript not found in project, skipping TypeScript LSP', 'debug');
      return undefined;
    }

    const binary = findBinary('typescript-language-server', rootDir);
    let command = 'npx';
    let args = ['typescript-language-server', '--stdio'];

    if (binary) {
      command = binary;
      args = ['--stdio'];
    }

    context.log(`Starting TypeScript LSP server: ${command} ${args.join(' ')}`, 'info');

    const proc = await safeSpawn(command, args, 'TypeScript', context, { cwd: rootDir });

    return {
      process: proc,
      initializationOptions: {
        tsserver: {
          path: tsserverPath,
        },
      },
    };
  },
};

export const PythonServer: LspServerInfo = {
  id: 'python',
  languageId: 'python',
  extensions: PYTHON_EXTENSIONS,
  async spawn(rootDir: string, context: ExtensionContext): Promise<LspServerHandle | undefined> {
    const command = findBinary('pyright-langserver', rootDir) || findBinary('pyright', rootDir);
    const args = ['--stdio'];

    context.log(`Starting Python LSP server: ${command} ${args.join(' ')}`, 'info');

    const proc = await safeSpawn(command, args, 'Python', context, { cwd: rootDir });

    return {
      process: proc,
    };
  },
};

export const VueServer: LspServerInfo = {
  id: 'vue',
  languageId: 'vue',
  extensions: VUE_EXTENSIONS,
  async spawn(rootDir: string, context: ExtensionContext): Promise<LspServerHandle | undefined> {
    if (!hasDependency(rootDir, 'vue')) {
      context.log('Vue not found in project dependencies, skipping Vue LSP', 'debug');
      return undefined;
    }

    const binary = findBinary('vue-language-server', rootDir) || findBinary('volar', rootDir);
    let command = 'npx';
    let args = ['@vue/language-server', '--stdio'];

    if (binary) {
      command = binary;
      args = ['--stdio'];
    }

    context.log(`Starting Vue LSP server: ${command} ${args.join(' ')}`, 'info');

    const proc = await safeSpawn(command, args, 'Vue', context, { cwd: rootDir });

    return {
      process: proc,
      initializationOptions: {
        typescript: {
          tsdk: path.join(rootDir, 'node_modules', 'typescript', 'lib'),
        },
      },
    };
  },
};

export const RustServer: LspServerInfo = {
  id: 'rust',
  languageId: 'rust',
  extensions: RUST_EXTENSIONS,
  async spawn(rootDir: string, context: ExtensionContext): Promise<LspServerHandle | undefined> {
    if (!hasFile(rootDir, 'Cargo.toml')) {
      context.log('Cargo.toml not found, skipping Rust LSP', 'debug');
      return undefined;
    }

    const command = 'rust-analyzer';
    const args: string[] = [];

    context.log(`Starting Rust LSP server: ${command}`, 'info');

    const proc = await safeSpawn(command, args, 'Rust', context, { cwd: rootDir });

    return {
      process: proc,
    };
  },
};

export const GoServer: LspServerInfo = {
  id: 'go',
  languageId: 'go',
  extensions: GO_EXTENSIONS,
  async spawn(rootDir: string, context: ExtensionContext): Promise<LspServerHandle | undefined> {
    if (!hasFile(rootDir, 'go.mod')) {
      context.log(`go.mod not found in ${rootDir}, skipping Go LSP`, 'info');
      return undefined;
    }

    const command = 'gopls';
    const args = ['serve'];

    context.log(`Starting Go LSP server: ${command} ${args.join(' ')}`, 'info');

    const proc = await safeSpawn(command, args, 'Go', context, { cwd: rootDir });

    return {
      process: proc,
    };
  },
};

export const JavaServer: LspServerInfo = {
  id: 'java',
  languageId: 'java',
  extensions: JAVA_EXTENSIONS,
  async spawn(rootDir: string, context: ExtensionContext): Promise<LspServerHandle | undefined> {
    const hasJavaProject =
      hasFile(rootDir, 'pom.xml') ||
      hasFile(rootDir, 'build.gradle') ||
      hasFile(rootDir, 'build.gradle.kts') ||
      hasFile(rootDir, 'settings.gradle') ||
      hasFile(rootDir, 'settings.gradle.kts');

    if (!hasJavaProject) {
      context.log('No Java project file found (pom.xml, build.gradle), skipping Java LSP', 'debug');
      return undefined;
    }

    const command = 'jdtls';
    const args: string[] = [];

    context.log(`Starting Java LSP server: ${command}`, 'info');

    const proc = await safeSpawn(command, args, 'Java', context, { cwd: rootDir });

    return {
      process: proc,
    };
  },
};

export const LuaServer: LspServerInfo = {
  id: 'lua',
  languageId: 'lua',
  extensions: LUA_EXTENSIONS,
  async spawn(rootDir: string, context: ExtensionContext): Promise<LspServerHandle | undefined> {
    const command = 'lua-language-server';
    const args: string[] = [];

    context.log(`Starting Lua LSP server: ${command}`, 'info');

    const proc = await safeSpawn(command, args, 'Lua', context, { cwd: rootDir });

    return {
      process: proc,
    };
  },
};

export const SvelteServer: LspServerInfo = {
  id: 'svelte',
  languageId: 'svelte',
  extensions: SVELTE_EXTENSIONS,
  async spawn(rootDir: string, context: ExtensionContext): Promise<LspServerHandle | undefined> {
    if (!hasDependency(rootDir, 'svelte')) {
      context.log('Svelte not found in project dependencies, skipping Svelte LSP', 'debug');
      return undefined;
    }

    const binary = findBinary('svelteserver', rootDir);
    let command = 'npx';
    let args = ['svelte-language-server', '--stdio'];

    if (binary) {
      command = binary;
      args = ['--stdio'];
    }

    context.log(`Starting Svelte LSP server: ${command} ${args.join(' ')}`, 'info');

    const proc = await safeSpawn(command, args, 'Svelte', context, { cwd: rootDir });

    return {
      process: proc,
    };
  },
};

export const AstroServer: LspServerInfo = {
  id: 'astro',
  languageId: 'astro',
  extensions: ASTRO_EXTENSIONS,
  async spawn(rootDir: string, context: ExtensionContext): Promise<LspServerHandle | undefined> {
    if (!hasDependency(rootDir, 'astro')) {
      context.log('Astro not found in project dependencies, skipping Astro LSP', 'debug');
      return undefined;
    }

    const binary = findBinary('astro-ls', rootDir);
    let command = 'npx';
    let args = ['@astrojs/language-server', '--stdio'];

    if (binary) {
      command = binary;
      args = ['--stdio'];
    }

    context.log(`Starting Astro LSP server: ${command} ${args.join(' ')}`, 'info');

    const proc = await safeSpawn(command, args, 'Astro', context, { cwd: rootDir });

    return {
      process: proc,
      initializationOptions: {
        typescript: {
          tsdk: path.join(rootDir, 'node_modules', 'typescript', 'lib'),
        },
      },
    };
  },
};

export const CSharpServer: LspServerInfo = {
  id: 'csharp',
  languageId: 'csharp',
  extensions: CSHARP_EXTENSIONS,
  async spawn(rootDir: string, context: ExtensionContext): Promise<LspServerHandle | undefined> {
    const hasCSharpProject = hasFile(rootDir, '*.csproj') || hasFile(rootDir, '*.sln') || existsSync(path.join(rootDir, 'omnisharp.json'));

    if (!hasCSharpProject) {
      context.log('No C# project file found (.csproj, .sln), skipping C# LSP', 'debug');
      return undefined;
    }

    const command = 'omnisharp';
    const args = ['-lsp'];

    context.log(`Starting C# LSP server: ${command} ${args.join(' ')}`, 'info');

    const proc = await safeSpawn(command, args, 'C#', context, { cwd: rootDir });

    return {
      process: proc,
    };
  },
};

export const DenoServer: LspServerInfo = {
  id: 'deno',
  languageId: 'typescript',
  extensions: DENO_EXTENSIONS,
  async spawn(rootDir: string, context: ExtensionContext): Promise<LspServerHandle | undefined> {
    if (!hasFile(rootDir, 'deno.json') && !hasFile(rootDir, 'deno.jsonc')) {
      context.log('deno.json not found, skipping Deno LSP', 'debug');
      return undefined;
    }

    const command = 'deno';
    const args = ['lsp'];

    context.log(`Starting Deno LSP server: ${command} ${args.join(' ')}`, 'info');

    const proc = await safeSpawn(command, args, 'Deno', context, { cwd: rootDir });

    return {
      process: proc,
      initializationOptions: {
        enable: true,
        lint: true,
        unstable: true,
      },
    };
  },
};

export const SERVERS: LspServerInfo[] = [
  TypescriptServer,
  PythonServer,
  VueServer,
  RustServer,
  GoServer,
  JavaServer,
  LuaServer,
  SvelteServer,
  AstroServer,
  CSharpServer,
  DenoServer,
];

export const getServerForExtension = (extension: string): LspServerInfo | undefined => {
  return SERVERS.find((server) => server.extensions.includes(extension));
};

export const getServerForLanguageId = (languageId: string): LspServerInfo | undefined => {
  return SERVERS.find((server) => server.languageId === languageId);
};
