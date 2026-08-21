import logger from '@/logger';

type CleanupFn = () => void | Promise<void>;

export class DisposableStore {
  private extensionDisposables: CleanupFn[] = [];
  private projectDisposables = new Map<string, CleanupFn[]>();

  constructor(private readonly extensionName: string) {}

  addExtensionDisposable(cleanup: CleanupFn): void {
    this.extensionDisposables.push(cleanup);
  }

  addProjectDisposable(projectDir: string, cleanup: CleanupFn): void {
    let disposables = this.projectDisposables.get(projectDir);
    if (!disposables) {
      disposables = [];
      this.projectDisposables.set(projectDir, disposables);
    }
    disposables.push(cleanup);
  }

  async disposeExtension(): Promise<void> {
    const disposables = this.extensionDisposables;
    this.extensionDisposables = [];
    for (let i = disposables.length - 1; i >= 0; i--) {
      try {
        await disposables[i]();
      } catch (error) {
        logger.error(`[Extension:${this.extensionName}] Error during extension disposable cleanup at index ${i}:`, error);
      }
    }
    await this.disposeAllProjects();
  }

  async disposeProject(projectDir: string): Promise<void> {
    const disposables = this.projectDisposables.get(projectDir);
    this.projectDisposables.delete(projectDir);
    if (!disposables) {
      return;
    }
    for (let i = disposables.length - 1; i >= 0; i--) {
      try {
        await disposables[i]();
      } catch (error) {
        logger.error(`[Extension:${this.extensionName}] Error during project disposable cleanup at index ${i}:`, error);
      }
    }
  }

  hasProjectDisposables(projectDir: string): boolean {
    return this.projectDisposables.has(projectDir);
  }

  private async disposeAllProjects(): Promise<void> {
    for (const projectDir of [...this.projectDisposables.keys()]) {
      await this.disposeProject(projectDir);
    }
  }
}
