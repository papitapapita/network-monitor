import { createServer, Server } from 'http';
import { AddressInfo } from 'net';
import WebSocket, { WebSocketServer } from 'ws';
import {
  BackendConnection,
  ConnectionCallbacks,
  OutboundResults,
  toWebSocketUrl
} from '../../../src/agent/connection/BackendConnection';
import {
  AgentMessage,
  CloseCode,
  ConfigMessage,
  PingResultWire,
  PROTOCOL_VERSION
} from '../../../src/agent/protocol';
import { silentLogger } from '../helpers';

// A stand-in backend on localhost: it records what the agent sends and lets
// each test answer as the real gateway would.
class FakeBackend {
  readonly server: Server;
  readonly wss = new WebSocketServer({ noServer: true });
  readonly sockets: WebSocket[] = [];
  readonly received: AgentMessage[] = [];
  readonly authorizations: (string | undefined)[] = [];
  rejectWith: number | null = null;
  private waiters: Array<() => void> = [];

  constructor() {
    this.server = createServer();
    this.server.on('upgrade', (req, socket, head) => {
      this.authorizations.push(req.headers.authorization);
      if (this.rejectWith) {
        socket.on('error', () => {});
        socket.end(
          `HTTP/1.1 ${this.rejectWith} Nope\r\nContent-Length: 0\r\n\r\n`
        );
        this.wake();
        return;
      }
      this.wss.handleUpgrade(req, socket, head, (ws) => {
        this.sockets.push(ws);
        ws.on('message', (data) => {
          this.received.push(JSON.parse(data.toString()));
          this.wake();
        });
        this.wake();
      });
    });
  }

  async listen(): Promise<string> {
    await new Promise<void>((resolve) =>
      this.server.listen(0, resolve)
    );
    return `http://127.0.0.1:${(this.server.address() as AddressInfo).port}`;
  }

  get latest(): WebSocket {
    return this.sockets[this.sockets.length - 1];
  }

  send(message: object): void {
    this.latest.send(JSON.stringify(message));
  }

  welcome(heartbeatIntervalMs = 60_000): void {
    this.send({
      type: 'welcome',
      agentName: 'Torre',
      heartbeatIntervalMs
    });
  }

  async until(
    check: () => boolean,
    timeoutMs = 3_000
  ): Promise<void> {
    const deadline = Date.now() + timeoutMs;
    while (!check()) {
      if (Date.now() > deadline) throw new Error('Timed out waiting');
      await new Promise<void>((resolve) => {
        this.waiters.push(resolve);
        setTimeout(resolve, 20);
      });
    }
  }

  messages<T extends AgentMessage['type']>(type: T) {
    return this.received.filter((m) => m.type === type) as Extract<
      AgentMessage,
      { type: T }
    >[];
  }

  async close(): Promise<void> {
    for (const ws of this.sockets) ws.terminate();
    this.wss.close();
    await new Promise((resolve) => this.server.close(resolve));
  }

  private wake(): void {
    this.waiters.splice(0).forEach((wake) => wake());
  }
}

class FakeResults implements OutboundResults {
  queue: PingResultWire[] = [];
  acknowledged: string[] = [];
  released: string[] = [];
  take(max: number) {
    return this.queue.splice(0, max);
  }
  acknowledge(ids: string[]) {
    this.acknowledged.push(...ids);
  }
  release(ids: string[]) {
    this.released.push(...ids);
  }
  releaseAll = jest.fn();
}

const result = (id: string): PingResultWire => ({
  id,
  d: 1,
  at: Date.now(),
  reachable: true,
  latencyMs: 1,
  attempts: 1
});

describe('BackendConnection', () => {
  let backend: FakeBackend;
  let backendUrl: string;
  let results: FakeResults;
  let callbacks: jest.Mocked<ConnectionCallbacks>;
  let connection: BackendConnection;

  const connect = (overrides = {}) => {
    connection = new BackendConnection(
      { backendUrl, token: 'tok-1', agentName: 'Torre' },
      results,
      callbacks,
      silentLogger(),
      {
        agentVersion: '9.9.9',
        flushEveryMs: 20,
        batchSize: 2,
        maxBatchesInFlight: 4,
        ackTimeoutMs: 5_000,
        retryInitialMs: 20,
        retryMaxMs: 50,
        retryLongMs: 150,
        retryReplacedMs: 100,
        handshakeTimeoutMs: 1_000,
        ...overrides
      }
    );
    connection.start();
    return connection;
  };

  const config = (version: string): ConfigMessage => ({
    type: 'config',
    version,
    devices: [
      {
        d: 1,
        ip: '10.0.0.1',
        intervalSeconds: 60,
        failuresBeforeDown: 3
      }
    ]
  });

  beforeEach(async () => {
    backend = new FakeBackend();
    backendUrl = await backend.listen();
    results = new FakeResults();
    callbacks = {
      onConfig: jest.fn().mockResolvedValue(undefined),
      onWelcome: jest.fn(),
      onUpdate: jest.fn(),
      onProbe: jest.fn(),
      onSubscriptionExpired: jest.fn(),
      onRevoked: jest.fn()
    };
  });

  afterEach(async () => {
    await connection?.stop();
    await backend.close();
  });

  it('[AGT-040] connects with its token and says hello first', async () => {
    connect();

    await backend.until(() => backend.received.length > 0);

    expect(backend.authorizations).toEqual(['Bearer tok-1']);
    expect(backend.received[0]).toEqual({
      type: 'hello',
      protocolVersion: PROTOCOL_VERSION,
      agentVersion: '9.9.9',
      sentAt: expect.any(Number)
    });
  });

  it('[AGT-065] sends heartbeats on the interval the welcome names', async () => {
    connect();
    await backend.until(() => backend.received.length > 0);

    backend.welcome(30);

    await backend.until(
      () => backend.messages('heartbeat').length >= 2
    );
    expect(callbacks.onWelcome).toHaveBeenCalled();
    expect(connection.isConnected).toBe(true);
  });

  it('[AGT-062] applies each configuration and acknowledges its version', async () => {
    connect();
    await backend.until(() => backend.received.length > 0);
    backend.welcome();

    backend.send(config('v1'));
    await backend.until(
      () => backend.messages('config.ack').length === 1
    );
    backend.send(config('v2'));
    await backend.until(
      () => backend.messages('config.ack').length === 2
    );

    expect(
      backend.messages('config.ack').map((m) => m.version)
    ).toEqual(['v1', 'v2']);
    expect(callbacks.onConfig.mock.calls.map((c) => c[1])).toEqual([
      true,
      false
    ]);
  });

  it('[AGT-063] the first configuration after every reconnect is marked first', async () => {
    connect();
    await backend.until(() => backend.sockets.length === 1);
    backend.welcome();
    backend.send(config('v1'));
    await backend.until(
      () => callbacks.onConfig.mock.calls.length === 1
    );

    backend.latest.terminate();
    await backend.until(() => backend.sockets.length === 2);
    await backend.until(() => backend.received.length >= 3);
    backend.welcome();
    backend.send(config('v1'));
    await backend.until(
      () => callbacks.onConfig.mock.calls.length === 2
    );

    expect(callbacks.onConfig.mock.calls.map((c) => c[1])).toEqual([
      true,
      true
    ]);
  });

  it('[AGT-064] sends results in batches once welcomed, and acknowledges what the backend acknowledged', async () => {
    results.queue = [result('a'), result('b'), result('c')];
    connect();
    await backend.until(() => backend.received.length > 0);
    expect(backend.messages('results')).toEqual([]);

    backend.welcome();
    await backend.until(
      () => backend.messages('results').length === 2
    );
    const [first, second] = backend.messages('results');
    expect(first.results.map((r) => r.id)).toEqual(['a', 'b']);
    expect(second.results.map((r) => r.id)).toEqual(['c']);

    backend.send({
      type: 'results.ack',
      batchId: first.batchId,
      ids: ['a']
    });
    await backend.until(() => results.acknowledged.length === 1);

    expect(results.acknowledged).toEqual(['a']);
    // Not acknowledged means not stored: it goes back to be sent again.
    expect(results.released).toEqual(['b']);
  });

  it('[AGT-064] a batch never acknowledged is released after the timeout', async () => {
    results.queue = [result('a')];
    connect({ ackTimeoutMs: 50 });
    await backend.until(() => backend.received.length > 0);
    backend.welcome();

    await backend.until(() => results.released.length === 1);

    expect(results.released).toEqual(['a']);
  });

  it('[AGT-064] a dropped connection releases everything in flight and reconnects', async () => {
    connect();
    await backend.until(() => backend.sockets.length === 1);
    backend.welcome();

    backend.latest.terminate();

    await backend.until(() => backend.sockets.length === 2);
    expect(results.releaseAll).toHaveBeenCalled();
  });

  it('[AGT-066] revoked (4001): forgets itself and never reconnects', async () => {
    connect();
    await backend.until(() => backend.sockets.length === 1);

    backend.latest.close(CloseCode.REVOKED, 'Agent revoked');
    await backend.until(
      () => callbacks.onRevoked.mock.calls.length === 1
    );
    await new Promise((resolve) => setTimeout(resolve, 150));

    expect(backend.sockets).toHaveLength(1);
  });

  it('[AGT-065] subscription expired (4003): stops measuring and retries on the long interval', async () => {
    connect({ retryLongMs: 200 });
    await backend.until(() => backend.sockets.length === 1);

    const closedAt = Date.now();
    backend.latest.close(CloseCode.SUBSCRIPTION_EXPIRED, 'Expired');
    await backend.until(() => backend.sockets.length === 2);

    expect(callbacks.onSubscriptionExpired).toHaveBeenCalled();
    expect(Date.now() - closedAt).toBeGreaterThanOrEqual(190);
  });

  it('[AGT-065] update required (4002): retries on the long interval', async () => {
    connect({ retryLongMs: 200 });
    await backend.until(() => backend.sockets.length === 1);

    const closedAt = Date.now();
    backend.latest.close(CloseCode.UPDATE_REQUIRED, 'Update');
    await backend.until(() => backend.sockets.length === 2);

    expect(Date.now() - closedAt).toBeGreaterThanOrEqual(190);
  });

  it('[AGT-065] replaced (4000): waits before taking the connection back', async () => {
    connect({ retryReplacedMs: 200 });
    await backend.until(() => backend.sockets.length === 1);

    const closedAt = Date.now();
    backend.latest.close(CloseCode.REPLACED, 'Replaced');
    await backend.until(() => backend.sockets.length === 2);

    expect(Date.now() - closedAt).toBeGreaterThanOrEqual(190);
  });

  it('[AGT-065] a refused token (401) is retried, never taken as a revocation', async () => {
    backend.rejectWith = 401;
    connect();

    await backend.until(() => backend.authorizations.length >= 3);

    expect(callbacks.onRevoked).not.toHaveBeenCalled();
  });

  it('[AGT-082] names its platform in the hello when it can update itself', async () => {
    connect({ platform: 'linux-x64' });

    await backend.until(() => backend.received.length > 0);

    expect(backend.received[0]).toMatchObject({
      type: 'hello',
      platform: 'linux-x64'
    });
  });

  it('[AGT-100] names its capabilities in the hello', async () => {
    connect({ capabilities: ['probe'] });

    await backend.until(() => backend.received.length > 0);

    expect(backend.received[0]).toMatchObject({
      type: 'hello',
      capabilities: ['probe']
    });
  });

  it('[AGT-100] names no capabilities when it has none', async () => {
    connect();

    await backend.until(() => backend.received.length > 0);

    expect(backend.received[0]).not.toHaveProperty('capabilities');
  });

  it('[AGT-101] answers a probe request with the result of the same request', async () => {
    callbacks.onProbe.mockResolvedValue({
      type: 'probe.result',
      requestId: 'r-1',
      kind: 'ping',
      at: 5,
      reading: { reachable: true, latencyMs: 3, attempts: 1 }
    });
    connect();
    await backend.until(() => backend.received.length > 0);
    backend.welcome();
    const request = {
      type: 'probe',
      requestId: 'r-1',
      kind: 'ping',
      ip: '10.0.0.9',
      attempts: 3
    };

    backend.send(request);

    await backend.until(
      () => backend.messages('probe.result').length > 0
    );
    expect(callbacks.onProbe).toHaveBeenCalledWith(request);
    expect(backend.messages('probe.result')[0]).toMatchObject({
      requestId: 'r-1',
      reading: { reachable: true }
    });
  });

  it('[AGT-101] keeps handling messages while a probe is still running', async () => {
    callbacks.onProbe.mockReturnValue(new Promise(() => {}));
    connect();
    await backend.until(() => backend.received.length > 0);
    backend.welcome();

    backend.send({
      type: 'probe',
      requestId: 'slow',
      kind: 'ping',
      ip: '10.0.0.9',
      attempts: 1
    });
    backend.send(config('v1'));

    await backend.until(
      () => backend.messages('config.ack').length > 0
    );
    expect(backend.messages('probe.result')).toEqual([]);
  });

  it('[AGT-081] hands an update offer to the updater', async () => {
    connect();
    await backend.until(() => backend.received.length > 0);
    backend.welcome();
    const offer = {
      type: 'update',
      version: '9.9.10',
      file: 'nms-agent-9.9.10-linux-x64.gz',
      sha256: 'a'.repeat(64),
      bytes: 10,
      signature: 'c2ln'
    };

    backend.send(offer);

    await backend.until(
      () => callbacks.onUpdate.mock.calls.length > 0
    );
    expect(callbacks.onUpdate).toHaveBeenCalledWith(offer);
  });

  it('[AGT-084] sends an update result only once welcomed', async () => {
    connect();
    await backend.until(() => backend.received.length > 0);
    const result = {
      type: 'update.result' as const,
      version: '9.9.10',
      outcome: 'installed' as const
    };

    connection.sendUpdateResult(result);
    backend.welcome();
    await backend.until(() => connection.isConnected);
    connection.sendUpdateResult(result);

    await backend.until(
      () => backend.messages('update.result').length > 0
    );
    expect(backend.messages('update.result')).toEqual([result]);
  });

  it('stop closes the connection and does not reconnect', async () => {
    connect();
    await backend.until(() => backend.sockets.length === 1);

    await connection.stop();
    await new Promise((resolve) => setTimeout(resolve, 100));

    expect(backend.sockets).toHaveLength(1);
  });

  it.each([
    ['https://api.example.com', 'wss://api.example.com/agent/v1/ws'],
    ['http://127.0.0.1:3000', 'ws://127.0.0.1:3000/agent/v1/ws']
  ])('derives the socket URL from %s', (backend, expected) => {
    expect(toWebSocketUrl(backend)).toBe(expected);
  });
});
