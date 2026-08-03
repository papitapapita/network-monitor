import { Result } from 'domain/shared/core';
import { DeviceId } from 'domain/shared/ids';
import {
  IPollingConfigurationRepository,
  IDeviceStateRepository
} from 'domain/device-monitoring/repository';
import { ResolveAlertUseCase } from 'application/notifications/use-cases';

const AVAILABILITY_ALERT_TYPE = 'device_unreachable';

export class SuspendDeviceMonitoringUseCase {
  constructor(
    private readonly pollingConfigRepo: IPollingConfigurationRepository,
    private readonly deviceStateRepo: IDeviceStateRepository,
    private readonly resolveAlert: ResolveAlertUseCase
  ) {}

  // The write order stands in for a transaction, which no repository here
  // supports. Disabling the configuration LAST means a failure part way through
  // leaves polling on: the next cycle overwrites the UNKNOWN state and reopens
  // the alert if the device really is down, so the system converges back to
  // "monitoring on" rather than stranding a state nothing can ever repair.
  // Idempotent, so re-running after a partial failure finishes the job.
  public async execute(deviceId: DeviceId): Promise<Result<void>> {
    const now = new Date();

    const stateResult =
      await this.deviceStateRepo.findByDeviceId(deviceId);
    if (stateResult.isFailure) {
      return Result.fail<void>(
        `Failed to load device state: ${stateResult.error}`
      );
    }

    // No row means the device has never been polled. Seeding one here would
    // invent an observation that never happened.
    const state = stateResult.value;
    if (state) {
      state.markUnknown(now);
      const stateSaveResult = await this.deviceStateRepo.save(state);
      if (stateSaveResult.isFailure) {
        return Result.fail<void>(
          `Failed to save device state: ${stateSaveResult.error}`
        );
      }
    }

    // No poll will run again to observe a recovery, so an open availability
    // alert would stay open forever — and PurgeOldAlertsUseCase only reaps
    // resolved ones, making the row immortal. Closed without notifying: a
    // resolution notice for a device we merely stopped watching reads as good
    // news that never happened.
    const resolveResult = await this.resolveAlert.execute({
      deviceId: deviceId.toString(),
      type: AVAILABILITY_ALERT_TYPE,
      resolvedAt: now
    });
    if (resolveResult.isFailure) {
      return Result.fail<void>(
        `Failed to resolve open alert: ${resolveResult.error}`
      );
    }

    const configResult =
      await this.pollingConfigRepo.findByDeviceId(deviceId);
    if (configResult.isFailure) {
      return Result.fail<void>(
        `Failed to load polling configuration: ${configResult.error}`
      );
    }

    const config = configResult.value;
    if (!config || !config.enabled) {
      return Result.ok<void>();
    }

    config.disable();
    const configSaveResult =
      await this.pollingConfigRepo.save(config);
    if (configSaveResult.isFailure) {
      return Result.fail<void>(
        `Failed to disable polling: ${configSaveResult.error}`
      );
    }

    return Result.ok<void>();
  }
}
