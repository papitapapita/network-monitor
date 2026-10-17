import { Result } from 'domain/shared/core';
import {
  IEventStreamHub,
  ILogger
} from 'application/shared/interfaces';
import {
  IRouterTrafficMonitor,
  IRouterTrafficReader,
  IRouterTrafficTargetsQuery
} from 'application/device-monitoring/interfaces';
import {
  RouterTrafficDTO,
  RouterTrafficSnapshotDTO
} from 'application/device-monitoring/dtos';
import {
  resolveRouterTrafficTarget,
  RouterTrafficTarget
} from 'application/device-monitoring/services';
import {
  ROUTER_TRAFFIC_CHANNEL,
  ROUTER_TRAFFIC_EVENT
} from 'application/device-monitoring/channels';

export interface RouterTrafficMonitorConfig {
  intervalMs?: number;
  // a router added or edited while the page is open shows up this soon
  targetsRefreshMs?: number;
}

interface Watched {
  deviceId: string;
  deviceName: string;
  target: RouterTrafficTarget;
}

// MON-062: the main routers are read every couple of seconds while at least
// one viewer holds the stream, and not at all otherwise. One loop serves
// every viewer, so a second open page costs the routers nothing.
export class RouterTrafficMonitor implements IRouterTrafficMonitor {
  private readonly intervalMs: number;
  private readonly targetsRefreshMs: number;

  private timer: ReturnType<typeof setInterval> | null = null;
  private watched: Watched[] = [];
  private targetsLoadedAt = 0;
  private refreshing = false;
  private readonly latest = new Map<string, RouterTrafficDTO>();
  // a read that outlives its interval is skipped, not stacked
  private readonly inFlight = new Set<string>();

  constructor(
    private readonly targets: IRouterTrafficTargetsQuery,
    private readonly reader: IRouterTrafficReader,
    private readonly hub: IEventStreamHub,
    private readonly logger: ILogger,
    config: RouterTrafficMonitorConfig = {},
    private readonly clock: () => Date = () => new Date()
  ) {
    this.intervalMs = config.intervalMs ?? 2_000;
    this.targetsRefreshMs = config.targetsRefreshMs ?? 60_000;
  }

  async watch(): Promise<Result<RouterTrafficSnapshotDTO>> {
    if (!this.timer) {
      const loaded = await this.loadTargets();
      if (loaded.isFailure) return Result.fail(loaded.error);

      // another viewer may have started it while the targets loaded
      if (!this.timer) {
        this.timer = setInterval(() => this.tick(), this.intervalMs);
        this.timer.unref?.();
        // after the caller has subscribed, so the first rates reach it
        setImmediate(() => this.readAll());
        this.logger.info('[RouterTrafficMonitor] Started', {
          routers: this.watched.length
        });
      }
    }

    return Result.ok({
      intervalSeconds: this.intervalMs / 1000,
      routers: this.watched.map((w) => this.latest.get(w.deviceId)!)
    });
  }

  async stop(): Promise<void> {
    if (this.timer) {
      clearInterval(this.timer);
      this.timer = null;
      this.logger.info('[RouterTrafficMonitor] Stopped');
    }
    this.watched = [];
    this.latest.clear();
    await this.reader.releaseAll();
  }

  private tick(): void {
    if (this.hub.clientCount(ROUTER_TRAFFIC_CHANNEL) === 0) {
      void this.stop();
      return;
    }
    if (
      !this.refreshing &&
      this.clock().getTime() - this.targetsLoadedAt >=
        this.targetsRefreshMs
    ) {
      this.refreshing = true;
      void this.loadTargets().finally(() => {
        this.refreshing = false;
      });
    }
    this.readAll();
  }

  private async loadTargets(): Promise<Result<void>> {
    const listed = await this.targets.listMainRouters();
    if (listed.isFailure) {
      this.logger.warn(
        '[RouterTrafficMonitor] Could not list routers',
        {
          error: listed.error
        }
      );
      return Result.fail(listed.error);
    }

    this.watched = listed.value.map((candidate) => ({
      deviceId: candidate.deviceId,
      deviceName: candidate.deviceName,
      target: resolveRouterTrafficTarget(candidate)
    }));
    this.targetsLoadedAt = this.clock().getTime();

    const kept = new Set(this.watched.map((w) => w.deviceId));
    for (const deviceId of [...this.latest.keys()]) {
      if (!kept.has(deviceId)) this.latest.delete(deviceId);
    }
    for (const w of this.watched) {
      const previous = this.latest.get(w.deviceId);
      this.latest.set(w.deviceId, {
        deviceId: w.deviceId,
        deviceName: w.deviceName,
        at: w.target.readable ? (previous?.at ?? null) : null,
        error: w.target.readable
          ? (previous?.error ?? null)
          : w.target.reason,
        interfaces: w.target.readable
          ? (previous?.interfaces ?? [])
          : []
      });
    }
    return Result.ok();
  }

  private readAll(): void {
    for (const w of this.watched) {
      if (!w.target.readable || this.inFlight.has(w.deviceId))
        continue;
      void this.readOne(w, w.target.router);
    }
  }

  private async readOne(
    w: Watched,
    router: Extract<RouterTrafficTarget, { readable: true }>['router']
  ): Promise<void> {
    this.inFlight.add(w.deviceId);
    try {
      const read = await this.reader.read(router);
      // stopped, or the router left the list, while the read was out
      if (!this.timer || !this.latest.has(w.deviceId)) return;

      const frame: RouterTrafficDTO = {
        deviceId: w.deviceId,
        deviceName: w.deviceName,
        at: this.clock().toISOString(),
        error: read.isFailure ? read.error : null,
        interfaces: read.isFailure ? [] : read.value
      };
      this.latest.set(w.deviceId, frame);
      this.hub.publish(
        ROUTER_TRAFFIC_CHANNEL,
        ROUTER_TRAFFIC_EVENT,
        frame
      );
    } catch (error) {
      this.logger.error(
        '[RouterTrafficMonitor] Unexpected read error',
        error instanceof Error ? error : new Error(String(error)),
        { deviceId: w.deviceId }
      );
    } finally {
      this.inFlight.delete(w.deviceId);
    }
  }
}
