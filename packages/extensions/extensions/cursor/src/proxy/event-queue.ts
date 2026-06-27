export const MAX_QUEUE_DEPTH = 10_000

/**
 * Async event queue with backpressure. Consumers call `next()` to wait for events;
 * producers call `push()` to deliver. If no consumer is waiting, events buffer up
 * to {@link MAX_QUEUE_DEPTH} before `onOverflow` fires.
 */
export class EventQueue<T> {
  private buffer: T[] = []
  private waiters: ((value: T) => void)[] = []
  private overflowCb?: () => void

  constructor(opts?: { onOverflow?: () => void }) {
    this.overflowCb = opts?.onOverflow
  }

  get length(): number {
    return this.buffer.length
  }

  /** Delivers to a waiting consumer or buffers. Returns false if the buffer is full. */
  push(event: T): boolean {
    const waiter = this.waiters.shift()
    if (waiter) {
      waiter(event)
      return true
    }
    if (this.buffer.length >= MAX_QUEUE_DEPTH) {
      this.overflowCb?.()
      return false
    }
    this.buffer.push(event)
    return true
  }

  /** Like `push` but ignores the depth limit. Used for terminal events that must not be dropped. */
  pushForce(event: T): void {
    const waiter = this.waiters.shift()
    if (waiter) {
      waiter(event)
    } else {
      this.buffer.push(event)
    }
  }

  /** Returns the next buffered event, or waits for one to arrive. */
  next(): Promise<T> {
    const head = this.buffer.shift()
    if (head !== undefined) {
      return Promise.resolve(head)
    }
    return new Promise((resolve) => {
      this.waiters.push(resolve)
    })
  }
}
