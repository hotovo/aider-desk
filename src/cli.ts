#!/usr/bin/env node
import { spawn } from 'child_process';
import * as os from 'node:os';
import * as path from 'path';

const getAppPath = () => {
  const platform = os.platform();
  const appPath = path.join(__dirname, '..');
  if (platform === 'darwin') {
    return path.join(appPath, '/mac-universal/aider-desk.app/Contents/MacOS/aider-desk');
  } else if (platform === 'win32') {
    return path.join(appPath, '/win/AiderDesk.exe');
  } else {
    return path.join(appPath, '/linux/AiderDesk');
  }
};

const main = () => {
  try {
    const appPath = getAppPath();
    const args = process.argv.slice(2);

    const child = spawn(appPath, args, {
      stdio: 'inherit',
      detached: true,
    });

    child.on('error', (err) => {
      console.error('Failed to start AiderDesk:', err);
      process.exit(1);
    });

    child.unref();
  } catch (err) {
    console.error('Error:', err);
    process.exit(1);
  }
};

main();
