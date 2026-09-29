import { promises as fs } from 'fs';
import path from 'path';
import type { ILogger } from 'application/shared/interfaces';
import { PingResultWire } from 'agent/protocol';

export interface ResultBufferOptions {
  // R13: how long an unacknowledged result is kept before it is dropped.
  retentionMs: number;
  // Results are appended to one file per segment; a segment whose results
  // are all acknowledged is deleted.
  segmentMs: number;
  persistEveryMs: number;
  now: () => number;
}

const DEFAULTS: ResultBufferOptions = {
  retentionMs: 24 * 60 * 60 * 1000,
  segmentMs: 10 * 60 * 1000,
  persistEveryMs: 1_000,
  now: () => Date.now()
};

interface Entry {
  wire: PingResultWire;
  segment: number;
}

// Every result the backend has not acknowledged yet, in memory and on disk
// (ADR 0002, R13). Nothing is deleted until acknowledged or 24 hours old.
//
// Sending takes the newest first, so a live result never queues behind a
// backlog (R11). Acknowledgements are not written down: after a restart the
// agent resends what a segment still holds and the backend, which stores
// each result id once (R8), acknowledges the duplicates.
export class ResultBuffer {
  private readonly entries = new Map<string, Entry>();
  // Ids ready to send, oldest first; may hold ids since acknowledged or
  // dropped, which are skipped.
  private pending: string[] = [];
  private readonly inFlight = new Set<string>();
  private readonly segmentCounts = new Map<number, number>();
  // Fully acknowledged while still open; deleted once time moves past them.
  private readonly emptyOpenSegments = new Set<number>();
  private unwritten = new Map<number, string[]>();
  private writes: Promise<void> = Promise.resolve();
  private persistTimer: ReturnType<typeof setInterval> | null = null;

  private constructor(
    private readonly dir: string,
    private readonly logger: ILogger,
    private readonly options: ResultBufferOptions
  ) {}

  static async open(
    dataDir: string,
    logger: ILogger,
    options: Partial<ResultBufferOptions> = {}
  ): Promise<ResultBuffer> {
    const buffer = new ResultBuffer(
      path.join(dataDir, 'results'),
      logger,
      { ...DEFAULTS, ...options }
    );
    await fs.mkdir(buffer.dir, { recursive: true });
    await buffer.load();
    return buffer;
  }

  get size(): number {
    return this.entries.size;
  }

  startPersisting(): void {
    if (this.persistTimer) return;
    this.persistTimer = setInterval(
      () => void this.persist(),
      this.options.persistEveryMs
    );
  }

  async close(): Promise<void> {
    if (this.persistTimer) clearInterval(this.persistTimer);
    this.persistTimer = null;
    await this.persist();
  }

  add(wire: PingResultWire): void {
    if (this.entries.has(wire.id)) return;
    const segment = this.segmentOf(this.options.now());
    this.entries.set(wire.id, { wire, segment });
    this.pending.push(wire.id);
    this.emptyOpenSegments.delete(segment);
    this.segmentCounts.set(
      segment,
      (this.segmentCounts.get(segment) ?? 0) + 1
    );
    const lines = this.unwritten.get(segment) ?? [];
    lines.push(JSON.stringify(wire));
    this.unwritten.set(segment, lines);
  }

  // Up to `max` results not yet sent, newest first. They stay buffered until
  // acknowledged or released.
  take(max: number): PingResultWire[] {
    const batch: PingResultWire[] = [];
    while (batch.length < max && this.pending.length > 0) {
      const id = this.pending.pop()!;
      const entry = this.entries.get(id);
      if (!entry || this.inFlight.has(id)) continue;
      this.inFlight.add(id);
      batch.push(entry.wire);
    }
    return batch;
  }

  acknowledge(ids: string[]): void {
    for (const id of ids) {
      this.inFlight.delete(id);
      const entry = this.entries.get(id);
      if (!entry) continue;
      this.entries.delete(id);
      this.forgetInSegment(entry.segment);
    }
  }

  // Sent but not acknowledged — the backend could not store them, or the
  // connection dropped first. They go back to the front of the line.
  release(ids: string[]): void {
    for (const id of ids) {
      if (!this.inFlight.delete(id)) continue;
      if (this.entries.has(id)) this.pending.push(id);
    }
  }

  releaseAll(): void {
    this.release([...this.inFlight]);
  }

  // Drops what is past retention, by the time it was measured, and deletes
  // segments that emptied while they were still open.
  prune(): number {
    const current = this.segmentOf(this.options.now());
    for (const segment of this.emptyOpenSegments) {
      if (segment === current) continue;
      this.emptyOpenSegments.delete(segment);
      this.deleteSegment(segment);
    }

    const cutoff = this.options.now() - this.options.retentionMs;
    let dropped = 0;
    for (const [id, entry] of this.entries) {
      if (entry.wire.at >= cutoff) continue;
      this.entries.delete(id);
      this.inFlight.delete(id);
      this.forgetInSegment(entry.segment);
      dropped++;
    }
    if (dropped > 0) {
      this.pending = this.pending.filter(
        (id) => this.entries.has(id) && !this.inFlight.has(id)
      );
      this.logger.warn(
        'Dropped buffered results older than 24 hours',
        {
          dropped
        }
      );
    }
    return dropped;
  }

  // Revocation: nothing the agent measured is kept.
  async clear(): Promise<void> {
    this.entries.clear();
    this.pending = [];
    this.inFlight.clear();
    this.segmentCounts.clear();
    this.emptyOpenSegments.clear();
    this.unwritten.clear();
    this.writes = this.writes.then(async () => {
      await fs.rm(this.dir, { recursive: true, force: true });
      await fs.mkdir(this.dir, { recursive: true });
    });
    await this.writes;
  }

  async persist(): Promise<void> {
    const batch = this.unwritten;
    this.unwritten = new Map();
    for (const [segment, lines] of batch) {
      this.enqueueWrite(() =>
        fs.appendFile(this.fileOf(segment), lines.join('\n') + '\n')
      );
    }
    await this.writes;
  }

  private forgetInSegment(segment: number): void {
    const left = (this.segmentCounts.get(segment) ?? 1) - 1;
    if (left > 0) {
      this.segmentCounts.set(segment, left);
      return;
    }
    this.segmentCounts.delete(segment);
    // The open segment may still receive results; it is deleted once a
    // later one has taken over.
    if (segment === this.segmentOf(this.options.now())) {
      this.emptyOpenSegments.add(segment);
      return;
    }
    this.deleteSegment(segment);
  }

  private deleteSegment(segment: number): void {
    this.unwritten.delete(segment);
    this.enqueueWrite(() =>
      fs.rm(this.fileOf(segment), { force: true })
    );
  }

  private enqueueWrite(write: () => Promise<void>): void {
    this.writes = this.writes
      .then(write)
      .catch((error) =>
        this.logger.error(
          'Result buffer write failed',
          error instanceof Error ? error : new Error(String(error))
        )
      );
  }

  private async load(): Promise<void> {
    const cutoff = this.options.now() - this.options.retentionMs;
    const loaded: Entry[] = [];

    for (const name of await fs.readdir(this.dir)) {
      const segment = Number(path.basename(name, '.jsonl'));
      const file = path.join(this.dir, name);
      if (!name.endsWith('.jsonl') || !Number.isFinite(segment))
        continue;
      if (segment + this.options.segmentMs < cutoff) {
        await fs.rm(file, { force: true });
        continue;
      }
      // A line cut short by a crash is skipped; the rest of the file is kept.
      for (const line of (await fs.readFile(file, 'utf8')).split(
        '\n'
      )) {
        const wire = parseLine(line);
        if (wire && wire.at >= cutoff) loaded.push({ wire, segment });
      }
    }

    loaded.sort((a, b) => a.wire.at - b.wire.at);
    for (const entry of loaded) {
      if (this.entries.has(entry.wire.id)) continue;
      this.entries.set(entry.wire.id, entry);
      this.pending.push(entry.wire.id);
      this.segmentCounts.set(
        entry.segment,
        (this.segmentCounts.get(entry.segment) ?? 0) + 1
      );
    }

    for (const name of await fs.readdir(this.dir)) {
      const segment = Number(path.basename(name, '.jsonl'));
      if (
        Number.isFinite(segment) &&
        !this.segmentCounts.has(segment)
      ) {
        await fs.rm(path.join(this.dir, name), { force: true });
      }
    }
    if (this.entries.size > 0) {
      this.logger.info('Loaded buffered results from disk', {
        results: this.entries.size
      });
    }
  }

  private segmentOf(time: number): number {
    return (
      Math.floor(time / this.options.segmentMs) *
      this.options.segmentMs
    );
  }

  private fileOf(segment: number): string {
    return path.join(this.dir, `${segment}.jsonl`);
  }
}

function parseLine(line: string): PingResultWire | null {
  if (!line.trim()) return null;
  try {
    const wire = JSON.parse(line) as PingResultWire;
    return typeof wire.id === 'string' &&
      typeof wire.d === 'number' &&
      typeof wire.at === 'number'
      ? wire
      : null;
  } catch {
    return null;
  }
}
