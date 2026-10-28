import { Result } from 'domain/shared/core';
import { IWirelessSnapshotRepository } from 'domain/wireless-monitoring';
import { UseCase } from 'application/shared/core';
import { ILogger } from 'application/shared/interfaces';
import { IDeviceHardwareQuery } from '../interfaces';
import {
  HardwareChangeAssessor,
  ReportedHardware
} from '../services';
import {
  DeviceIdentitySuggestionDTO,
  HardwareChangeDTO,
  HardwareChangesResponseDTO
} from '../dtos';

// A MAC filled in where none was on file is bookkeeping, not a hardware
// change, so on its own it does not list the device (WLS-154).
function isHardwareChange(s: DeviceIdentitySuggestionDTO): boolean {
  return s.field === 'deviceModel' || s.currentValue !== null;
}

export class GetHardwareChangesUseCase extends UseCase<
  void,
  HardwareChangesResponseDTO
> {
  constructor(
    private readonly snapshotRepo: IWirelessSnapshotRepository,
    private readonly hardwareQuery: IDeviceHardwareQuery,
    private readonly hardwareAssessor: HardwareChangeAssessor,
    logger: ILogger
  ) {
    super(logger, 'GetHardwareChangesUseCase');
  }

  protected async executeImpl(): Promise<
    Result<HardwareChangesResponseDTO>
  > {
    const hardwareResult =
      await this.hardwareQuery.findPolledHardware();
    if (hardwareResult.isFailure) {
      return this.fail(hardwareResult.error);
    }

    const snapshotsResult =
      await this.snapshotRepo.findLatestForAllDevices();
    if (snapshotsResult.isFailure) {
      return this.fail(
        `Failed to load wireless snapshots: ${snapshotsResult.error}`
      );
    }
    const snapshots = new Map(
      snapshotsResult.value.map((s) => [s.deviceId.toString(), s])
    );

    const reports: ReportedHardware[] = [];
    for (const hardware of hardwareResult.value) {
      const snapshot = snapshots.get(hardware.deviceId);
      if (!snapshot) continue;
      reports.push({
        hardware,
        macAddress: snapshot.metrics.macAddress,
        deviceModel: snapshot.metrics.deviceModel
      });
    }

    const assessed = await this.hardwareAssessor.assess(reports);
    if (assessed.isFailure) {
      return this.fail(assessed.error);
    }

    const devices: HardwareChangeDTO[] = [];
    for (const { hardware } of reports) {
      const suggestions = assessed.value.get(hardware.deviceId) ?? [];
      if (!suggestions.some(isHardwareChange)) continue;
      devices.push({
        deviceId: hardware.deviceId,
        name: hardware.name,
        collectedAt: snapshots
          .get(hardware.deviceId)!
          .collectedAt.toISOString(),
        suggestions
      });
    }
    devices.sort((a, b) => a.name.localeCompare(b.name));

    return this.ok({ devices });
  }
}
