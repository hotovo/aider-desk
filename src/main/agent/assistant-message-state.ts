export class AssistantMessageState {
  index = 0;
  hasReasoning = false;
  private hasText = false;

  messageId(baseId: string): string {
    return this.index > 0 ? `${baseId}-${this.index}` : baseId;
  }

  reasoning(text?: string): void {
    this.hasReasoning ||= text === undefined || text.trim().length > 0;
  }

  text(): void {
    this.hasText = true;
  }

  tool(): void {
    if (this.hasReasoning || this.hasText) {
      this.index++;
      this.hasReasoning = false;
      this.hasText = false;
    }
  }

  reset(): void {
    this.index = 0;
    this.hasReasoning = false;
    this.hasText = false;
  }
}

export class StepResultQueue<T> {
  private results: T[] = [];
  private waiting: Array<(result: T) => void> = [];

  push(result: T): void {
    const resolve = this.waiting.shift();
    if (resolve) {
      resolve(result);
    } else {
      this.results.push(result);
    }
  }

  next(): Promise<T> {
    const result = this.results.shift();
    return result === undefined ? new Promise((resolve) => this.waiting.push(resolve)) : Promise.resolve(result);
  }
}
