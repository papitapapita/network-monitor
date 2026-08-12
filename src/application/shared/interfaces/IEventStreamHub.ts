/**
 * A connected stream consumer, reduced to what a broadcaster needs. Keeping it
 * this narrow is what lets the application and infrastructure layers push to
 * an HTTP response without importing Express.
 */
export interface IEventStreamClient {
  write(chunk: string): void;
  end(): void;
}

export interface IEventStreamHub {
  // returns the unsubscribe callback — callers own their own teardown
  subscribe(channel: string, client: IEventStreamClient): () => void;
  publish(channel: string, event: string, data: unknown): void;
  // omit the channel for the total across every channel
  clientCount(channel?: string): number;
  closeAll(): void;
}
