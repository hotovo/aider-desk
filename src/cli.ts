#!/usr/bin/env node
import { spawn } from 'child_process';
import path from 'path';
import os from 'os';

const getAppPath = () => {
  const platform = os.platform();
  if (platform === 'darwin') {
    return path.join(__dirname, '../dist/mac/AiderDesk.app/Contents/MacOS/AiderDesk');
  } else if (platform === 'win32') {
    return path.join(__dirname, '../dist/win/AiderDesk.exe');
  } else {
    return path.join(__dirname, '../dist/linux/AiderDesk');
  }
};

const main = () => {
  try {
    const appPath = getAppPath();
    const args = process.argv.slice(2);
    
    const child = spawn(appPath, args, {
      stdio: 'inherit',
      detached: true
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
