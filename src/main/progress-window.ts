import { join } from 'path';

import { BrowserWindow, ipcMain } from 'electron';

export class ProgressWindow {
  private window: BrowserWindow;
  private readyPromise: Promise<void>;
  private resolveReady!: () => void;

  constructor(options: { width?: number; height?: number; icon?: string }) {
    this.readyPromise = new Promise((resolve) => {
      this.resolveReady = resolve;
    });

    this.window = new BrowserWindow({
      width: options.width ?? 400,
      height: 150,
      resizable: false,
      frame: false,
      show: false,
      icon: options.icon,
      backgroundColor: '#1c2025',
      webPreferences: {
        nodeIntegration: true,
        contextIsolation: false,
      },
    });

    this.window.on('ready-to-show', () => {
      this.window.show();
      this.resolveReady();
    });

    ipcMain.on('progress-window-set-title', (_, title: string) => {
      this.window.webContents.send('set-title', title);
    });

    ipcMain.on('progress-window-set-message', (_, message: string) => {
      this.window.webContents.send('set-message', message);
    });

    ipcMain.on('progress-window-set-completed', () => {
      this.window.webContents.send('set-completed');
    });

    ipcMain.on('progress-window-set-progress', (_, progress: number) => {
      this.window.webContents.send('set-progress', progress);
    });

    void this.window.loadFile(join(__dirname, '../renderer/progress.html'));
  }

  on(event: 'ready', callback: () => void): void {
    if (event === 'ready') {
      this.readyPromise.then(callback);
    }
  }

  set title(value: string) {
    this.window.webContents.send('set-title', value);
  }

  setDetail(value: string, subtitle?: string): void {
    this.window.webContents.send('set-detail', value, subtitle);
  }

  setCompleted(): void {
    this.window.webContents.send('set-completed');
  }

  setProgress(progress: number): void {
    this.window.webContents.send('set-progress', Math.min(100, Math.max(0, progress)));
  }

  close(): void {
    this.window.close();
  }
}
