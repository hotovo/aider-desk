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

    this.window.loadFile('src/main/progress.html');

    this.window.on('ready-to-show', () => {
      this.window.show();
      this.resolveReady();
    });

    ipcMain.on('progress-window-set-text', (_, text: string) => {
      this.window.webContents.send('set-text', text);
    });

    ipcMain.on('progress-window-set-detail', (_, detail: string) => {
      this.window.webContents.send('set-detail', detail);
    });

    ipcMain.on('progress-window-set-completed', () => {
      this.window.webContents.send('set-completed');
    });

    ipcMain.on('progress-window-set-progress', (_, progress: number) => {
      this.window.webContents.send('set-progress', progress);
    });
  }

  on(event: 'ready', callback: () => void): void {
    if (event === 'ready') {
      this.readyPromise.then(callback);
    }
  }

  set text(value: string) {
    this.window.webContents.send('set-text', value);
  }

  set detail(value: string) {
    this.window.webContents.send('set-detail', value);
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
