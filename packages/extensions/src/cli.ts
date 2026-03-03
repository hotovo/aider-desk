import { createRequire } from 'node:module';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { homedir } from 'node:os';
import { existsSync, mkdirSync, cpSync, writeFileSync, rmSync } from 'node:fs';
import { spawn } from 'node:child_process';

import { Command } from 'commander';
import { checkbox, confirm } from '@inquirer/prompts';
import chalk from 'chalk';
import ora from 'ora';

const require = createRequire(import.meta.url);
const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);

const EXTENSIONS_JSON_PATH = join(__dirname, '..', 'extensions.json');
const EXTENSIONS_DIR = join(__dirname, '..', 'extensions');
const PACKAGE_VERSION = require('../package.json').version;

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

function loadExtensions(): ExamplesConfig {
  try {
    return require(EXTENSIONS_JSON_PATH);
  } catch {
    console.error(chalk.red('Error: Could not load extensions.json'));
    process.exit(1);
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

        // Install dependencies if needed
        if (ext.hasDependencies && existsSync(join(targetPath, 'package.json'))) {
          const installDeps = await confirm({
            message: `${ext.name} has dependencies. Install them now?`,
            default: true,
          });

          if (installDeps) {
            await installDependencies(targetPath);
          }
        }
      } else {
        // Clone from GitHub
        spinner.text = `Downloading ${ext.name} from GitHub...`;

        const tempDir = join(process.cwd(), `.temp-ext-${Date.now()}`);

        try {
          // Clone repo temporarily
          await runCommand('git', ['clone', '--depth', '1', GITHUB_REPO, tempDir]);

          // Copy extension folder
          const sourceDir = join(tempDir, 'packages', 'extensions', 'extensions', ext.folder);
          const targetPath = join(targetDir, ext.folder);

          if (!existsSync(sourceDir)) {
            throw new Error('Extension folder not found in repository');
          }

          cpSync(sourceDir, targetPath, { recursive: true });
          spinner.succeed(chalk.green(`✓ Installed ${ext.name} from GitHub`));

          // Install dependencies if needed
          if (ext.hasDependencies && existsSync(join(targetPath, 'package.json'))) {
            const installDeps = await confirm({
              message: `${ext.name} has dependencies. Install them now?`,
              default: true,
            });

            if (installDeps) {
              await installDependencies(targetPath);
            }
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
      // Assume it's a GitHub folder - we need to clone or download
      spinner.text = 'Downloading extension folder...';

      // For GitHub URLs, we'll use git clone temporarily
      if (url.includes('github.com')) {
        const tempDir = join(process.cwd(), `.temp-ext-${Date.now()}`);

        try {
          // Clone repo temporarily
          await runCommand('git', ['clone', '--depth', '1', url, tempDir]);

          // Copy extension folder
          const extName = urlPath.split('/').pop() || 'extension';
          const sourceDir = join(tempDir, extName);
          const targetPath = join(targetDir, extName);

          if (existsSync(sourceDir)) {
            cpSync(sourceDir, targetPath, { recursive: true });
            spinner.succeed(chalk.green(`✓ Installed ${extName} to ${targetDir}`));

            // Check for package.json and install dependencies
            if (existsSync(join(targetPath, 'package.json'))) {
              const installDeps = await confirm({
                message: 'This extension has dependencies. Install them now?',
                default: true,
              });

              if (installDeps) {
                await installDependencies(targetPath);
              }
            }
          } else {
            throw new Error('Extension folder not found in repository');
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
    name: `${ext.name} - ${ext.description}`,
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
    const ext = extensions.find((e) => e.id === extId);
    if (!ext) {
      continue;
    }

    const spinner = ora(`Installing ${ext.name}...`).start();

    try {
      if (ext.type === 'single' && ext.file) {
        const sourcePath = join(EXTENSIONS_DIR, ext.file);
        const targetPath = join(targetDir, ext.file);

        if (!existsSync(sourcePath)) {
          spinner.fail(chalk.yellow(`⚠ ${ext.name} source file not found, skipping`));
          continue;
        }

        cpSync(sourcePath, targetPath);
        spinner.succeed(chalk.green(`✓ Installed ${ext.name}`));
      } else if (ext.type === 'folder' && ext.folder) {
        const sourcePath = join(EXTENSIONS_DIR, ext.folder);
        const targetPath = join(targetDir, ext.folder);

        if (!existsSync(sourcePath)) {
          spinner.fail(chalk.yellow(`⚠ ${ext.name} source folder not found, skipping`));
          continue;
        }

        cpSync(sourcePath, targetPath, { recursive: true });
        spinner.succeed(chalk.green(`✓ Installed ${ext.name}`));

        // Install dependencies if needed
        if (ext.hasDependencies && existsSync(join(targetPath, 'package.json'))) {
          const installDeps = await confirm({
            message: `${ext.name} has dependencies. Install them now?`,
            default: true,
          });

          if (installDeps) {
            await installDependencies(targetPath);
          }
        }
      }
    } catch (error) {
      spinner.fail(chalk.red(`✗ Failed to install ${ext.name}: ${error}`));
    }
  }

  console.log(chalk.cyan('\n✨ Installation complete!\n'));
  console.log(chalk.gray('Extensions will be automatically loaded when you restart AiderDesk.'));
  console.log(chalk.gray('Or they will hot-reload if AiderDesk is already running.\n'));
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
      const examples = loadExtensions();

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
    .action(() => {
      const examples = loadExtensions();

      console.log(chalk.cyan.bold('\n📦 Available AiderDesk Extensions\n'));

      examples.extensions.forEach((ext) => {
        console.log(chalk.white.bold(`  ${ext.name}`));
        console.log(chalk.gray(`    ${ext.description}`));
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
