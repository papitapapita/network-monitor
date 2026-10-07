import { createHash } from 'crypto';
import { Result } from 'domain/shared/core';
import { DeviceId } from 'domain/shared/ids';
import {
  BackupOutcome,
  BackupTrigger,
  ConfigBackup,
  ConfigNormalizer,
  DeviceBackupState,
  IConfigBackupRepository,
  IDeviceBackupStateRepository
} from 'domain/device-backups';
import {
  BackupCandidate,
  IConfigFetcherResolver
} from '../interfaces';

// BKP-030: enough history to step back a month of daily changes.
export const BACKUP_VERSIONS_KEPT = 30;

export const BACKUP_REFUSALS = {
  NOT_ACCESS_POINT: 'Only access points are backed up for now',
  OUT_OF_REACH:
    'This server cannot reach the device, and backups through an agent are not available yet',
  NO_IP_ADDRESS: 'The device has no IP address',
  NO_CREDENTIALS:
    'No HTTP credentials are configured for this device',
  UNSUPPORTED_VENDOR: 'Backups are not supported for this vendor yet'
} as const;

// BKP-063: refusals that say the feature is not there yet for this device, as
// opposed to a missing IP address or login someone can fix.
const NOT_AVAILABLE_YET: ReadonlySet<string> = new Set([
  BACKUP_REFUSALS.NOT_ACCESS_POINT,
  BACKUP_REFUSALS.OUT_OF_REACH,
  BACKUP_REFUSALS.UNSUPPORTED_VENDOR
]);

export type BackupAttempt =
  | { outcome: BackupOutcome.SAVED; backup: ConfigBackup }
  | { outcome: BackupOutcome.UNCHANGED; backup: ConfigBackup }
  // `refused`: the device was never asked, it cannot be backed up as it is.
  | {
      outcome: BackupOutcome.FAILED;
      error: string;
      refused: boolean;
    };

// Takes one backup of one device and records how it went. Only a storage
// error fails the Result; a device that cannot be read is a FAILED attempt.
export class DeviceConfigBackupService {
  constructor(
    private readonly fetchers: IConfigFetcherResolver,
    private readonly backups: IConfigBackupRepository,
    private readonly states: IDeviceBackupStateRepository
  ) {}

  async backUp(
    candidate: BackupCandidate,
    trigger: BackupTrigger,
    now: Date
  ): Promise<Result<BackupAttempt>> {
    const deviceId = DeviceId.parse(candidate.deviceId);
    if (deviceId.isFailure) return Result.fail(deviceId.error);

    const attempt = await this.attempt(
      deviceId.value,
      candidate,
      trigger,
      now
    );
    if (attempt.isFailure) return attempt;

    const recorded = await this.record(
      deviceId.value,
      candidate.deviceName,
      attempt.value,
      now
    );
    return recorded.isFailure ? Result.fail(recorded.error) : attempt;
  }

  private async attempt(
    deviceId: DeviceId,
    candidate: BackupCandidate,
    trigger: BackupTrigger,
    now: Date
  ): Promise<Result<BackupAttempt>> {
    const refusal = this.refusalFor(candidate);
    if (refusal)
      return Result.ok({
        outcome: BackupOutcome.FAILED,
        error: refusal,
        refused: true
      });

    const fetcher = this.fetchers.forVendor(candidate.vendorSlug!)!;
    const fetched = await fetcher.fetch(
      candidate.ipAddress!,
      candidate.credentials!
    );
    if (fetched.isFailure)
      return Result.ok({
        outcome: BackupOutcome.FAILED,
        error: fetched.error,
        refused: false
      });

    const { format, content } = fetched.value;
    const contentHash = createHash('sha256')
      .update(ConfigNormalizer.normalize(format, content), 'utf8')
      .digest('hex');

    const latest = await this.backups.findLatestByDevice(deviceId);
    if (latest.isFailure) return Result.fail(latest.error);

    if (latest.value?.matches(contentHash)) {
      const confirmed = latest.value.confirmUnchanged(now);
      if (confirmed.isFailure) return Result.fail(confirmed.error);
      const saved = await this.backups.save(latest.value);
      if (saved.isFailure) return Result.fail(saved.error);
      return Result.ok({
        outcome: BackupOutcome.UNCHANGED,
        backup: latest.value
      });
    }

    const created = ConfigBackup.create(
      {
        deviceId,
        format,
        contentHash,
        sizeBytes: Buffer.byteLength(content, 'utf8'),
        trigger,
        takenAt: now
      },
      latest.value
        ? { previous: latest.value, deviceName: candidate.deviceName }
        : undefined
    );
    if (created.isFailure)
      return Result.ok({
        outcome: BackupOutcome.FAILED,
        error: created.error,
        refused: false
      });

    const added = await this.backups.add(created.value, content);
    if (added.isFailure) return Result.fail(added.error);

    const pruned = await this.backups.pruneOldVersions(
      deviceId,
      BACKUP_VERSIONS_KEPT
    );
    if (pruned.isFailure) return Result.fail(pruned.error);

    return Result.ok({
      outcome: BackupOutcome.SAVED,
      backup: created.value
    });
  }

  // BKP-010 … BKP-014, checked before the device is asked anything.
  private refusalFor(candidate: BackupCandidate): string | null {
    if (!candidate.isAccessPoint)
      return BACKUP_REFUSALS.NOT_ACCESS_POINT;
    if (!candidate.reachable) return BACKUP_REFUSALS.OUT_OF_REACH;
    if (!candidate.ipAddress) return BACKUP_REFUSALS.NO_IP_ADDRESS;
    if (!candidate.credentials) return BACKUP_REFUSALS.NO_CREDENTIALS;
    if (
      !candidate.vendorSlug ||
      !this.fetchers.forVendor(candidate.vendorSlug)
    )
      return BACKUP_REFUSALS.UNSUPPORTED_VENDOR;
    return null;
  }

  private async record(
    deviceId: DeviceId,
    deviceName: string,
    attempt: BackupAttempt,
    now: Date
  ): Promise<Result<void>> {
    const found = await this.states.findByDevice(deviceId);
    if (found.isFailure) return Result.fail(found.error);

    let state = found.value;
    if (!state) {
      const created = DeviceBackupState.create(deviceId);
      if (created.isFailure) return Result.fail(created.error);
      state = created.value;
    }

    const applied =
      attempt.outcome === BackupOutcome.FAILED
        ? state.recordFailure(
            attempt.error,
            now,
            deviceName,
            !(attempt.refused && NOT_AVAILABLE_YET.has(attempt.error))
          )
        : state.recordSuccess(attempt.outcome, now);
    if (applied.isFailure) return Result.fail(applied.error);

    return this.states.save(state);
  }
}
