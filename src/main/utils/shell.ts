import { exec, execSync } from 'child_process';
import * as os from 'os';
import * as path from 'path';
import * as fs from 'fs';
import { promisify } from 'util';

import logger from '@/logger';
import { getElectronApp } from '@/app';

const execAsync = promisify(exec);

let cachedPath: string | null = null;
let isFirstCall: boolean = true;

interface ShellInfo {
  path: string;
  name: string;
  args?: string[];
}

class ShellDetector {
  private static cachedShell: ShellInfo | null = null;

  /**
   * Get the user's default shell
   * @param forceRefresh Force re-detection instead of using cache
   * @returns Shell information including path and name
   */
  static getDefaultShell(forceRefresh = false): ShellInfo {
    if (!forceRefresh && this.cachedShell) {
      return this.cachedShell;
    }

    const shell = this.detectShell();
    this.cachedShell = shell;
    return shell;
  }

  private static detectShell(): ShellInfo {
    const platform = process.platform;

    if (platform === 'win32') {
      return this.detectWindowsShell();
    } else {
      return this.detectUnixShell();
    }
  }

  private static detectWindowsShell(): ShellInfo {
    // Check for PowerShell Core first
    const pwshPath = this.findExecutable('pwsh.exe');
    if (pwshPath) {
      return { path: pwshPath, name: 'pwsh' };
    }

    // Check for Windows PowerShell
    const powershellPath = this.findExecutable('powershell.exe');
    if (powershellPath) {
      return { path: powershellPath, name: 'powershell' };
    }

    // Fall back to cmd.exe
    const cmdPath = path.join(process.env.SYSTEMROOT || 'C:\\Windows', 'System32', 'cmd.exe');
    if (fs.existsSync(cmdPath)) {
      return { path: cmdPath, name: 'cmd' };
    }

    // Last resort
    return { path: 'cmd.exe', name: 'cmd' };
  }

  private static detectUnixShell(): ShellInfo {
    // First, try the SHELL environment variable
    const envShell = process.env.SHELL;
    if (envShell && fs.existsSync(envShell)) {
      const name = path.basename(envShell);
      return { path: envShell, name, args: this.getShellArgs(name) };
    }

    // On macOS, try to get the default shell from Directory Services
    if (process.platform === 'darwin') {
      try {
        const username = os.userInfo().username;
        const result = execSync(`dscl . -read /Users/${username} UserShell`, { encoding: 'utf8' });
        const match = result.match(/UserShell:\s*(.+)/);
        if (match && match[1]) {
          const shellPath = match[1].trim();
          if (fs.existsSync(shellPath)) {
            const name = path.basename(shellPath);
            return { path: shellPath, name, args: this.getShellArgs(name) };
          }
        }
      } catch {
        // Ignore errors and continue with fallback detection
      }
    }

    // Try to read from /etc/passwd
    try {
      const username = os.userInfo().username;
      const passwdContent = fs.readFileSync('/etc/passwd', 'utf8');
      const userLine = passwdContent.split('\n').find((line) => line.startsWith(`${username}:`));
      if (userLine) {
        const parts = userLine.split(':');
        const shellPath = parts[6];
        if (shellPath && fs.existsSync(shellPath)) {
          const name = path.basename(shellPath);
          return { path: shellPath, name, args: this.getShellArgs(name) };
        }
      }
    } catch {
      // Ignore errors and continue with fallback detection
    }

    // Try common shell paths in order of preference
    const commonShells = [
      '/usr/local/bin/zsh',
      '/bin/zsh',
      '/usr/bin/zsh',
      '/usr/local/bin/fish',
      '/usr/bin/fish',
      '/usr/local/bin/bash',
      '/bin/bash',
      '/usr/bin/bash',
      '/bin/sh',
      '/usr/bin/sh',
    ];

    for (const shellPath of commonShells) {
      if (fs.existsSync(shellPath)) {
        const name = path.basename(shellPath);
        return { path: shellPath, name, args: this.getShellArgs(name) };
      }
    }

    // Last resort - use sh
    return { path: '/bin/sh', name: 'sh', args: ['-i'] };
  }

  private static findExecutable(name: string): string | null {
    const pathEnv = process.env.PATH || '';
    const pathDirs = pathEnv.split(path.delimiter);

    for (const dir of pathDirs) {
      const fullPath = path.join(dir, name);
      if (fs.existsSync(fullPath)) {
        try {
          fs.accessSync(fullPath, fs.constants.X_OK);
          return fullPath;
        } catch {
          // Not executable, continue searching
        }
      }
    }

    return null;
  }

  private static getShellArgs(shellName: string): string[] {
    // Return appropriate arguments for interactive shell sessions
    switch (shellName) {
      case 'bash':
      case 'sh':
      case 'zsh':
      case 'fish':
        return ['-i']; // Interactive mode
      case 'pwsh':
      case 'powershell':
        return ['-NoExit']; // Keep PowerShell open
      default:
        return [];
    }
  }

  /**
   * Get shell-specific command execution arguments
   * @param command The command to execute
   * @returns Array of arguments to pass to spawn/exec
   */
  static getShellCommandArgs(command: string): { shell: string; args: string[] } {
    const shellInfo = this.getDefaultShell();

    switch (shellInfo.name) {
      case 'cmd':
        return { shell: shellInfo.path, args: ['/c', command] };
      case 'powershell':
      case 'pwsh':
        return { shell: shellInfo.path, args: ['-Command', command] };
      default:
        // Unix shells
        return { shell: shellInfo.path, args: ['-c', command] };
    }
  }

  /**
   * Check if a shell exists at the given path
   * @param shellPath Path to the shell executable
   * @returns true if the shell exists and is executable
   */
  static isShellAvailable(shellPath: string): boolean {
    try {
      fs.accessSync(shellPath, fs.constants.X_OK);
      return true;
    } catch {
      return false;
    }
  }
}

/**
 * Get the path separator for the current platform
 */
const getPathSeparator = (): string => (process.platform === 'win32' ? ';' : ':');

/**
 * Get the user's shell PATH by executing their shell
 */
export const getShellPath = (): string => {
  // In packaged apps, always refresh PATH on first call to avoid cached restricted PATH
  if (cachedPath && !isFirstCall) {
    logger.debug('Using cached PATH');
    return cachedPath;
  }
  isFirstCall = false;

  logger.info('Starting PATH detection...', {
    platform: process.platform,
    currentPath: process.env.PATH ? process.env.PATH.substring(0, 200) + '...' : 'not set',
    shell: process.env.SHELL || 'not set',
    homeDir: os.homedir(),
  });

  const isWindows = process.platform === 'win32';
  const pathSep = getPathSeparator();

  try {
    let shellPath: string;

    if (isWindows) {
      // On Windows, use cmd.exe to get PATH
      logger.info('Getting Windows PATH using cmd.exe');

      shellPath = execSync('echo %PATH%', {
        encoding: 'utf8',
        timeout: 5000,
        shell: 'cmd.exe',
      }).trim();

      // Also try to get PATH from PowerShell for more complete results
      try {
        const psPath = execSync('powershell -Command "$env:PATH"', {
          encoding: 'utf8',
          timeout: 5000,
        }).trim();

        if (psPath) {
          // Combine both paths
          const combinedPaths = new Set([...shellPath.split(pathSep), ...psPath.split(pathSep)]);
          shellPath = Array.from(combinedPaths)
            .filter((p) => p)
            .join(pathSep);
        }
      } catch {
        // PowerShell might not be available, continue with cmd.exe result
      }
    } else {
      // Unix/macOS logic - use ShellDetector to get the actual shell
      const shellInfo = ShellDetector.getDefaultShell();
      const shell = shellInfo.path;
      const isLinux = process.platform === 'linux';

      logger.debug(`Detected shell: ${shell} (${shellInfo.name})`);

      // For Linux, avoid slow interactive shell startup
      // Use non-interactive mode for better performance
      const shellCommand = isLinux
        ? `${shell} -c 'echo $PATH'` // Fast non-interactive mode for Linux
        : `${shell} -l -i -c 'echo $PATH'`; // Keep login shell for macOS

      logger.debug('Unix/Linux PATH detection', {
        shell,
        isLinux,
        shellCommand,
      });

      // Execute the command to get the PATH
      // For packaged apps, ALWAYS use login shell to get the user's real PATH
      const app = getElectronApp();
      const isPackaged = process.env.NODE_ENV === 'production' || 'pkg' in process || app?.isPackaged;

      if (isPackaged) {
        logger.info('Running in packaged app, using login shell to get full PATH...');

        // Use minimal base PATH - just enough to find the shell
        const minimalPath = '/usr/bin:/bin';

        // Use login shell to load user's full environment
        try {
          // First try with explicit sourcing of shell config files
          let sourceCommand = '';
          const homeDir = os.homedir();

          if (shell.includes('zsh')) {
            // For zsh, source the standard config files
            sourceCommand =
              'source /etc/zprofile 2>/dev/null || true; ' +
              `source ${homeDir}/.zprofile 2>/dev/null || true; ` +
              'source /etc/zshrc 2>/dev/null || true; ' +
              `source ${homeDir}/.zshrc 2>/dev/null || true; `;
          } else if (shell.includes('bash')) {
            // For bash, source the standard config files
            sourceCommand =
              'source /etc/profile 2>/dev/null || true; ' +
              `source ${homeDir}/.bash_profile 2>/dev/null || true; ` +
              `source ${homeDir}/.bashrc 2>/dev/null || true; `;
          }

          const fullCommand = `${shell} -c '${sourceCommand}echo $PATH'`;

          shellPath = execSync(fullCommand, {
            encoding: 'utf8',
            timeout: isLinux ? 3000 : 10000, // Shorter timeout for Linux
            env: {
              PATH: minimalPath,
              SHELL: shell,
              USER: os.userInfo().username,
              HOME: homeDir,
              // Add ZDOTDIR for zsh users who might have custom config location
              ZDOTDIR: process.env.ZDOTDIR || homeDir,
            },
          }).trim();

          logger.debug('Successfully loaded user PATH from shell config files', {
            fullCommand,
            pathLength: shellPath.split(':').length,
          });
        } catch (error) {
          logger.error('Failed to load PATH from shell config:', error);

          // Try the standard login shell approach
          try {
            shellPath = execSync(shellCommand, {
              encoding: 'utf8',
              timeout: isLinux ? 3000 : 10000, // Shorter timeout for Linux
              env: {
                PATH: minimalPath,
                SHELL: shell,
                USER: os.userInfo().username,
                HOME: os.homedir(),
              },
            }).trim();
            logger.debug('Loaded PATH using login shell flags');
          } catch (loginError) {
            logger.error('Failed to load PATH from login shell:', loginError);
            // Fallback to current PATH + common locations
            shellPath = process.env.PATH || '';
          }
        }
      } else {
        // In development, try faster approach first
        try {
          shellPath = execSync(`${shell} -c 'echo $PATH'`, {
            encoding: 'utf8',
            timeout: 2000,
            env: process.env,
          }).trim();
          logger.debug('Quick PATH retrieval succeeded');
        } catch (quickError) {
          logger.debug('Quick PATH retrieval failed, falling back to login shell approach', {
            error: quickError instanceof Error ? quickError.message : quickError,
          });
          shellPath = execSync(shellCommand, {
            encoding: 'utf8',
            timeout: isLinux ? 3000 : 10000, // Shorter timeout for Linux
            env: process.env,
          }).trim();
          logger.debug('Login shell PATH retrieval succeeded');
        }
      }
    }

    logger.debug('Retrieved shell PATH', {
      entries: shellPath.split(pathSep).length,
      preview: shellPath.substring(0, 200) + '...',
    });

    // Combine with current process PATH to ensure we don't lose anything
    const currentPath = process.env.PATH || '';
    logger.debug('Current process PATH', {
      entries: currentPath.split(pathSep).length,
    });

    // Also include npm global bin directories
    const additionalPaths: string[] = [];
    const isLinux = process.platform === 'linux';

    // Skip npm/yarn checks on Linux for better performance (they're usually in PATH already)
    if (!isLinux) {
      logger.debug('Checking for npm/yarn global paths (non-Linux)...');
      // Try to get npm global bin directory
      try {
        const npmBin = execSync('npm bin -g', {
          encoding: 'utf8',
          timeout: 2000,
          stdio: ['pipe', 'pipe', 'ignore'],
        }).trim();
        if (npmBin) {
          additionalPaths.push(npmBin);
        }
      } catch {
        // Ignore npm bin errors
      }

      // Try to get yarn global bin directory
      try {
        const yarnBin = execSync('yarn global bin', {
          encoding: 'utf8',
          timeout: 2000,
          stdio: ['pipe', 'pipe', 'ignore'],
        }).trim();
        if (yarnBin) {
          additionalPaths.push(yarnBin);
        }
      } catch {
        // Ignore yarn bin errors
      }
    }

    if (isWindows) {
      // Windows-specific paths
      additionalPaths.push(
        path.join(os.homedir(), 'AppData', 'Roaming', 'npm'),
        path.join(os.homedir(), 'AppData', 'Local', 'Yarn', 'bin'),
        path.join(process.env.PROGRAMFILES || 'C:\\Program Files', 'Git', 'bin'),
        path.join(process.env.PROGRAMFILES || 'C:\\Program Files', 'Git', 'cmd'),
        path.join(process.env['PROGRAMFILES(X86)'] || 'C:\\Program Files (x86)', 'Git', 'bin'),
        path.join(process.env['PROGRAMFILES(X86)'] || 'C:\\Program Files (x86)', 'Git', 'cmd'),
      );

      // Check for nvm-windows
      const nvmHome = process.env.NVM_HOME;
      if (nvmHome && fs.existsSync(nvmHome)) {
        additionalPaths.push(nvmHome);
      }

      // Check for nvm-windows symlink
      const nvmSymlink = process.env.NVM_SYMLINK;
      if (nvmSymlink && fs.existsSync(nvmSymlink)) {
        additionalPaths.push(nvmSymlink);
      }
    } else {
      // Unix/macOS-specific paths
      additionalPaths.push(path.join(os.homedir(), '.yarn', 'bin'), path.join(os.homedir(), '.config', 'yarn', 'global', 'node_modules', '.bin'));

      // Linux-specific common paths
      if (isLinux) {
        const commonLinuxPaths = [
          '/usr/local/bin',
          '/snap/bin',
          path.join(os.homedir(), '.local', 'bin'),
          path.join(os.homedir(), 'bin'),
          '/usr/bin',
          '/bin',
          '/usr/sbin',
          '/sbin',
        ];

        // Only add Linux paths that exist and aren't already in PATH
        const existingPaths = new Set([...shellPath.split(pathSep), ...currentPath.split(pathSep)]);
        commonLinuxPaths.forEach((linuxPath) => {
          if (!existingPaths.has(linuxPath) && fs.existsSync(linuxPath)) {
            additionalPaths.push(linuxPath);
          }
        });
      }

      // Check for nvm directories - look for all versions
      const nvmDir = path.join(os.homedir(), '.nvm/versions/node');
      if (fs.existsSync(nvmDir)) {
        try {
          const versions = fs.readdirSync(nvmDir);
          versions.forEach((version) => {
            const binPath = path.join(nvmDir, version, 'bin');
            if (fs.existsSync(binPath)) {
              additionalPaths.push(binPath);
            }
          });
        } catch {
          // Ignore nvm directory read errors
        }
      }
    }

    const combinedPaths = new Set([...shellPath.split(pathSep), ...currentPath.split(pathSep)]);

    cachedPath = Array.from(combinedPaths)
      .filter((p) => p)
      .join(pathSep);
    const pathEntries = cachedPath.split(pathSep);
    logger.info('PATH loading completed successfully', {
      totalEntries: pathEntries.length,
      additionalPaths: additionalPaths.length,
      firstFewEntries: pathEntries.slice(0, 5).join(', '),
    });

    return cachedPath;
  } catch (error) {
    logger.error('ERROR: Failed to get shell PATH', {
      error,
      stack: error instanceof Error ? error.stack : 'No stack trace available',
    });

    if (!isWindows) {
      // Try alternative method: read shell config files directly (Unix/macOS only)
      logger.info('Attempting fallback: reading shell config files directly...');
      try {
        const homeDir = os.homedir();
        const shellConfigPaths = [
          path.join(homeDir, '.zshrc'),
          path.join(homeDir, '.bashrc'),
          path.join(homeDir, '.bash_profile'),
          path.join(homeDir, '.profile'),
          path.join(homeDir, '.zprofile'),
        ];

        logger.debug('Checking shell config files', { paths: shellConfigPaths });
        const extractedPaths: string[] = [];

        for (const configPath of shellConfigPaths) {
          if (fs.existsSync(configPath)) {
            logger.debug(`Reading config file: ${configPath}`);
            const content = fs.readFileSync(configPath, 'utf8');
            // Look for PATH exports
            const pathMatches = content.match(/export\s+PATH=["']?([^"'\n]+)["']?/gm);
            if (pathMatches) {
              logger.debug(`Found ${pathMatches.length} PATH exports in ${configPath}`);
              pathMatches.forEach((match) => {
                const pathValue = match.replace(/export\s+PATH=["']?/, '').replace(/["']?$/, '');
                // Expand $PATH references
                if (pathValue.includes('$PATH')) {
                  extractedPaths.push(pathValue.replace(/\$PATH/g, process.env.PATH || ''));
                } else {
                  extractedPaths.push(pathValue);
                }
              });
            }
          }
        }

        if (extractedPaths.length > 0) {
          logger.debug(`Found ${extractedPaths.length} PATH entries from config files`);
          const combinedPaths = new Set(
            extractedPaths
              .join(pathSep)
              .split(pathSep)
              .filter((p) => p),
          );
          cachedPath = Array.from(combinedPaths).join(pathSep);
          logger.debug('Fallback successful', {
            entries: cachedPath.split(pathSep).length,
          });
          return cachedPath;
        } else {
          logger.debug('No PATH entries found in config files');
        }
      } catch (configError) {
        logger.error('ERROR: Failed to read shell config files', {
          error: configError,
          stack: configError instanceof Error ? configError.stack : 'No stack trace',
        });
      }
    }

    // Final fallback to process PATH
    const fallbackPath = isWindows
      ? process.env.PATH || 'C:\\Windows\\system32;C:\\Windows;C:\\Windows\\System32\\Wbem'
      : process.env.PATH || '/usr/bin:/bin:/usr/sbin:/sbin:/usr/local/bin';

    logger.error('CRITICAL: Using final fallback PATH', {
      fallbackPath,
      platform: process.platform,
    });

    return fallbackPath;
  }
};

/**
 * Find an executable in the shell PATH
 */
export const findExecutableInPath = (executable: string, checkOnly = false): string | null => {
  logger.debug(`Finding executable: ${executable}`);
  const shellPath = getShellPath();
  const pathSep = getPathSeparator();
  const paths = shellPath.split(pathSep);
  const isWindows = process.platform === 'win32';

  logger.debug(`Searching in ${paths.length} PATH directories`);

  // On Windows, executables might have .exe, .cmd, or .bat extensions
  const executableNames = isWindows ? [executable, `${executable}.exe`, `${executable}.cmd`, `${executable}.bat`] : [executable];

  let searchedPaths = 0;
  for (const dir of paths) {
    for (const execName of executableNames) {
      const fullPath = path.join(dir, execName);
      searchedPaths++;
      try {
        if (isWindows) {
          // On Windows, check if file exists
          fs.accessSync(fullPath, fs.constants.F_OK);
          logger.debug(`Found executable at: ${fullPath}`);
          return fullPath;
        } else {
          // On Unix, check if the executable exists and is executable
          execSync(`test -x "${fullPath}"`, { stdio: 'ignore' });
          logger.debug(`Found executable at: ${fullPath}`);
          return fullPath;
        }
      } catch {
        // Not found in this directory
      }
    }
  }

  if (!checkOnly) {
    logger.error(`Executable '${executable}' not found after searching ${searchedPaths} paths`, {
      firstFewPaths: paths.slice(0, 5).join(', '),
    });
  }
  return null;
};

// Wrapper for execAsync that includes enhanced PATH
export const execWithShellPath = async (
  command: string,
  options?: { cwd?: string; env?: NodeJS.ProcessEnv; maxBuffer?: number },
): Promise<{ stdout: string; stderr: string }> => {
  const shellPath = getShellPath();
  return execAsync(command, {
    ...options,
    env: {
      ...process.env,
      PATH: shellPath,
      ...options?.env,
    },
  });
};
