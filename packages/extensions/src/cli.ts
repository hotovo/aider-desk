import { createRequire } from 'node:module';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { homedir } from 'node:os';
import { existsSync, mkdirSync, cpSync, writeFileSync, rmSync, readFileSync } from 'node:fs';
import { spawn } from 'node:child_process';

import { Command } from 'commander';
import { checkbox } from '@inquirer/prompts';
import chalk from 'chalk';
import ora from 'ora';

const require = createRequire(import.meta.url);
const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);

const EXTENSIONS_JSON_PATH = join(__dirname, '..', 'extensions.json');
const EXTENSIONS_DIR = join(__dirname, '..', 'extensions');
const PACKAGE_VERSION = require('../package.json').version;
const CACHE_FILE = join(homedir(), '.aider-desk', 'extension-cache.json');
const CACHE_TTL = 60 * 60 * 1000; // 1 hour in milliseconds
const GITHUB_API_URL = 'https://api.github.com/repos/hotovo/aider-desk/contents/packages/extensions/extensions';

interface Extension {
  id: string;
  name: string;
  description: string;
  file?: string;
  folder?: string;
  type: 'single' | 'folder';
  hasDependencies?: boolean;
  capabilities: string[];
}

interface ExamplesConfig {
  extensions: Extension[];
}

interface CacheData {
  timestamp: number;
  extensions: Extension[];
}

interface GitHubContent {
  name: string;
  type: 'file' | 'dir';
  download_url: string | null;
}

function loadFromCache(): CacheData | null {
  try {
    if (!existsSync(CACHE_FILE)) {
      return null;
    }

    const cacheContent = readFileSync(CACHE_FILE, 'utf-8');
    const cache: CacheData = JSON.parse(cacheContent);

    // Check if cache is still valid
    if (Date.now() - cache.timestamp < CACHE_TTL) {
      return cache;
    }

    return null;
  } catch {
    return null;
  }
}

function saveToCache(extensions: Extension[]): void {
  try {
    const cacheDir = dirname(CACHE_FILE);
    if (!existsSync(cacheDir)) {
      mkdirSync(cacheDir, { recursive: true });
    }

    const cacheData: CacheData = {
      timestamp: Date.now(),
      extensions,
    };

    writeFileSync(CACHE_FILE, JSON.stringify(cacheData, null, 2), 'utf-8');
  } catch {
    // Silently fail if cache cannot be saved
  }
}

function loadLocalExtensionsMap(): Map<string, Extension> {
  try {
    const localConfig: ExamplesConfig = require(EXTENSIONS_JSON_PATH);
    const map = new Map<string, Extension>();
    localConfig.extensions.forEach((ext) => {
      map.set(ext.id, ext);
    });
    return map;
  } catch {
    return new Map();
  }
}

async function fetchExtensions(): Promise<Extension[] | null> {
  try {
    const response = await fetch(GITHUB_API_URL, {
      headers: {
        'User-Agent': 'aiderdesk-extensions-cli',
      },
    });

    if (!response.ok) {
      return null;
    }

    const contents = (await response.json()) as GitHubContent[];
    const localExtensionsMap = loadLocalExtensionsMap();

    const extensions: Extension[] = contents
      .filter((item) => item.type === 'file' || item.type === 'dir')
      .filter((item) => {
        // Filter out non-extension files
        if (item.type === 'file') {
          return item.name.endsWith('.ts') || item.name.endsWith('.js');
        }
        return true;
      })
      .map((item) => {
        const isFile = item.type === 'file';
        const id = isFile ? item.name.replace(/\.(ts|js)$/, '') : item.name;

        // Check if we have metadata in local extensions.json
        const localExt = localExtensionsMap.get(id);
        if (localExt) {
          // Use local metadata as-is (it has correct file/folder names and type)
          return localExt;
        }

        // No local metadata - create basic extension entry without description
        const name = id
          .split('-')
          .map((word) => word.charAt(0).toUpperCase() + word.slice(1))
          .join(' ');

        return {
          id,
          name,
          description: '',
          type: isFile ? ('single' as const) : ('folder' as const),
          file: isFile ? item.name : undefined,
          folder: isFile ? undefined : item.name,
          capabilities: [],
        };
      });

    return extensions;
  } catch {
    return null;
  }
}

async function loadExtensions(): Promise<ExamplesConfig> {
  // Try fetching from GitHub first
  const dynamicExtensions = await fetchExtensions();
  if (dynamicExtensions && dynamicExtensions.length > 0) {
    // Save to cache
    saveToCache(dynamicExtensions);
    return { extensions: dynamicExtensions };
  }

  // Try loading from cache
  const cachedData = loadFromCache();
  if (cachedData && cachedData.extensions.length > 0) {
    return { extensions: cachedData.extensions };
  }

  // Fallback to local JSON
  try {
    return require(EXTENSIONS_JSON_PATH);
  } catch {
    console.error(chalk.red('Error: Could not load extensions from any source'));
    process.exit(1);
  }
}

function getCloneUrl(webUrl: string): string | null {
  try {
    const url = new URL(webUrl);
    if (url.hostname !== 'github.com') {
      return null;
    }

    const pathParts = url.pathname.split('/').filter(Boolean);
    if (pathParts.length < 2) {
      return null;
    }

    const owner = pathParts[0];
    const repo = pathParts[1];
    return `https://github.com/${owner}/${repo}.git`;
  } catch {
    return null;
  }
}

function getExtensionsPath(repoUrl: string): string | null {
  try {
    const url = new URL(repoUrl);
    const pathParts = url.pathname.split('/').filter(Boolean);

    if (pathParts.length > 4 && (pathParts[2] === 'tree' || pathParts[2] === 'blob')) {
      const extensionPath = pathParts.slice(4).join('/');
      return extensionPath;
    }

    return null;
  } catch {
    return null;
  }
}

function getInstallDirectory(options: { global?: boolean; directory?: string }): string {
  if (options.directory) {
    return options.directory;
  }

  if (options.global) {
    return join(homedir(), '.aider-desk', 'extensions');
  }

  // Default to project-local extensions
  return join(process.cwd(), '.aider-desk', 'extensions');
}

function isUrl(str: string): boolean {
  try {
    new URL(str);
    return true;
  } catch {
    return false;
  }
}

async function installExtensionById(extId: string, extensions: Extension[], targetDir: string): Promise<void> {
  const ext = extensions.find((e) => e.id === extId);

  if (!ext) {
    console.error(chalk.red(`\nError: Extension "${extId}" not found.`));
    console.log(chalk.yellow('\nAvailable extensions:'));
    extensions.forEach((e) => console.log(chalk.gray(`  - ${e.id}`)));
    process.exit(1);
  }

  // Ensure target directory exists
  if (!existsSync(targetDir)) {
    mkdirSync(targetDir, { recursive: true });
  }

  console.log(chalk.cyan(`\nInstalling ${ext.name} to: ${targetDir}\n`));

  const spinner = ora(`Installing ${ext.name}...`).start();

  try {
    const GITHUB_RAW_BASE = 'https://raw.githubusercontent.com/hotovo/aider-desk/main/packages/extensions/extensions';
    const GITHUB_REPO = 'https://github.com/hotovo/aider-desk';

    if (ext.type === 'single' && ext.file) {
      // Try local file first (for development)
      const localPath = join(EXTENSIONS_DIR, ext.file);

      if (existsSync(localPath)) {
        spinner.text = `Copying ${ext.name} from package...`;
        const targetPath = join(targetDir, ext.file);
        cpSync(localPath, targetPath);
        spinner.succeed(chalk.green(`✓ Installed ${ext.name}`));
      } else {
        // Download from GitHub
        spinner.text = `Downloading ${ext.name} from GitHub...`;

        const url = `${GITHUB_RAW_BASE}/${ext.file}`;
        const response = await fetch(url);

        if (!response.ok) {
          throw new Error(`Failed to download from GitHub: ${response.statusText}`);
        }

        const code = await response.text();
        const targetPath = join(targetDir, ext.file);
        writeFileSync(targetPath, code, 'utf-8');

        spinner.succeed(chalk.green(`✓ Installed ${ext.name} from GitHub`));
      }
    } else if (ext.type === 'folder' && ext.folder) {
      // Try local folder first (for development)
      const localPath = join(EXTENSIONS_DIR, ext.folder);

      if (existsSync(localPath)) {
        spinner.text = `Copying ${ext.name} from package...`;
        const targetPath = join(targetDir, ext.folder);
        cpSync(localPath, targetPath, { recursive: true });
        spinner.succeed(chalk.green(`✓ Installed ${ext.name}`));

        // Install dependencies if package.json exists
        if (existsSync(join(targetPath, 'package.json'))) {
          await installDependencies(targetPath);
        }
      } else {
        // Clone from GitHub using sparse checkout
        spinner.text = `Downloading ${ext.name} from GitHub...`;

        const tempDir = join(process.cwd(), `.temp-ext-${Date.now()}`);
        const extensionPath = `packages/extensions/extensions/${ext.folder}`;

        try {
          // Clone with sparse checkout (fetches minimal metadata only)
          spinner.text = 'Cloning repository with sparse checkout...';
          await runCommand('git', ['clone', '--depth', '1', '--sparse', GITHUB_REPO, tempDir]);

          // Set sparse-checkout to the target subdirectory
          spinner.text = 'Configuring sparse checkout path...';
          await runCommand('git', ['-C', tempDir, 'sparse-checkout', 'set', extensionPath]);

          // Copy extension folder from sparse checkout
          const sourceDir = join(tempDir, extensionPath);
          const targetPath = join(targetDir, ext.folder);

          if (!existsSync(sourceDir)) {
            throw new Error(`Extension folder not found in repository: ${extensionPath}`);
          }

          spinner.text = 'Copying extension files...';
          cpSync(sourceDir, targetPath, { recursive: true });
          spinner.succeed(chalk.green(`✓ Installed ${ext.name} from GitHub`));

          // Install dependencies if package.json exists
          if (existsSync(join(targetPath, 'package.json'))) {
            await installDependencies(targetPath);
          }
        } finally {
          // Cleanup temp directory
          if (existsSync(tempDir)) {
            rmSync(tempDir, { recursive: true, force: true });
          }
        }
      }
    }

    console.log(chalk.cyan('\n✨ Installation complete!\n'));
    console.log(chalk.gray('Extensions will be automatically loaded when you restart AiderDesk.'));
    console.log(chalk.gray('Or they will hot-reload if AiderDesk is already running.\n'));
  } catch (error) {
    spinner.fail(chalk.red(`✗ Failed to install ${ext.name}: ${error}`));
    process.exit(1);
  }
}

async function installFromUrl(url: string, targetDir: string): Promise<void> {
  const spinner = ora('Downloading extension...').start();

  try {
    // Ensure target directory exists
    if (!existsSync(targetDir)) {
      mkdirSync(targetDir, { recursive: true });
    }

    // Determine if it's a single file or a folder
    const urlPath = new URL(url).pathname;
    const fileName = urlPath.split('/').pop() || 'extension.ts';

    if (fileName.endsWith('.ts') || fileName.endsWith('.js')) {
      // Single file extension
      spinner.text = 'Downloading single file extension...';

      const response = await fetch(url);
      if (!response.ok) {
        throw new Error(`Failed to download: ${response.statusText}`);
      }

      const code = await response.text();
      const targetPath = join(targetDir, fileName);
      writeFileSync(targetPath, code, 'utf-8');

      spinner.succeed(chalk.green(`✓ Installed ${fileName} to ${targetDir}`));
    } else {
      // Assume it's a GitHub folder - use sparse checkout for efficiency
      spinner.text = 'Downloading extension folder...';

      if (url.includes('github.com')) {
        const cloneUrl = getCloneUrl(url);
        const extensionsPath = getExtensionsPath(url);

        if (!cloneUrl) {
          throw new Error('Invalid GitHub URL - could not extract repository URL');
        }

        const extName = urlPath.split('/').pop() || 'extension';
        const tempDir = join(process.cwd(), `.temp-ext-${Date.now()}`);

        try {
          if (extensionsPath) {
            // URL includes /tree/{branch}/{path} — use sparse checkout for efficiency
            spinner.text = 'Cloning repository with sparse checkout...';
            await runCommand('git', ['clone', '--depth', '1', '--sparse', cloneUrl, tempDir]);

            spinner.text = 'Configuring sparse checkout path...';
            await runCommand('git', ['-C', tempDir, 'sparse-checkout', 'set', extensionsPath]);

            const sourceDir = join(tempDir, extensionsPath);
            const targetPath = join(targetDir, extName);

            if (!existsSync(sourceDir)) {
              throw new Error(`Extension folder not found in repository: ${extensionsPath}`);
            }

            spinner.text = 'Copying extension files...';
            cpSync(sourceDir, targetPath, { recursive: true });
            spinner.succeed(chalk.green(`✓ Installed ${extName} to ${targetDir}`));

            // Install dependencies if package.json exists
            if (existsSync(join(targetPath, 'package.json'))) {
              await installDependencies(targetPath);
            }
          } else {
            // Bare repo URL (e.g. https://github.com/owner/repo) — clone fully, copy entire repo as extension folder
            spinner.text = 'Cloning repository...';
            await runCommand('git', ['clone', '--depth', '1', cloneUrl, tempDir]);

            // Use repo name as extension folder name
            const targetPath = join(targetDir, extName);

            spinner.text = `Installing ${extName}...`;
            cpSync(tempDir, targetPath, { recursive: true });

            // Remove .git directory from installed extension
            const gitDir = join(targetPath, '.git');
            if (existsSync(gitDir)) {
              rmSync(gitDir, { recursive: true, force: true });
            }

            // Install dependencies if package.json exists
            if (existsSync(join(targetPath, 'package.json'))) {
              await installDependencies(targetPath);
            }

            spinner.succeed(chalk.green(`✓ Installed ${extName} to ${targetPath}`));
          }
        } finally {
          // Cleanup temp directory
          if (existsSync(tempDir)) {
            rmSync(tempDir, { recursive: true, force: true });
          }
        }
      } else {
        throw new Error('Only GitHub URLs are supported for folder extensions');
      }
    }
  } catch (error) {
    spinner.fail(chalk.red(`Failed to install extension: ${error}`));
    process.exit(1);
  }
}

async function installFromExamples(extensions: Extension[], targetDir: string): Promise<void> {
  console.log(chalk.cyan('\n📦 Available AiderDesk Extensions\n'));

  const choices = extensions.map((ext) => ({
    name: ext.description ? `${ext.name} - ${ext.description}` : ext.name,
    value: ext.id,
    disabled: false,
  }));

  const selectedIds = await checkbox({
    message: 'Select extensions to install (space to select, enter to confirm):',
    choices,
    pageSize: 15,
  });

  if (selectedIds.length === 0) {
    console.log(chalk.yellow('\nNo extensions selected. Exiting.'));
    return;
  }

  // Ensure target directory exists
  if (!existsSync(targetDir)) {
    mkdirSync(targetDir, { recursive: true });
  }

  console.log(chalk.cyan(`\nInstalling to: ${targetDir}\n`));

  for (const extId of selectedIds) {
    await installExtensionById(extId, extensions, targetDir);
  }
}

async function installDependencies(targetPath: string): Promise<void> {
  const spinner = ora('Installing dependencies...').start();

  try {
    await runCommand('npm', ['install'], { cwd: targetPath });
    spinner.succeed(chalk.green('✓ Dependencies installed'));
  } catch (error) {
    spinner.fail(chalk.red(`Failed to install dependencies: ${error}`));
    console.log(chalk.yellow(`You may need to manually run: cd ${targetPath} && npm install`));
  }
}

function runCommand(command: string, args: string[], options?: { cwd?: string }): Promise<void> {
  return new Promise((resolve, reject) => {
    const child = spawn(command, args, {
      cwd: options?.cwd || process.cwd(),
      stdio: 'inherit',
      shell: true,
    });

    child.on('error', reject);
    child.on('exit', (code) => {
      if (code === 0) {
        resolve();
      } else {
        reject(new Error(`Command failed with exit code ${code}`));
      }
    });
  });
}

async function main() {
  const program = new Command();

  program.name('aiderdesk-extensions').description('CLI tool for installing AiderDesk extensions').version(PACKAGE_VERSION);

  program
    .command('install [extension]')
    .description('Install AiderDesk extensions interactively, by ID, or from a URL')
    .option('-d, --directory <path>', 'Custom installation directory')
    .option('-g, --global', 'Install to global directory (~/.aider-desk/extensions)')
    .action(async (extension: string | undefined, options: { directory?: string; global?: boolean }) => {
      const targetDir = getInstallDirectory(options);
      const examples = await loadExtensions();

      console.log(chalk.cyan.bold('\n🚀 AiderDesk Extension Installer\n'));

      if (extension) {
        // Check if it's a URL or an extension ID
        if (isUrl(extension)) {
          await installFromUrl(extension, targetDir);
        } else {
          // Treat as extension ID
          await installExtensionById(extension, examples.extensions, targetDir);
        }
      } else {
        // Interactive selection
        await installFromExamples(examples.extensions, targetDir);
      }
    });

  program
    .command('list')
    .description('List all available example extensions')
    .action(async () => {
      const examples = await loadExtensions();

      console.log(chalk.cyan.bold('\n📦 Available AiderDesk Extensions\n'));

      examples.extensions.forEach((ext) => {
        console.log(chalk.white.bold(`  ${ext.name}`));
        if (ext.description) {
          console.log(chalk.gray(`    ${ext.description}`));
        }
        console.log(chalk.gray(`    Type: ${ext.type}`));
        if (ext.hasDependencies) {
          console.log(chalk.yellow('    ⚠ Has dependencies'));
        }
        console.log();
      });
    });

  program.parse();
}

main().catch((error) => {
  console.error(chalk.red(`Error: ${error.message}`));
  process.exit(1);
});
