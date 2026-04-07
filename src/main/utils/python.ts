import * as fs from 'fs';
import { exec } from 'child_process';
import * as path from 'path';
import { promisify } from 'util';

import { AIDER_DESK_BIN_DIR, PYTHON_COMMAND, PYTHON_VENV_DIR, UV_EXECUTABLE } from '@/constants';
import logger from '@/logger';

const execAsync = promisify(exec);

let resolvedUvPath: string | null = null;
let downloadingUv = false;
let uvResolvePromise: Promise<string> | null = null;

interface GetResolvedUvPathOptions {
  onDownloadStarted?: () => void;
}

/**
 * Resolves and returns the path to a working uv executable.
 *
 * Resolution order:
 *  1. Previously cached result (immediate)
 *  2. Local bin directory download (UV_EXECUTABLE)
 *  3. System-installed uv (unless AIDER_DESK_DISABLE_SYSTEM_UV is set)
 *  4. Download from GitHub releases
 *
 * The in-flight promise is cached so that concurrent callers share the same
 * resolution — no duplicate downloads or checks.
 */
export const getResolvedUvPath = async (options?: GetResolvedUvPathOptions): Promise<string> => {
  // Return cached result immediately
  if (resolvedUvPath) {
    return resolvedUvPath;
  }

  // If a resolution is already in flight, reuse its promise
  if (uvResolvePromise) {
    if (downloadingUv && options?.onDownloadStarted) {
      options.onDownloadStarted();
    }
    return uvResolvePromise;
  }

  uvResolvePromise = resolveUvPath(options);

  try {
    return await uvResolvePromise;
  } catch (error) {
    // Reset on failure so callers can retry
    uvResolvePromise = null;
    throw error;
  }
};

const resolveUvPath = async (options?: GetResolvedUvPathOptions) => {
  // 1. Check local bin directory
  if (await isUvWorking(UV_EXECUTABLE)) {
    resolvedUvPath = UV_EXECUTABLE;
    return resolvedUvPath;
  }

  // 2. Check for system uv (unless disabled via env var)
  if (process.env.AIDER_DESK_DISABLE_SYSTEM_UV !== 'true') {
    const systemUv = await findSystemUv();
    if (systemUv && (await isUvWorking(systemUv))) {
      logger.info(`Using system uv at: ${systemUv}`);
      resolvedUvPath = systemUv;
      return resolvedUvPath;
    }
  }

  // 3. Download uv
  downloadingUv = true;
  options?.onDownloadStarted?.();
  await downloadUv();
  downloadingUv = false;

  if (!(await isUvWorking(UV_EXECUTABLE))) {
    throw new Error('Failed to get a working uv installation');
  }

  resolvedUvPath = UV_EXECUTABLE;
  return resolvedUvPath;
};

const findSystemUv = async (): Promise<string | null> => {
  const command = process.platform === 'win32' ? 'where uv' : 'which uv';
  try {
    const { stdout } = await execAsync(command, {
      windowsHide: true,
      timeout: 5000,
    });
    return stdout.trim().split('\n')[0]?.trim() || null;
  } catch {
    return null;
  }
};

const isUvWorking = async (uvPath: string): Promise<boolean> => {
  try {
    const { stdout, stderr } = await execAsync(`"${uvPath}" --version`, {
      windowsHide: true,
      timeout: 10000,
    });

    const output = (stdout || '') + (stderr || '');
    if (!output.includes('uv')) {
      return false;
    }

    logger.info(`uv is available at ${uvPath}: ${output.trim()}`);
    return true;
  } catch {
    return false;
  }
};

const downloadUv = async (): Promise<void> => {
  const UV_VERSION = '0.7.13';
  const BASE_URL = `https://github.com/astral-sh/uv/releases/download/${UV_VERSION}`;

  const platform = process.platform;
  const arch = process.arch;

  let filename: string;
  let uvExeName: string;

  if (platform === 'win32') {
    filename = 'uv-x86_64-pc-windows-msvc.zip';
    uvExeName = 'uv.exe';
  } else if (platform === 'darwin') {
    filename = arch === 'arm64' ? 'uv-aarch64-apple-darwin.tar.gz' : 'uv-x86_64-apple-darwin.tar.gz';
    uvExeName = 'uv';
  } else {
    filename = arch === 'arm64' ? 'uv-aarch64-unknown-linux-gnu.tar.gz' : 'uv-x86_64-unknown-linux-gnu.tar.gz';
    uvExeName = 'uv';
  }

  const url = `${BASE_URL}/${filename}`;

  if (!fs.existsSync(AIDER_DESK_BIN_DIR)) {
    fs.mkdirSync(AIDER_DESK_BIN_DIR, { recursive: true });
  }

  const tempFile = path.join(AIDER_DESK_BIN_DIR, filename);

  try {
    logger.info(`Downloading uv from ${url}`);
    const response = await fetch(url);
    if (!response.ok) {
      throw new Error(`HTTP ${response.status}: ${response.statusText}`);
    }

    const buffer = Buffer.from(await response.arrayBuffer());
    fs.writeFileSync(tempFile, buffer);

    if (filename.endsWith('.tar.gz')) {
      const { extract } = await import('tar');
      await extract({
        cwd: AIDER_DESK_BIN_DIR,
        file: tempFile,
        strip: 1,
      });
    } else if (filename.endsWith('.zip')) {
      const AdmZip = (await import('adm-zip')).default;
      const zip = new AdmZip(tempFile);
      zip.extractAllTo(AIDER_DESK_BIN_DIR, true);
    }

    if (platform !== 'win32') {
      fs.chmodSync(path.join(AIDER_DESK_BIN_DIR, uvExeName), 0o755);
    }

    logger.info(`uv downloaded successfully to ${AIDER_DESK_BIN_DIR}`);
  } finally {
    if (fs.existsSync(tempFile)) {
      fs.unlinkSync(tempFile);
    }
  }
};

export const getPythonVenvBinPath = (): string => {
  return process.platform === 'win32' ? path.join(PYTHON_VENV_DIR, 'Scripts') : path.join(PYTHON_VENV_DIR, 'bin');
};

/**
 * Gets the currently installed version of a Python library within the virtual environment.
 */
export const getCurrentPythonLibVersion = async (library: string): Promise<string | null> => {
  try {
    const pythonBinPath = getPythonVenvBinPath();
    const uvPath = await getResolvedUvPath();
    const command = `"${uvPath}" pip show ${library}`;
    const { stdout } = await execAsync(command, {
      env: {
        ...process.env,
        VIRTUAL_ENV: PYTHON_VENV_DIR,
        PATH: `${pythonBinPath}${path.delimiter}${process.env.PATH}`,
      },
      windowsHide: true,
    });

    const versionMatch = stdout.match(/Version:\s*(\S+)/);
    if (versionMatch) {
      return versionMatch[1];
    }
    logger.warn(`Could not find version for library '${library}' in pip show output.`);
    return null;
  } catch (error) {
    logger.warn(`Failed to get current version for library '${library}'`, { error });
    return null;
  }
};

/**
 * Gets the latest available version of a Python library from the pip index.
 */
export const getLatestPythonLibVersion = async (library: string): Promise<string | null> => {
  try {
    const pythonBinPath = getPythonVenvBinPath();
    const command = `"${PYTHON_COMMAND}" -m pip index versions ${library}`;
    const { stdout } = await execAsync(command, {
      env: {
        ...process.env,
        VIRTUAL_ENV: PYTHON_VENV_DIR,
        PATH: `${pythonBinPath}${path.delimiter}${process.env.PATH}`,
      },
      windowsHide: true,
    });

    const latestMatch = stdout.match(/LATEST:\s+(\S+)/);
    if (latestMatch) {
      return latestMatch[1];
    }
    logger.warn(`Could not find latest version for library '${library}' in pip index.`);
    return null;
  } catch (error) {
    logger.warn(`Failed to get latest available version for library '${library}'`, { error });
    return null;
  }
};
