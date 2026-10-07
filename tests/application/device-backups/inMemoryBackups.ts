import { Result } from '../../../src/domain/shared/core/Result';
import {
  ConfigBackupId,
  DeviceId
} from '../../../src/domain/shared/ids';
import {
  BackupFormat,
  ConfigBackup,
  DeviceBackupState,
  IConfigBackupRepository,
  IDeviceBackupStateRepository
} from '../../../src/domain/device-backups';
import {
  BackupCandidate,
  BackupCredentials,
  FetchedConfig,
  IConfigFetcher,
  IConfigFetcherResolver
} from '../../../src/application/device-backups/interfaces';
import { ILogger } from '../../../src/application/shared/interfaces/ILogger';

export const AIROS_CONFIG =
  'aaa.status=enabled\nradio.1.mode=master\n';

export class InMemoryConfigBackupRepository
  implements IConfigBackupRepository
{
  readonly rows: { backup: ConfigBackup; content: string }[] = [];
  failWith: string | null = null;

  async add(backup: ConfigBackup, content: string) {
    if (this.failWith) return Result.fail<void>(this.failWith);
    this.rows.push({ backup, content });
    return Result.ok<void>();
  }

  async save() {
    if (this.failWith) return Result.fail<void>(this.failWith);
    return Result.ok<void>();
  }

  async findById(id: ConfigBackupId) {
    const row = this.rows.find((r) => r.backup.id.equals(id));
    return Result.ok(row?.backup ?? null);
  }

  async findLatestByDevice(deviceId: DeviceId) {
    return Result.ok(this.forDevice(deviceId)[0]?.backup ?? null);
  }

  async listByDevice(deviceId: DeviceId) {
    return Result.ok(this.forDevice(deviceId).map((r) => r.backup));
  }

  async findContent(id: ConfigBackupId) {
    const row = this.rows.find((r) => r.backup.id.equals(id));
    return Result.ok(row?.content ?? null);
  }

  async pruneOldVersions(deviceId: DeviceId, keep: number) {
    const stale = this.forDevice(deviceId).slice(keep);
    for (const row of stale)
      this.rows.splice(this.rows.indexOf(row), 1);
    return Result.ok(stale.length);
  }

  private forDevice(deviceId: DeviceId) {
    return this.rows
      .filter((r) => r.backup.deviceId.equals(deviceId))
      .sort(
        (a, b) =>
          b.backup.takenAt.getTime() - a.backup.takenAt.getTime()
      );
  }
}

export class InMemoryDeviceBackupStateRepository
  implements IDeviceBackupStateRepository
{
  readonly states = new Map<string, DeviceBackupState>();

  async findByDevice(deviceId: DeviceId) {
    return Result.ok(this.states.get(deviceId.toString()) ?? null);
  }

  async save(state: DeviceBackupState) {
    this.states.set(state.deviceId.toString(), state);
    return Result.ok<void>();
  }
}

export class FakeFetcher
  implements IConfigFetcher, IConfigFetcherResolver
{
  readonly calls: string[] = [];
  private result: Result<FetchedConfig> = Result.ok({
    format: BackupFormat.AIROS_CFG,
    content: AIROS_CONFIG
  });

  serve(content: string): void {
    this.result = Result.ok({
      format: BackupFormat.AIROS_CFG,
      content
    });
  }

  fail(error: string): void {
    this.result = Result.fail(error);
  }

  forVendor(vendorSlug: string): IConfigFetcher | null {
    return vendorSlug === 'ubiquiti' ? this : null;
  }

  async fetch(ipAddress: string, _credentials: BackupCredentials) {
    this.calls.push(ipAddress);
    return this.result;
  }
}

export function makeCandidate(
  overrides: Partial<BackupCandidate> = {}
): BackupCandidate {
  return {
    deviceId: DeviceId.create().toString(),
    deviceName: 'AP Torre Norte',
    ipAddress: '10.0.0.10',
    vendorSlug: 'ubiquiti',
    isAccessPoint: true,
    reachable: true,
    credentials: { username: 'ubnt', password: 'secret', port: 443 },
    ...overrides
  };
}

export function makeLogger(): jest.Mocked<ILogger> {
  const logger: jest.Mocked<ILogger> = {
    debug: jest.fn(),
    info: jest.fn(),
    warn: jest.fn(),
    error: jest.fn(),
    fatal: jest.fn(),
    setLevel: jest.fn(),
    child: jest.fn()
  };
  logger.child.mockReturnValue(logger);
  return logger;
}
