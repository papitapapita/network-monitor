import { Result } from 'domain/shared/core';
import {
  IWirelessSnapshotRepository,
  IWirelessDeviceConfigRepository
} from 'domain/wireless-monitoring/repository';
import { WirelessDeviceConfig } from 'domain/wireless-monitoring/aggregates';
import { UseCase } from 'application/shared/core';
import { ILogger } from 'application/shared/interfaces';
import { FleetWirelessThroughputResponseDTO } from '../dtos';
import { WirelessThroughputMapper } from '../mappers';

/**
 * Fleet-wide live throughput: the newest snapshot per device, joined to its
 * configured link capacity. Devices that have never been polled are absent —
 * there is no reading to report, and a row of nulls would read as idle.
 */
export class GetFleetWirelessThroughputUseCase extends UseCase<
  void,
  FleetWirelessThroughputResponseDTO
> {
  constructor(
    private readonly snapshotRepo: IWirelessSnapshotRepository,
    private readonly configRepo: IWirelessDeviceConfigRepository,
    logger: ILogger
  ) {
    super(logger, 'GetFleetWirelessThroughputUseCase');
  }

  protected async executeImpl(): Promise<
    Result<FleetWirelessThroughputResponseDTO>
  > {
    const snapshotsResult =
      await this.snapshotRepo.findLatestForAllDevices();
    if (snapshotsResult.isFailure) {
      return this.fail(
        `Failed to load fleet throughput: ${snapshotsResult.error}`
      );
    }

    const configsResult = await this.configRepo.findAll();
    if (configsResult.isFailure) {
      return this.fail(
        `Failed to load wireless configurations: ${configsResult.error}`
      );
    }

    const configsByDevice = new Map<string, WirelessDeviceConfig>(
      configsResult.value.map((c) => [c.deviceId.toString(), c])
    );

    const now = new Date();
    const devices = snapshotsResult.value.map((snapshot) =>
      WirelessThroughputMapper.toDTO(
        snapshot,
        configsByDevice.get(snapshot.deviceId.toString()) ?? null,
        now
      )
    );

    return this.ok({ devices, total: devices.length });
  }
}
