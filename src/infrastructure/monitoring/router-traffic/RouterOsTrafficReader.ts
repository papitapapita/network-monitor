import { RouterOSAPI } from '../routeros/routerOsApi';
import { Result } from 'domain/shared/core';
import type {
  InterfaceTrafficReading,
  IRouterTrafficReader,
  RouterConnectionTarget
} from 'application/device-monitoring/interfaces';
import type { ILogger } from 'application/shared/interfaces';
import { MAX_TRAFFIC_INTERFACES } from 'agent/protocol';

export interface RouterOsTrafficReaderOptions {
  // a read slower than this drops the login, so the next one starts clean
  readTimeoutMs: number;
  // a login unused this long is closed (MON-064)
  idleCloseMs: number;
}

export const DEFAULT_TRAFFIC_READER_OPTIONS: RouterOsTrafficReaderOptions =
  {
    readTimeoutMs: 5_000,
    idleCloseMs: 30_000
  };

interface InterfaceRow {
  name?: string;
  type?: string;
  running?: string;
}

interface MonitorRow {
  name?: string;
  'rx-bits-per-second'?: string;
  'tx-bits-per-second'?: string;
}

interface OpenLogin {
  client: RouterOSAPI;
  connecting: Promise<RouterOSAPI>;
  lastUsed: number;
}

// MON-064: RouterOS logs every API login, so a read every 2 s keeps the
// router's login open between reads instead of logging in each time.
export class RouterOsTrafficReader implements IRouterTrafficReader {
  private readonly logins = new Map<string, OpenLogin>();
  private sweeper: ReturnType<typeof setInterval> | null = null;

  constructor(
    private readonly logger?: ILogger,
    private readonly options: RouterOsTrafficReaderOptions = DEFAULT_TRAFFIC_READER_OPTIONS,
    private readonly now: () => number = Date.now
  ) {}

  async read(
    router: RouterConnectionTarget
  ): Promise<Result<InterfaceTrafficReading[]>> {
    const key = `${router.host}:${router.port}:${router.username}`;
    try {
      const client = await this.loginFor(key, router);
      const readings = await withTimeout(
        this.readInterfaces(client),
        this.options.readTimeoutMs
      );
      return Result.ok(readings);
    } catch (error) {
      await this.drop(key);
      const message =
        error instanceof Error ? error.message : String(error);
      this.logger?.warn('[RouterOsTrafficReader] read failed', {
        host: router.host,
        error: message
      });
      return Result.fail(`RouterOS API error: ${message}`);
    }
  }

  async releaseAll(): Promise<void> {
    await Promise.all(
      [...this.logins.keys()].map((k) => this.drop(k))
    );
    this.stopSweeper();
  }

  private async readInterfaces(
    client: RouterOSAPI
  ): Promise<InterfaceTrafficReading[]> {
    // MON-063: a gateway serving PPPoE has one dynamic interface per
    // customer; the static ones are the router's own links.
    const rows = (await client.write('/interface/print', [
      '?disabled=false',
      '?dynamic=false',
      '=.proplist=name,type,running'
    ])) as InterfaceRow[];

    // monitor-traffic takes the names as one comma-separated list
    const interfaces = rows
      .filter((r) => r.name && !r.name.includes(','))
      .slice(0, MAX_TRAFFIC_INTERFACES);
    if (interfaces.length === 0) return [];

    const rates = (await client.write('/interface/monitor-traffic', [
      `=interface=${interfaces.map((r) => r.name).join(',')}`,
      '=once='
    ])) as MonitorRow[];
    const byName = new Map(rates.map((r) => [r.name, r]));

    return interfaces.map((r) => {
      const rate = byName.get(r.name);
      return {
        name: r.name!,
        type: r.type ?? '',
        running: r.running === 'true',
        rxBps: toNumber(rate?.['rx-bits-per-second']),
        txBps: toNumber(rate?.['tx-bits-per-second'])
      };
    });
  }

  private loginFor(
    key: string,
    router: RouterConnectionTarget
  ): Promise<RouterOSAPI> {
    const open = this.logins.get(key);
    if (open) {
      open.lastUsed = this.now();
      return open.connecting;
    }

    const client = new RouterOSAPI({
      host: router.host,
      port: router.port,
      user: router.username,
      password: router.password,
      // the socket's own idle limit; reads keep it busy far more often
      timeout: Math.ceil(this.options.idleCloseMs / 1000) + 30
    });
    // once logged in, a dropped socket is emitted as 'error'; unheard,
    // it would take the whole process down
    client.on('error', () => {
      if (this.logins.get(key)?.client === client) {
        this.logins.delete(key);
      }
    });
    const connecting = client.connect();
    this.logins.set(key, {
      client,
      connecting,
      lastUsed: this.now()
    });
    this.startSweeper();
    return connecting;
  }

  private async drop(key: string): Promise<void> {
    const open = this.logins.get(key);
    if (!open) return;
    this.logins.delete(key);
    if (open.client.connected) {
      await open.client.close().catch(() => undefined);
    }
    if (this.logins.size === 0) this.stopSweeper();
  }

  private startSweeper(): void {
    if (this.sweeper) return;
    this.sweeper = setInterval(
      () => void this.closeIdle(),
      Math.max(1_000, this.options.idleCloseMs / 3)
    );
    this.sweeper.unref?.();
  }

  private stopSweeper(): void {
    if (!this.sweeper) return;
    clearInterval(this.sweeper);
    this.sweeper = null;
  }

  private async closeIdle(): Promise<void> {
    const cutoff = this.now() - this.options.idleCloseMs;
    const idle = [...this.logins.entries()]
      .filter(([, open]) => open.lastUsed < cutoff)
      .map(([key]) => key);
    await Promise.all(idle.map((key) => this.drop(key)));
  }
}

function toNumber(value: string | undefined): number {
  const n = Number(value);
  return Number.isFinite(n) && n >= 0 ? n : 0;
}

function withTimeout<T>(work: Promise<T>, ms: number): Promise<T> {
  let timer: ReturnType<typeof setTimeout>;
  const timeout = new Promise<never>((_, reject) => {
    timer = setTimeout(
      () => reject(new Error(`no answer within ${ms} ms`)),
      ms
    );
  });
  return Promise.race([work, timeout]).finally(() =>
    clearTimeout(timer)
  );
}
