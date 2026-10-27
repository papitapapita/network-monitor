// Source: src/infrastructure/monitoring/speed-test/CloudflareSpeedTester.ts

import http from 'http';
import { AddressInfo } from 'net';
import { CloudflareSpeedTester } from '../../../../src/infrastructure/monitoring/speed-test/CloudflareSpeedTester';
import { SpeedTestProgressDTO } from '../../../../src/application/device-monitoring/dtos/SpeedTestDTO';

interface FakeServerBehaviour {
  emptyStatus: number;
  downStatus: number;
  upStatus: number;
  serverTiming: string;
  headers: Record<string, string>;
}

// Answers like speed.cloudflare.com: /__down?bytes=N sends N bytes, /__up
// reads the body.
function startFakeCloudflare(behaviour: FakeServerBehaviour) {
  const sockets = new Set<import('net').Socket>();
  let uploaded = 0;
  const downloads: number[] = [];
  const server = http.createServer((req, res) => {
    const url = new URL(req.url!, 'http://localhost');
    if (url.pathname === '/__down') {
      const bytes = Number(url.searchParams.get('bytes'));
      downloads.push(bytes);
      const status =
        bytes === 0 ? behaviour.emptyStatus : behaviour.downStatus;
      res.writeHead(status, {
        'server-timing': behaviour.serverTiming,
        ...behaviour.headers
      });
      res.end(Buffer.alloc(status === 200 ? bytes : 0));
      return;
    }
    if (url.pathname === '/__up' && req.method === 'POST') {
      req.on('data', (chunk: Buffer) => (uploaded += chunk.length));
      req.on('end', () => {
        res.writeHead(behaviour.upStatus);
        res.end();
      });
      return;
    }
    res.writeHead(404);
    res.end();
  });
  server.on('connection', (socket) => {
    sockets.add(socket);
    socket.on('close', () => sockets.delete(socket));
  });
  return {
    listen: () =>
      new Promise<string>((resolve) =>
        server.listen(0, '127.0.0.1', () =>
          resolve(
            `http://127.0.0.1:${(server.address() as AddressInfo).port}`
          )
        )
      ),
    close: () =>
      new Promise<void>((resolve) => {
        sockets.forEach((socket) => socket.destroy());
        server.close(() => resolve());
      }),
    uploaded: () => uploaded,
    downloads: () => downloads
  };
}

const FAST = {
  latencySamples: 3,
  downloadSeconds: 0.4,
  uploadSeconds: 0.4,
  connections: 2,
  warmUpMs: 100,
  downloadRequestBytes: 2_000_000,
  uploadRequestBytes: 1_000_000,
  progressIntervalMs: 100,
  latencyTimeoutMs: 2_000
};

describe('CloudflareSpeedTester', () => {
  let behaviour: FakeServerBehaviour;
  let fake: ReturnType<typeof startFakeCloudflare>;
  let baseUrl: string;

  beforeEach(async () => {
    behaviour = {
      emptyStatus: 200,
      downStatus: 200,
      upStatus: 200,
      serverTiming: 'cfSpeedEdge;dur=0, cfL4;desc="?proto=TCP"',
      headers: { 'cf-ray': '8f00aa11bb22cc33-BOG' }
    };
    fake = startFakeCloudflare(behaviour);
    baseUrl = await fake.listen();
  });

  afterEach(async () => {
    await fake.close();
  });

  function tester(overrides = {}): CloudflareSpeedTester {
    return new CloudflareSpeedTester({
      ...FAST,
      baseUrl,
      ...overrides
    });
  }

  it('describes its plan', () => {
    expect(tester().plan).toEqual({
      latencySamples: 3,
      downloadSeconds: 0.4,
      uploadSeconds: 0.4
    });
  });

  it('measures latency, download and upload, reporting progress for each', async () => {
    const progress: SpeedTestProgressDTO[] = [];

    const measurement = await tester().measure(
      (frame) => progress.push(frame),
      new AbortController().signal
    );

    expect(measurement.error).toBeNull();
    expect(measurement.latencyMs).toBeGreaterThanOrEqual(0);
    expect(measurement.jitterMs).toBeGreaterThanOrEqual(0);
    expect(measurement.downloadMbps).toBeGreaterThan(0);
    expect(measurement.uploadMbps).toBeGreaterThan(0);
    expect(measurement.serverLocation).toBe('BOG');
    expect(fake.uploaded()).toBeGreaterThan(0);

    const latencyFrames = progress.filter(
      (p) => p.phase === 'LATENCY'
    );
    expect(latencyFrames).toHaveLength(3);
    expect(latencyFrames.every((p) => p.latencyMs !== null)).toBe(
      true
    );
    for (const phase of ['DOWNLOAD', 'UPLOAD'] as const) {
      const frames = progress.filter((p) => p.phase === phase);
      expect(frames.length).toBeGreaterThan(0);
      expect(frames.every((p) => p.mbps !== null)).toBe(true);
    }
  });

  it("takes the server's own processing time off each latency sample", async () => {
    behaviour.serverTiming =
      'cfSpeedEdge;dur=5000, cfSpeedWorker;dur=5000';

    const measurement = await tester().measure(
      () => undefined,
      new AbortController().signal
    );

    expect(measurement.latencyMs).toBe(0);
    expect(measurement.jitterMs).toBe(0);
  });

  it('prefers the location Cloudflare names outright', async () => {
    behaviour.headers = {
      'cf-meta-colo': 'MIA',
      'cf-ray': '8f00aa11bb22cc33-BOG'
    };

    const measurement = await tester().measure(
      () => undefined,
      new AbortController().signal
    );

    expect(measurement.serverLocation).toBe('MIA');
  });

  it('leaves the location empty when Cloudflare does not say', async () => {
    behaviour.headers = {};

    const measurement = await tester().measure(
      () => undefined,
      new AbortController().signal
    );

    expect(measurement.serverLocation).toBeNull();
  });

  it('stops at the first phase that fails, naming it', async () => {
    behaviour.emptyStatus = 500;

    const measurement = await tester().measure(
      () => undefined,
      new AbortController().signal
    );

    expect(measurement).toEqual({
      downloadMbps: null,
      uploadMbps: null,
      latencyMs: null,
      jitterMs: null,
      serverLocation: null,
      error: 'Latency failed: the server answered 500'
    });
  });

  it('keeps what it measured before a later phase failed', async () => {
    behaviour.upStatus = 503;

    const measurement = await tester().measure(
      () => undefined,
      new AbortController().signal
    );

    expect(measurement.latencyMs).not.toBeNull();
    expect(measurement.downloadMbps).toBeGreaterThan(0);
    expect(measurement.uploadMbps).toBeNull();
    expect(measurement.error).toBe(
      'Upload failed: the server answered 503'
    );
  });

  it('reports a download the server refuses', async () => {
    behaviour.downStatus = 500;

    const measurement = await tester().measure(
      () => undefined,
      new AbortController().signal
    );

    expect(measurement.downloadMbps).toBeNull();
    expect(measurement.error).toBe(
      'Download failed: the server answered 500'
    );
  });

  it('says when Cloudflare will allow another test', async () => {
    behaviour.downStatus = 429;
    behaviour.headers = { 'retry-after': '3485' };

    const measurement = await tester().measure(
      () => undefined,
      new AbortController().signal
    );

    expect(measurement.error).toBe(
      'Download failed: Cloudflare is limiting tests from this connection, try again in 59 min'
    );
  });

  it('says to try later when Cloudflare gives no wait', async () => {
    behaviour.downStatus = 429;

    const measurement = await tester().measure(
      () => undefined,
      new AbortController().signal
    );

    expect(measurement.error).toBe(
      'Download failed: Cloudflare is limiting tests from this connection, try again later'
    );
  });

  it('asks for less than 10 MB per download request by default', async () => {
    const { downloadRequestBytes, ...withDefaultSize } = FAST;

    await new CloudflareSpeedTester({
      ...withDefaultSize,
      baseUrl
    }).measure(() => undefined, new AbortController().signal);

    const sizes = fake.downloads().filter((bytes) => bytes > 0);
    expect(sizes.length).toBeGreaterThan(0);
    expect(sizes.every((bytes) => bytes < 10_000_000)).toBe(true);
  });

  it('reports a server it cannot reach', async () => {
    await fake.close();

    const measurement = await tester().measure(
      () => undefined,
      new AbortController().signal
    );

    expect(measurement.error).toMatch(
      /^Latency failed: fetch failed/
    );
  });

  it('stops soon after the caller aborts', async () => {
    const abort = new AbortController();
    const slow = tester({ downloadSeconds: 30, uploadSeconds: 30 });

    const startedAt = Date.now();
    const measuring = slow.measure((frame) => {
      if (frame.phase === 'DOWNLOAD') abort.abort();
    }, abort.signal);
    const measurement = await measuring;

    expect(Date.now() - startedAt).toBeLessThan(5_000);
    expect(measurement.downloadMbps).toBeNull();
    expect(measurement.uploadMbps).toBeNull();
  });
});
