import { Result } from 'domain/shared/core';
import { PoeMode, PoeStatus } from 'domain/power-control';
import type {
  IPoeSwitchReader,
  PoePortReading,
  PoeSwitchConnection,
  PoeSwitchReading
} from 'application/power-control/interfaces';
import type { ILogger } from 'application/shared/interfaces';
import { DigestHttpClient } from './DigestHttpClient';
import { decodeSwOsString, parseSwOsB } from './SwOsBFormat';
import { withTimeout } from './readerSupport';

const READ_TIMEOUT_MS = 10_000;

// PWR-024: the SwOS 2.x field names and codes its web UI reads. MikroTik does
// not document them, and these are not yet confirmed against a capture from
// Insetel's CSS106; they live here alone so that check changes one place.
const FIELDS = {
  portNames: 'nm',
  mode: 'poe',
  status: 'poes',
  // tenths of a watt and of a volt
  power: 'pwr',
  voltage: 'vlt',
  version: 'ver'
} as const;

const MODES: Record<number, PoeMode> = {
  0: PoeMode.OFF,
  1: PoeMode.AUTO,
  2: PoeMode.FORCED_ON
};

const STATUSES: Record<number, PoeStatus> = {
  0: PoeStatus.OFF,
  1: PoeStatus.NO_LOAD,
  2: PoeStatus.POWERED,
  3: PoeStatus.FAULT,
  4: PoeStatus.FAULT,
  5: PoeStatus.FAULT,
  6: PoeStatus.FAULT
};

// PWR-012: SwOS only serves plain HTTP, so the HTTPS default (443) saved for
// other devices means port 80 here.
export function swOsHttpPort(httpPort: number): number {
  return httpPort === 443 ? 80 : httpPort;
}

export class SwOsPoeReader implements IPoeSwitchReader {
  constructor(
    private readonly logger?: ILogger,
    private readonly http: DigestHttpClient = new DigestHttpClient(),
    private readonly timeoutMs: number = READ_TIMEOUT_MS
  ) {}

  async read(
    connection: PoeSwitchConnection
  ): Promise<Result<PoeSwitchReading>> {
    try {
      const reading = await withTimeout(
        this.readPorts(connection),
        this.timeoutMs
      );
      return Result.ok(reading);
    } catch (error) {
      const message =
        error instanceof Error ? error.message : String(error);
      this.logger?.warn('[SwOsPoeReader] read failed', {
        host: connection.host,
        error: message
      });
      return Result.fail(`SwOS error: ${message}`);
    }
  }

  private async readPorts(
    connection: PoeSwitchConnection
  ): Promise<PoeSwitchReading> {
    const base = `http://${connection.host}:${swOsHttpPort(connection.login.httpPort)}`;
    const load = async (file: string) =>
      asObject(
        parseSwOsB(
          await this.http.getText(
            `${base}/${file}`,
            connection.login,
            this.timeoutMs
          )
        ),
        file
      );

    const link = await load('link.b');
    const poe = await load('poe.b');
    const sys = await load('sys.b').catch(
      (): Record<string, unknown> => ({})
    );

    const names = arrayOf(link[FIELDS.portNames]);
    const modes = arrayOf(poe[FIELDS.mode]);
    const statuses = arrayOf(poe[FIELDS.status]);
    const powers = arrayOf(poe[FIELDS.power]);
    const voltages = arrayOf(poe[FIELDS.voltage]);

    const ports = modes.flatMap((rawMode, i): PoePortReading[] => {
      if (typeof rawMode !== 'number') return [];
      const port = `Port${i + 1}`;
      const name = decodeSwOsString(names[i])?.trim() ?? '';
      const mode = MODES[rawMode] ?? PoeMode.UNKNOWN;
      return [
        {
          port,
          label: name || port,
          mode,
          status:
            typeof statuses[i] === 'number'
              ? (STATUSES[statuses[i] as number] ?? PoeStatus.UNKNOWN)
              : mode === PoeMode.OFF
                ? PoeStatus.OFF
                : PoeStatus.UNKNOWN,
          powerWatts: tenths(powers[i]),
          voltage: tenths(voltages[i])
        }
      ];
    });

    return {
      firmwareVersion: decodeSwOsString(sys[FIELDS.version]),
      ports
    };
  }
}

function asObject(
  value: unknown,
  file: string
): Record<string, unknown> {
  if (
    value === null ||
    typeof value !== 'object' ||
    Array.isArray(value)
  )
    throw new Error(`unexpected ${file} format`);
  return value as Record<string, unknown>;
}

function arrayOf(value: unknown): unknown[] {
  return Array.isArray(value) ? value : [];
}

function tenths(value: unknown): number | null {
  return typeof value === 'number' ? value / 10 : null;
}
