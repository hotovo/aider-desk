import path from 'path';

import { is } from '@electron-toolkit/utils';
import { app } from 'electron';

if (process.env.AIDER_DESK_DATA_DIR) {
  app.setPath('userData', process.env.AIDER_DESK_DATA_DIR);
} else if (is.dev) {
  app.setPath('userData', `${app.getPath('userData')}-dev`);
}

export const AIDER_DESK_TITLE = 'AiderDesk';
export const AIDER_DESK_WEBSITE = 'https://aiderdesk.hotovo.com';
export const AIDER_DESK_DATA_DIR = app.getPath('userData');
export const AIDER_DESK_CACHE_DIR = path.join(AIDER_DESK_DATA_DIR, 'cache');
export const RESOURCES_DIR = is.dev ? path.join(__dirname, '..', '..', 'resources') : process.resourcesPath;
export const LOGS_DIR = path.join(AIDER_DESK_DATA_DIR, 'logs');
export const DB_FILE_PATH = path.join(AIDER_DESK_DATA_DIR, 'aider-desk.db');
export const SETUP_COMPLETE_FILENAME = path.join(AIDER_DESK_DATA_DIR, 'setup-complete');
export const PYTHON_VENV_DIR = path.join(AIDER_DESK_DATA_DIR, 'python-venv');
export const PYTHON_COMMAND = process.platform === 'win32' ? path.join(PYTHON_VENV_DIR, 'Scripts', 'python.exe') : path.join(PYTHON_VENV_DIR, 'bin', 'python');
export const AIDER_DESK_CONNECTOR_DIR = path.join(AIDER_DESK_DATA_DIR, 'aider-connector');
export const AIDER_DESK_MCP_SERVER_DIR = path.join(AIDER_DESK_DATA_DIR, 'mcp-server');
export const UV_EXECUTABLE =
  process.platform === 'win32'
    ? path.join(RESOURCES_DIR, 'win', 'uv.exe')
    : process.platform === 'darwin'
      ? path.join(RESOURCES_DIR, 'macos', 'uv')
      : path.join(RESOURCES_DIR, 'linux', 'uv');
export const SERVER_PORT = process.env.AIDER_DESK_PORT ? parseInt(process.env.AIDER_DESK_PORT) : 24337;
export const PID_FILES_DIR = path.join(AIDER_DESK_DATA_DIR, 'aider-processes');
// constants for project directory files
export const AIDER_DESK_DIR = '.aider-desk';
export const AIDER_DESK_TODOS_FILE = path.join(AIDER_DESK_DIR, 'todos.json');
export const AIDER_DESK_PROJECT_RULES_DIR = path.join(AIDER_DESK_DIR, 'rules');
export const AIDER_DESK_COMMANDS_DIR = path.join(AIDER_DESK_DIR, 'commands');
export const AIDER_DESK_TMP_DIR = path.join(AIDER_DESK_DIR, 'tmp');

export const POSTHOG_PUBLIC_API_KEY = 'phc_AF4zkjrcziXLh8PBFsRSvVr4VZ38p3ezsdX0KDYuElI';
export const POSTHOG_HOST = 'https://eu.i.posthog.com';

export const HEADLESS_MODE = process.env.AIDER_DESK_HEADLESS === 'true';
export const AUTH_USERNAME = process.env.AIDER_DESK_USERNAME;
export const AUTH_PASSWORD = process.env.AIDER_DESK_PASSWORD;

export const PROBE_BINARY_PATH = path.join(
  RESOURCES_DIR,
  process.platform === 'win32' ? 'win' : process.platform === 'darwin' ? 'macos' : 'linux',
  process.platform === 'win32' ? 'probe.exe' : 'probe',
);

export const CLOUDFLARED_BINARY_PATH = path.join(
  RESOURCES_DIR,
  'app.asar.unpacked',
  'node_modules',
  'cloudflared',
  'bin',
  process.platform === 'win32' ? 'cloudflared.exe' : 'cloudflared',
);
