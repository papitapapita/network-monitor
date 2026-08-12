import {
  IEventStreamHub,
  IEventStreamClient,
  ILogger
} from 'application/shared/interfaces';

const HEARTBEAT_MS = 15_000;

/**
 * In-process Server-Sent Events hub: channel name -> connected clients.
 *
 * Single-process only. Behind more than one instance a subscriber reaches just
 * the node that published, so a shared bus has to replace this before the API
 * is scaled out horizontally.
 */
export class SseBroadcaster implements IEventStreamHub {
  private readonly channels = new Map<
    string,
    Set<IEventStreamClient>
  >();
  private heartbeat: ReturnType<typeof setInterval> | null = null;

  constructor(private readonly logger: ILogger) {}

  subscribe(channel: string, client: IEventStreamClient): () => void {
    let clients = this.channels.get(channel);
    if (!clients) {
      clients = new Set();
      this.channels.set(channel, clients);
    }
    clients.add(client);
    this.ensureHeartbeat();

    return () => this.unsubscribe(channel, client);
  }

  publish(channel: string, event: string, data: unknown): void {
    const clients = this.channels.get(channel);
    if (!clients || clients.size === 0) return;

    const frame = `event: ${event}\ndata: ${JSON.stringify(data)}\n\n`;
    for (const client of [...clients]) {
      this.send(channel, client, frame);
    }
  }

  clientCount(channel?: string): number {
    if (channel !== undefined) {
      return this.channels.get(channel)?.size ?? 0;
    }
    let total = 0;
    for (const clients of this.channels.values()) {
      total += clients.size;
    }
    return total;
  }

  closeAll(): void {
    this.stopHeartbeat();
    for (const clients of this.channels.values()) {
      for (const client of clients) {
        try {
          client.end();
        } catch {
          // the socket is already gone — nothing left to close
        }
      }
    }
    this.channels.clear();
  }

  private unsubscribe(
    channel: string,
    client: IEventStreamClient
  ): void {
    const clients = this.channels.get(channel);
    if (!clients) return;

    clients.delete(client);
    if (clients.size === 0) {
      this.channels.delete(channel);
    }
    if (this.channels.size === 0) {
      this.stopHeartbeat();
    }
  }

  // a dead socket must evict itself rather than throw into the domain event
  // dispatch loop that is publishing through it
  private send(
    channel: string,
    client: IEventStreamClient,
    frame: string
  ): void {
    try {
      client.write(frame);
    } catch (error) {
      this.logger.warn('[SseBroadcaster] Dropping unwritable client', {
        channel,
        error: error instanceof Error ? error.message : String(error)
      });
      this.unsubscribe(channel, client);
    }
  }

  // comment frames keep proxies from reaping an idle connection
  private ensureHeartbeat(): void {
    if (this.heartbeat) return;

    this.heartbeat = setInterval(() => {
      for (const [channel, clients] of this.channels) {
        for (const client of [...clients]) {
          this.send(channel, client, ': ping\n\n');
        }
      }
    }, HEARTBEAT_MS);

    // an open timer must not be what keeps the process (or Jest) alive
    this.heartbeat.unref?.();
  }

  private stopHeartbeat(): void {
    if (!this.heartbeat) return;
    clearInterval(this.heartbeat);
    this.heartbeat = null;
  }
}
