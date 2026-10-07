import { AggregateRoot, Result, Guard } from 'domain/shared/core';
import { ConfigBackupId } from 'domain/shared/ids';
import { BackupFormat, BackupTrigger } from '../enums';
import { ConfigBackupProps } from '../props';
import { DeviceConfigChangedEvent } from '../events';

export const MAX_CONFIG_BYTES = 1_000_000;
const SHA256_HEX = /^[0-9a-f]{64}$/;

// One saved version of a device's configuration. The file itself is kept by
// the repository beside this record, so listing versions reads no secrets.
export class ConfigBackup extends AggregateRoot<
  ConfigBackupProps,
  ConfigBackupId
> {
  private constructor(props: ConfigBackupProps, id: ConfigBackupId) {
    super(props, id);
  }

  get deviceId() {
    return this.props.deviceId;
  }

  get format(): BackupFormat {
    return this.props.format;
  }

  get contentHash(): string {
    return this.props.contentHash;
  }

  get sizeBytes(): number {
    return this.props.sizeBytes;
  }

  get trigger(): BackupTrigger {
    return this.props.trigger;
  }

  get takenAt(): Date {
    return this.props.takenAt;
  }

  get lastCheckedAt(): Date {
    return this.props.lastCheckedAt;
  }

  // `replacing`: the device's latest version before this one, if any.
  public static create(
    props: Omit<ConfigBackupProps, 'lastCheckedAt'>,
    replacing?: { previous: ConfigBackup; deviceName: string }
  ): Result<ConfigBackup> {
    const candidate: ConfigBackupProps = {
      ...props,
      lastCheckedAt: props.takenAt
    };
    const validation = ConfigBackup.validate(candidate);
    if (validation.isFailure) return Result.fail(validation.error);
    if (
      replacing &&
      !replacing.previous.deviceId.equals(candidate.deviceId)
    )
      return Result.fail(
        'A backup can only replace a version of the same device'
      );

    const backup = new ConfigBackup(
      candidate,
      ConfigBackupId.create()
    );
    // BKP-060: someone changed the device since the last nightly check. A
    // version taken on demand is the user's own doing and says nothing.
    if (replacing && candidate.trigger === BackupTrigger.SCHEDULED)
      backup.addDomainEvent(
        new DeviceConfigChangedEvent({
          aggregateId: backup.id,
          deviceId: candidate.deviceId,
          deviceName: replacing.deviceName,
          previousBackupId: replacing.previous.id,
          previousCheckedAt: replacing.previous.lastCheckedAt,
          dateTimeOccurred: candidate.takenAt
        })
      );
    return Result.ok(backup);
  }

  // bypasses validation — for repository use only
  public static reconstitute(
    id: ConfigBackupId,
    props: ConfigBackupProps
  ): ConfigBackup {
    return new ConfigBackup(props, id);
  }

  public matches(contentHash: string): boolean {
    return this.props.contentHash === contentHash;
  }

  // The device still holds this configuration (BKP-006).
  public confirmUnchanged(at: Date): Result<void> {
    if (at.getTime() <= this.props.lastCheckedAt.getTime())
      return Result.ok();
    const validation = ConfigBackup.validate({
      ...this.props,
      lastCheckedAt: at
    });
    if (validation.isFailure) return Result.fail(validation.error);
    this.props.lastCheckedAt = at;
    return Result.ok();
  }

  private static validate(props: ConfigBackupProps): Result<void> {
    const guard = Guard.combine([
      Guard.againstNullOrUndefined(props.deviceId, 'deviceId'),
      Guard.againstNullOrUndefined(props.format, 'format'),
      Guard.againstNullOrUndefined(props.trigger, 'trigger'),
      Guard.againstNullOrUndefined(props.takenAt, 'takenAt'),
      Guard.againstNullOrUndefined(
        props.lastCheckedAt,
        'lastCheckedAt'
      )
    ]);
    if (!guard.succeeded) return Result.fail(guard.message!);

    if (!Object.values(BackupFormat).includes(props.format))
      return Result.fail(`Unknown backup format: ${props.format}`);
    if (!Object.values(BackupTrigger).includes(props.trigger))
      return Result.fail(`Unknown backup trigger: ${props.trigger}`);
    if (!SHA256_HEX.test(props.contentHash ?? ''))
      return Result.fail(
        'Backup content hash must be a SHA-256 hex digest'
      );
    if (!Number.isInteger(props.sizeBytes) || props.sizeBytes < 1)
      return Result.fail('A configuration backup cannot be empty');
    if (props.sizeBytes > MAX_CONFIG_BYTES)
      return Result.fail(
        `A configuration backup cannot exceed ${MAX_CONFIG_BYTES} bytes`
      );
    if (props.lastCheckedAt.getTime() < props.takenAt.getTime())
      return Result.fail(
        'A backup cannot be checked before it was taken'
      );
    return Result.ok();
  }
}
