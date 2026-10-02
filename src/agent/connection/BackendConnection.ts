import { randomUUID } from 'crypto';
import WebSocket from 'ws';
import type { ILogger } from 'application/shared/interfaces';
import {
  AGENT_WS_PATH,
  AgentCapability,
  AgentMessage,
  AgentPlatform,
  BackendMessage,
  CloseCode,
  ConfigMessage,
  PROTOCOL_VERSION,
  PingResultWire,
  ProbeRequestMessage,
  ProbeResultMessage,
  UpdateMessage,
  UpdateResultMessage
} from 'agent/protocol';
import { AgentCredentials } from '../identity/CredentialStore';

export interface ConnectionCallbacks {
  onConfig(
    config: ConfigMessage,
    firstSinceConnect: boolean
  ): Promise<void>;
  onWelcome(): void;
  // A newer release to install (AGT-081).
  onUpdate(offer: UpdateMessage): void;
  // Measure one device now; the answer goes back on this connection (AGT-101).
  onProbe(request: ProbeRequestMessage): Promise<ProbeResultMessage>;
  // 4003: the backend takes nothing until the subscription is paid.
  onSubscriptionExpired(): void;
  // 4001: the agent must forget its identity and stop.
  onRevoked(): void;
}

export interface OutboundResults {
  take(max: number): PingResultWire[];
  acknowledge(ids: string[]): void;
  release(ids: string[]): void;
  releaseAll(): void;
}

export interface BackendConnectionOptions {
  agentVersion: string;
  // Named in the hello only by an agent that can update itself (AGT-082).
  platform?: AgentPlatform;
  // Named in the hello so the backend knows what it may ask (AGT-100).
  capabilities?: readonly AgentCapability[];
  flushEveryMs: number;
  batchSize: number;
  maxBatchesInFlight: number;
  ackTimeoutMs: number;
  retryInitialMs: number;
  retryMaxMs: number;
  // R17 / R18: retried hourly, since nothing changes sooner on its own.
  retryLongMs: number;
  // Another copy of this agent holds the connection; retrying fast would
  // make the two take it from each other every second.
  retryReplacedMs: number;
  handshakeTimeoutMs: number;
}

export const DEFAULT_CONNECTION_OPTIONS: Omit<
  BackendConnectionOptions,
  'agentVersion'
> = {
  flushEveryMs: 2_000,
  batchSize: 500,
  maxBatchesInFlight: 4,
  ackTimeoutMs: 60_000,
  retryInitialMs: 1_000,
  retryMaxMs: 60_000,
  retryLongMs: 60 * 60 * 1000,
  retryReplacedMs: 60_000,
  handshakeTimeoutMs: 15_000
};

interface InFlightBatch {
  ids: string[];
  timer: ReturnType<typeof setTimeout>;
}

// The agent's one WebSocket to the backend (ADR 0002). Hello, then a
// heartbeat on the interval the welcome names (R5); configuration in (R14),
// results out in compressed batches (R19) that stay buffered until the
// backend acknowledges them (R8). Reconnects on its own, with backoff.
export class BackendConnection {
  private socket: WebSocket | null = null;
  private welcomed = false;
  private configSinceConnect = false;
  private stopped = true;
  private failures = 0;
  private retryTimer: ReturnType<typeof setTimeout> | null = null;
  private heartbeatTimer: ReturnType<typeof setInterval> | null =
    null;
  private flushTimer: ReturnType<typeof setInterval> | null = null;
  private readonly batches = new Map<string, InFlightBatch>();
  private lastRejectedStatus: number | null = null;

  constructor(
    private readonly credentials: AgentCredentials,
    private readonly results: OutboundResults,
    private readonly callbacks: ConnectionCallbacks,
    private readonly logger: ILogger,
    private readonly options: BackendConnectionOptions
  ) {}

  get isConnected(): boolean {
    return this.welcomed;
  }

  start(): void {
    if (!this.stopped) return;
    this.stopped = false;
    this.connect();
  }

  async stop(): Promise<void> {
    this.stopped = true;
    if (this.retryTimer) clearTimeout(this.retryTimer);
    this.retryTimer = null;
    const socket = this.socket;
    if (!socket || socket.readyState === WebSocket.CLOSED) return;
    await new Promise<void>((resolve) => {
      socket.once('close', () => resolve());
      socket.close(1000, 'Agent stopping');
      setTimeout(() => {
        socket.terminate();
        resolve();
      }, 3_000).unref();
    });
  }

  private connect(): void {
    const url = toWebSocketUrl(this.credentials.backendUrl);
    const socket = new WebSocket(url, {
      headers: { Authorization: `Bearer ${this.credentials.token}` },
      perMessageDeflate: true,
      handshakeTimeout: this.options.handshakeTimeoutMs
    });
    this.socket = socket;
    this.lastRejectedStatus = null;

    socket.on('open', () => {
      this.configSinceConnect = false;
      this.send({
        type: 'hello',
        protocolVersion: PROTOCOL_VERSION,
        agentVersion: this.options.agentVersion,
        ...(this.options.platform && {
          platform: this.options.platform
        }),
        ...(this.options.capabilities?.length && {
          capabilities: [...this.options.capabilities]
        }),
        sentAt: Date.now()
      });
    });
    socket.on('message', (data) => {
      void this.onMessage(data.toString()).catch((error) =>
        this.logger.error(
          'Could not handle a backend message',
          error instanceof Error ? error : new Error(String(error))
        )
      );
    });
    socket.on('error', (error) => {
      const status = error.message.match(
        /Unexpected server response: (\d+)/
      );
      if (status) this.lastRejectedStatus = Number(status[1]);
      this.logger.debug('Backend connection error', {
        error: error.message
      });
    });
    socket.on('close', (code, reason) =>
      this.onClose(socket, code, reason.toString())
    );
  }

  private async onMessage(raw: string): Promise<void> {
    let message: BackendMessage;
    try {
      message = JSON.parse(raw) as BackendMessage;
    } catch {
      this.logger.warn('Backend sent a message that is not JSON');
      return;
    }

    switch (message.type) {
      case 'welcome':
        this.welcomed = true;
        this.failures = 0;
        this.logger.info('Connected to the backend', {
          agentName: message.agentName
        });
        this.startTimers(message.heartbeatIntervalMs);
        this.callbacks.onWelcome();
        return;
      case 'config': {
        const first = !this.configSinceConnect;
        this.configSinceConnect = true;
        await this.callbacks.onConfig(message, first);
        this.send({ type: 'config.ack', version: message.version });
        return;
      }
      case 'results.ack':
        this.onResultsAck(message.batchId, message.ids);
        return;
      case 'update':
        this.callbacks.onUpdate(message);
        return;
      case 'probe':
        // Not awaited: a slow radio must not hold up the messages behind it.
        void this.callbacks
          .onProbe(message)
          .then((result) => this.send(result));
        return;
      default:
        this.logger.warn('Backend sent an unknown message', {
          type: (message as { type?: unknown }).type
        });
    }
  }

  sendUpdateResult(result: UpdateResultMessage): void {
    if (this.welcomed) this.send(result);
  }

  private onResultsAck(batchId: string, ids: string[]): void {
    this.results.acknowledge(ids);
    const batch = this.batches.get(batchId);
    if (!batch) return;
    clearTimeout(batch.timer);
    this.batches.delete(batchId);
    // What the backend did not acknowledge it could not store; it is sent
    // again with a later batch.
    const acknowledged = new Set(ids);
    this.results.release(
      batch.ids.filter((id) => !acknowledged.has(id))
    );
  }

  private flush(): void {
    while (
      this.welcomed &&
      this.batches.size < this.options.maxBatchesInFlight
    ) {
      const results = this.results.take(this.options.batchSize);
      if (results.length === 0) return;
      const batchId = randomUUID();
      const ids = results.map((r) => r.id);
      this.batches.set(batchId, {
        ids,
        timer: setTimeout(() => {
          this.batches.delete(batchId);
          this.results.release(ids);
        }, this.options.ackTimeoutMs)
      });
      this.send({ type: 'results', batchId, results });
    }
  }

  private startTimers(heartbeatIntervalMs: number): void {
    this.stopTimers();
    this.heartbeatTimer = setInterval(
      () =>
        this.send({
          type: 'heartbeat',
          agentVersion: this.options.agentVersion,
          sentAt: Date.now()
        }),
      heartbeatIntervalMs
    );
    this.flushTimer = setInterval(
      () => this.flush(),
      this.options.flushEveryMs
    );
  }

  private stopTimers(): void {
    if (this.heartbeatTimer) clearInterval(this.heartbeatTimer);
    if (this.flushTimer) clearInterval(this.flushTimer);
    this.heartbeatTimer = null;
    this.flushTimer = null;
  }

  private onClose(
    socket: WebSocket,
    code: number,
    reason: string
  ): void {
    if (socket !== this.socket) return;
    this.socket = null;
    const wasWelcomed = this.welcomed;
    this.welcomed = false;
    this.stopTimers();
    for (const batch of this.batches.values())
      clearTimeout(batch.timer);
    this.batches.clear();
    this.results.releaseAll();
    if (this.stopped) return;

    switch (code) {
      case CloseCode.REVOKED:
        this.logger.error(
          'This agent was revoked; it stops here',
          undefined,
          {
            reason
          }
        );
        this.stopped = true;
        this.callbacks.onRevoked();
        return;
      case CloseCode.SUBSCRIPTION_EXPIRED:
        this.logger.warn(
          'Subscription expired; retrying in an hour',
          {
            reason
          }
        );
        this.callbacks.onSubscriptionExpired();
        this.retryIn(this.options.retryLongMs);
        return;
      case CloseCode.UPDATE_REQUIRED:
        this.logger.error(
          'The backend requires a newer agent; install the update',
          undefined,
          { reason }
        );
        this.retryIn(this.options.retryLongMs);
        return;
      case CloseCode.REPLACED:
        this.logger.warn(
          'Another copy of this agent connected with the same identity',
          { reason }
        );
        this.retryIn(this.options.retryReplacedMs);
        return;
    }

    // A refused token is not treated as a revocation: the backend answers
    // 401 for a database hiccup too, and forgetting the token over that
    // would strand the agent. Only the explicit close code (4001) does.
    if (this.lastRejectedStatus === 401) {
      this.logger.error(
        'The backend refused this agent token; retrying',
        undefined
      );
    } else if (wasWelcomed) {
      this.logger.warn('Disconnected from the backend', {
        code,
        reason
      });
    }
    this.failures++;
    const backoff = Math.min(
      this.options.retryMaxMs,
      this.options.retryInitialMs * 2 ** (this.failures - 1)
    );
    this.retryIn(backoff / 2 + Math.random() * (backoff / 2));
  }

  private retryIn(ms: number): void {
    if (this.retryTimer) clearTimeout(this.retryTimer);
    this.retryTimer = setTimeout(() => {
      this.retryTimer = null;
      if (!this.stopped) this.connect();
    }, ms);
  }

  private send(message: AgentMessage): void {
    if (this.socket?.readyState === WebSocket.OPEN) {
      this.socket.send(JSON.stringify(message));
    }
  }
}

export function toWebSocketUrl(backendUrl: string): string {
  const url = new URL(AGENT_WS_PATH, backendUrl);
  url.protocol = url.protocol === 'https:' ? 'wss:' : 'ws:';
  return url.toString();
}
