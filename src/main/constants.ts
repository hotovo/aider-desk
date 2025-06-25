import path from 'path';

import { is } from '@electron-toolkit/utils';
import { app } from 'electron';

if (is.dev) {
  app.setPath('userData', `${app.getPath('userData')}-dev`);
}

export const AIDER_DESK_TITLE = 'AiderDesk';
export const AIDER_DESK_WEBSITE = 'https://github.com/hotovo/aider-desk';
export const AIDER_DESK_DIR = app.getPath('userData');
export const RESOURCES_DIR = is.dev ? path.join(__dirname, '..', '..', 'resources') : process.resourcesPath;
export const LOGS_DIR = path.join(AIDER_DESK_DIR, 'logs');
export const SETUP_COMPLETE_FILENAME = path.join(AIDER_DESK_DIR, 'setup-complete');
export const PYTHON_VENV_DIR = path.join(AIDER_DESK_DIR, 'python-venv');
export const PYTHON_COMMAND = process.platform === 'win32' ? path.join(PYTHON_VENV_DIR, 'Scripts', 'python.exe') : path.join(PYTHON_VENV_DIR, 'bin', 'python');
export const AIDER_DESK_CONNECTOR_DIR = path.join(AIDER_DESK_DIR, 'aider-connector');
export const AIDER_DESK_MCP_SERVER_DIR = path.join(AIDER_DESK_DIR, 'mcp-server');
export const UV_EXECUTABLE =
  process.platform === 'win32'
    ? path.join(RESOURCES_DIR, 'win', 'uv.exe')
    : process.platform === 'darwin'
      ? path.join(RESOURCES_DIR, 'macos', 'uv')
      : path.join(RESOURCES_DIR, 'linux', 'uv');
export const SERVER_PORT = process.env.AIDER_DESK_PORT ? parseInt(process.env.AIDER_DESK_PORT) : 24337;
export const PID_FILES_DIR = path.join(AIDER_DESK_DIR, 'aider-processes');
export const AIDER_DESK_PROJECT_DIR = '.aider-desk';
export const AIDER_DESK_TODOS_FILE = path.join(AIDER_DESK_PROJECT_DIR, 'todos.json');
export const AIDER_DESK_PROJECT_RULES_DIR = path.join(AIDER_DESK_PROJECT_DIR, 'rules');
export const POSTHOG_PUBLIC_API_KEY = 'phc_AF4zkjrcziXLh8PBFsRSvVr4VZ38p3ezsdX0KDYuElI';
export const POSTHOG_HOST = 'https://eu.i.posthog.com';
export const AIDER_DESK_PROJECT_TMP_DIR = `${AIDER_DESK_PROJECT_DIR}/tmp`;
export const BINARY_EXTENSIONS = new Set([
  '.png',
  '.jpg',
  '.jpeg',
  '.gif',
  '.bmp',
  '.tiff',
  '.ico', // Images
  '.mp3',
  '.wav',
  '.ogg',
  '.flac', // Audio
  '.mp4',
  '.mov',
  '.avi',
  '.mkv', // Video
  '.zip',
  '.tar',
  '.gz',
  '.7z', // Archives
  '.pdf',
  '.doc',
  '.docx',
  '.xls',
  '.xlsx', // Documents
  '.exe',
  '.dll',
  '.so', // Binaries
]);
