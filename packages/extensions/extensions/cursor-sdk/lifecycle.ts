import type { Run } from '@cursor/sdk';

export class CursorRunSession {
  private run?: Run;
  private cancellation?: Promise<void>;
  private cancelled = false;

  get aborted(): boolean {
    return this.cancelled;
  }

  throwIfAborted(): void {
    if (this.cancelled) {
      throw new DOMException('Cursor run interrupted', 'AbortError');
    }
  }

  async attach(run: Run): Promise<void> {
    this.run = run;
    if (this.cancelled) {
      await this.cancel();
      this.throwIfAborted();
    }
  }

  async cancel(): Promise<void> {
    this.cancelled = true;
    if (this.run?.supports('cancel')) {
      const run = this.run;
      this.cancellation ??= Promise.resolve().then(() => run.cancel());
      await this.cancellation;
    }
  }
}
