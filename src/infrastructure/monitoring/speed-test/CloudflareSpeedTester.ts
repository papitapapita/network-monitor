import {
  IInternetSpeedTester,
  SpeedTestMeasurement
} from 'application/device-monitoring/interfaces';
import {
  SpeedTestPhase,
  SpeedTestPlanDTO,
  SpeedTestProgressDTO
} from 'application/device-monitoring/dtos';

export interface CloudflareSpeedTesterOptions {
  baseUrl: string;
  latencySamples: number;
  downloadSeconds: number;
  uploadSeconds: number;
  connections: number;
  // the start of each throughput phase, left out of its result
  warmUpMs: number;
  downloadRequestBytes: number;
  uploadRequestBytes: number;
  progressIntervalMs: number;
  latencyTimeoutMs: number;
}

// MON-102
export const DEFAULT_CLOUDFLARE_SPEED_TEST_OPTIONS: CloudflareSpeedTesterOptions =
  {
    baseUrl: 'https://speed.cloudflare.com',
    latencySamples: 10,
    downloadSeconds: 10,
    uploadSeconds: 10,
    connections: 4,
    warmUpMs: 2_000,
    // Cloudflare answers 429 for an hour to an address that asks for 10 MB
    // or more at a time too often; smaller requests are not limited.
    downloadRequestBytes: 8_000_000,
    uploadRequestBytes: 10_000_000,
    progressIntervalMs: 1_000,
    latencyTimeoutMs: 5_000
  };

const UPLOAD_PIECE = new Uint8Array(64 * 1024);

type Report = (progress: SpeedTestProgressDTO) => void;

// MON-100: measures against Cloudflare's public speed-test servers, the same
// ones speed.cloudflare.com uses.
export class CloudflareSpeedTester implements IInternetSpeedTester {
  private readonly options: CloudflareSpeedTesterOptions;

  constructor(options: Partial<CloudflareSpeedTesterOptions> = {}) {
    this.options = {
      ...DEFAULT_CLOUDFLARE_SPEED_TEST_OPTIONS,
      ...options
    };
  }

  get plan(): SpeedTestPlanDTO {
    return {
      latencySamples: this.options.latencySamples,
      downloadSeconds: this.options.downloadSeconds,
      uploadSeconds: this.options.uploadSeconds
    };
  }

  async measure(
    onProgress: Report,
    signal: AbortSignal
  ): Promise<SpeedTestMeasurement> {
    const measurement: SpeedTestMeasurement = {
      downloadMbps: null,
      uploadMbps: null,
      latencyMs: null,
      jitterMs: null,
      serverLocation: null,
      error: null
    };
    let phase: SpeedTestPhase = 'LATENCY';
    try {
      const latency = await this.latency(onProgress, signal);
      Object.assign(measurement, latency);
      phase = 'DOWNLOAD';
      measurement.downloadMbps = await this.throughput(
        'DOWNLOAD',
        this.options.downloadSeconds,
        (phaseSignal, count) => this.download(phaseSignal, count),
        onProgress,
        signal
      );
      phase = 'UPLOAD';
      measurement.uploadMbps = await this.throughput(
        'UPLOAD',
        this.options.uploadSeconds,
        (phaseSignal, count) => this.upload(phaseSignal, count),
        onProgress,
        signal
      );
    } catch (error) {
      measurement.error = `${PHASE_NAMES[phase]} failed: ${describe(error)}`;
    }
    return measurement;
  }

  // Two requests first open the connection and are dropped: the first pays
  // for the TLS handshake, and the second still came back slow in testing.
  // Cloudflare's own processing time, which it reports in Server-Timing, is
  // taken off each sample.
  private async latency(
    report: Report,
    signal: AbortSignal
  ): Promise<
    Pick<
      SpeedTestMeasurement,
      'latencyMs' | 'jitterMs' | 'serverLocation'
    >
  > {
    const startedAt = performance.now();
    const first = await this.timedEmptyRequest(signal);
    await this.timedEmptyRequest(signal);
    const samples: number[] = [];
    for (let i = 0; i < this.options.latencySamples; i++) {
      const { latencyMs } = await this.timedEmptyRequest(signal);
      samples.push(latencyMs);
      report({
        phase: 'LATENCY',
        elapsedMs: Math.round(performance.now() - startedAt),
        mbps: null,
        latencyMs: round(latencyMs)
      });
    }
    const jitter =
      samples.length < 2
        ? 0
        : samples
            .slice(1)
            .reduce(
              (sum, sample, i) => sum + Math.abs(sample - samples[i]),
              0
            ) /
          (samples.length - 1);
    return {
      latencyMs: round(median(samples)),
      jitterMs: round(jitter),
      serverLocation: first.serverLocation
    };
  }

  private async timedEmptyRequest(
    signal: AbortSignal
  ): Promise<{ latencyMs: number; serverLocation: string | null }> {
    const startedAt = performance.now();
    const response = await fetch(
      `${this.options.baseUrl}/__down?bytes=0`,
      {
        signal: AbortSignal.any([
          signal,
          AbortSignal.timeout(this.options.latencyTimeoutMs)
        ]),
        cache: 'no-store'
      }
    );
    const elapsed = performance.now() - startedAt;
    await response.arrayBuffer();
    if (!response.ok) {
      throw refusal(response);
    }
    return {
      latencyMs: Math.max(
        0,
        elapsed - serverTimeMs(response.headers.get('server-timing'))
      ),
      serverLocation: serverLocation(response.headers)
    };
  }

  private async download(
    signal: AbortSignal,
    count: (bytes: number) => void
  ): Promise<void> {
    const response = await fetch(
      `${this.options.baseUrl}/__down?bytes=${this.options.downloadRequestBytes}`,
      { signal, cache: 'no-store' }
    );
    if (!response.ok || !response.body) {
      throw refusal(response);
    }
    for await (const chunk of response.body) {
      count(chunk.byteLength);
    }
  }

  // Counted as the request body is read, so the rate moves while a request
  // is still going.
  private async upload(
    signal: AbortSignal,
    count: (bytes: number) => void
  ): Promise<void> {
    const total = this.options.uploadRequestBytes;
    let sent = 0;
    const body = new ReadableStream<Uint8Array>({
      pull(controller) {
        if (sent >= total) {
          controller.close();
          return;
        }
        const piece = UPLOAD_PIECE.subarray(
          0,
          Math.min(UPLOAD_PIECE.length, total - sent)
        );
        sent += piece.length;
        count(piece.length);
        controller.enqueue(piece);
      }
    });
    const response = await fetch(`${this.options.baseUrl}/__up`, {
      method: 'POST',
      body,
      signal,
      // Node needs this to send a streamed body.
      duplex: 'half'
    } as RequestInit);
    await response.arrayBuffer();
    if (!response.ok) {
      throw refusal(response);
    }
  }

  // Several connections transfer back to back until the time is up. The
  // result leaves out the warm-up, while TCP is still speeding up.
  private async throughput(
    phase: SpeedTestPhase,
    seconds: number,
    transfer: (
      signal: AbortSignal,
      count: (bytes: number) => void
    ) => Promise<void>,
    report: Report,
    signal: AbortSignal
  ): Promise<number> {
    signal.throwIfAborted();
    const phaseAbort = new AbortController();
    const stop = () => phaseAbort.abort();
    signal.addEventListener('abort', stop, { once: true });

    const startedAt = performance.now();
    let bytes = 0;
    let warm: { bytes: number; at: number } | null = null;
    let lastTick = { bytes: 0, at: startedAt };
    let timeUp = false;
    let failure: unknown = null;

    const ticker = setInterval(() => {
      const now = performance.now();
      if (warm === null && now - startedAt >= this.options.warmUpMs) {
        warm = { bytes, at: now };
      }
      report({
        phase,
        elapsedMs: Math.round(now - startedAt),
        mbps: round(mbps(bytes - lastTick.bytes, now - lastTick.at)),
        latencyMs: null
      });
      lastTick = { bytes, at: now };
    }, this.options.progressIntervalMs);
    const deadline = setTimeout(() => {
      timeUp = true;
      phaseAbort.abort();
    }, seconds * 1000);

    const worker = async (): Promise<void> => {
      while (!phaseAbort.signal.aborted) {
        try {
          await transfer(phaseAbort.signal, (n) => {
            bytes += n;
          });
        } catch (error) {
          if (!phaseAbort.signal.aborted) {
            failure = error;
            phaseAbort.abort();
          }
          return;
        }
      }
    };
    try {
      await Promise.all(
        Array.from({ length: this.options.connections }, worker)
      );
    } finally {
      clearInterval(ticker);
      clearTimeout(deadline);
      signal.removeEventListener('abort', stop);
    }

    signal.throwIfAborted();
    if (failure !== null) throw failure;
    if (!timeUp) throw new Error('the test stopped early');
    if (bytes === 0) throw new Error('no data could be transferred');

    const end = performance.now();
    const from = warm ?? { bytes: 0, at: startedAt };
    return round(mbps(bytes - from.bytes, end - from.at));
  }
}

const PHASE_NAMES: Record<SpeedTestPhase, string> = {
  LATENCY: 'Latency',
  DOWNLOAD: 'Download',
  UPLOAD: 'Upload'
};

function refusal(response: Response): Error {
  if (response.status !== 429) {
    return new Error(`the server answered ${response.status}`);
  }
  const seconds = Number(response.headers.get('retry-after'));
  const wait =
    Number.isFinite(seconds) && seconds > 0
      ? `try again in ${Math.ceil(seconds / 60)} min`
      : 'try again later';
  return new Error(
    `Cloudflare is limiting tests from this connection, ${wait}`
  );
}

function mbps(bytes: number, ms: number): number {
  return ms <= 0 ? 0 : (bytes * 8) / (ms / 1000) / 1_000_000;
}

function median(values: number[]): number {
  const sorted = [...values].sort((a, b) => a - b);
  const middle = Math.floor(sorted.length / 2);
  return sorted.length % 2
    ? sorted[middle]
    : (sorted[middle - 1] + sorted[middle]) / 2;
}

function round(value: number): number {
  return Math.round(value * 10) / 10;
}

function serverTimeMs(header: string | null): number {
  if (!header) return 0;
  return [...header.matchAll(/;\s*dur=([\d.]+)/g)].reduce(
    (sum, match) => sum + Number(match[1]),
    0
  );
}

// The data center's code, e.g. "BOG", ends Cloudflare's ray id.
function serverLocation(headers: Headers): string | null {
  const colo = headers.get('cf-meta-colo');
  if (colo) return colo;
  const ray = headers.get('cf-ray');
  const suffix = ray?.split('-').pop();
  return ray && suffix && suffix !== ray ? suffix : null;
}

interface ErrorLike {
  name?: string;
  message: string;
  cause?: unknown;
}

// Duck-typed: fetch's errors come from Node's own realm, which instanceof
// Error does not always recognise.
function isErrorLike(value: unknown): value is ErrorLike {
  return (
    typeof value === 'object' &&
    value !== null &&
    typeof (value as ErrorLike).message === 'string'
  );
}

function describe(error: unknown): string {
  if (!isErrorLike(error)) return String(error);
  if (error.name === 'TimeoutError')
    return 'the server did not answer';
  return isErrorLike(error.cause)
    ? `${error.message} (${error.cause.message})`
    : error.message;
}
