import type { BrowserWindow } from 'electron';

import logger from '@/logger';

/**
 * WindowManager manages all open BrowserWindow instances in the application.
 * It provides a central registry for windows and tracks which is the main window.
 */
export class WindowManager {
  private windows: BrowserWindow[] = [];
  private mainWindow: BrowserWindow | null = null;

  /**
   * Add a window to the manager.
   * The first window added is automatically set as the main window.
   * @param window The BrowserWindow to add
   */
  addWindow(window: BrowserWindow): void {
    this.windows.push(window);

    // Set the first window as the main window
    if (!this.mainWindow) {
      this.mainWindow = window;
      logger.debug('Main window registered.');
    }

    logger.debug(`Window added. Total windows: ${this.windows.length}`);
  }

  /**
   * Remove a window from the manager.
   * @param window The BrowserWindow to remove
   */
  removeWindow(window: BrowserWindow): void {
    const index = this.windows.indexOf(window);
    if (index !== -1) {
      this.windows.splice(index, 1);
      logger.debug(`Window removed. Remaining windows: ${this.windows.length}`);
    }

    // If the main window is closed, don't set a new one
    // The main window designation is only used for window state persistence
    if (this.mainWindow === window) {
      logger.debug('Main window closed');
    }
  }

  /**
   * Get all currently open windows (non-destroyed).
   * @returns Array of BrowserWindow instances
   */
  getAllWindows(): BrowserWindow[] {
    return this.windows.filter((window) => !window.isDestroyed());
  }

  /**
   * Get the main window (first window created).
   * @returns The main BrowserWindow or null if it's been closed
   */
  getMainWindow(): BrowserWindow | null {
    if (this.mainWindow && !this.mainWindow.isDestroyed()) {
      return this.mainWindow;
    }
    return null;
  }

  /**
   * Check if a given window is the main window.
   * @param window The window to check
   * @returns True if the window is the main window
   */
  isMainWindow(window: BrowserWindow): boolean {
    return this.mainWindow === window;
  }

  /**
   * Get the number of open windows.
   * @returns Number of windows
   */
  getWindowCount(): number {
    return this.getAllWindows().length;
  }
}
