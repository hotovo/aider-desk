import path from 'path';
import * as fs from 'fs';

import { is } from '@electron-toolkit/utils';
import { app } from 'electron';

if (is.dev) {
  app.setPath('userData', `${app.getPath('userData')}-dev`);
}

export const AIDER_DESK_DIR = app.getPath('userData');
export const RESOURCES_DIR = is.dev ? path.join(__dirname, '..', '..', 'resources') : process.resourcesPath;
export const LOGS_DIR = path.join(AIDER_DESK_DIR, 'logs');
export const SETUP_COMPLETE_FILENAME = path.join(AIDER_DESK_DIR, 'setup-complete');
export const PYTHON_VENV_DIR = path.join(AIDER_DESK_DIR, 'python-venv');
// 定义Python命令路径，并添加路径存在性检查
const getDefaultPythonCommand = () => {
  const venvPythonPath = process.platform === 'win32' 
    ? path.join(PYTHON_VENV_DIR, 'Scripts', 'pythonw.exe') 
    : path.join(PYTHON_VENV_DIR, 'bin', 'python');
  
  // 检查虚拟环境中的Python解释器是否存在
  if (fs.existsSync(venvPythonPath)) {
    return venvPythonPath;
  }
  
  // 如果虚拟环境中的Python不存在，尝试使用系统Python
  return process.platform === 'win32' ? 'python' : 'python3';
};

export const PYTHON_COMMAND = getDefaultPythonCommand();
export const AIDER_DESK_CONNECTOR_DIR = path.join(AIDER_DESK_DIR, 'aider-connector');
export const AIDER_DESK_MCP_SERVER_DIR = path.join(AIDER_DESK_DIR, 'mcp-server');
export const SERVER_PORT = process.env.AIDER_DESK_PORT ? parseInt(process.env.AIDER_DESK_PORT) : 24337;
export const PID_FILES_DIR = path.join(AIDER_DESK_DIR, 'aider-processes');
