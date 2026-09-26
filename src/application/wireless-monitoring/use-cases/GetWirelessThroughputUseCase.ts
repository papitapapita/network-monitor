import { Result } from 'domain/shared/core';
import { DeviceId } from 'domain/shared/ids';
import {
  IWirelessSnapshotRepository,
  IWirelessDeviceConfigRepository
} from 'domain/wireless-monitoring/repository';
import { UseCase } from 'application/shared/core';
import { ILogger } from 'application/shared/interfaces';
import { IContractedCapacityProvider } from '../interfaces';
import {
  GetWirelessThroughputRequestDTO,
  WirelessThroughputDTO
} from '../dtos';
import { WirelessThroughputMapper } from '../mappers';

export class GetWirelessThroughputUseCase extends UseCase<
  GetWirelessThroughputRequestDTO,
  WirelessThroughputDTO
> {
  constructor(
    private readonly snapshotRepo: IWirelessSnapshotRepository,
    private readonly configRepo: IWirelessDeviceConfigRepository,
    private readonly contractedCapacity: IContractedCapacityProvider,
    logger: ILogger
  ) {
    super(logger, 'GetWirelessThroughputUseCase');
  }

  protected async beforeExecute(
    request: GetWirelessThroughputRequestDTO
  ): Promise<Result<void> | null> {
    if (!request.deviceId?.trim()) {
      return Result.fail('Device ID is required');
    }
    return null;
  }

  protected async executeImpl(
    request: GetWirelessThroughputRequestDTO
  ): Promise<Result<WirelessThroughputDTO>> {
    const deviceIdResult = DeviceId.parse(request.deviceId);
    if (deviceIdResult.isFailure) {
      return this.fail(`Invalid device ID: ${deviceIdResult.error}`);
    }
    const deviceId = deviceIdResult.value;

    const snapshotResult =
      await this.snapshotRepo.findLatestByDevice(deviceId);
    if (snapshotResult.isFailure) {
      return this.fail(
        `Failed to load wireless throughput: ${snapshotResult.error}`
      );
    }

    const snapshot = snapshotResult.value;
    if (!snapshot) {
      return this.fail('No wireless data found for device');
    }

    // absence is not an error: a snapshot can outlive its configuration, and
    // the mapper reports that as stale with no capacity rather than failing
    const configResult =
      await this.configRepo.findByDeviceId(deviceId);
    if (configResult.isFailure) {
      return this.fail(
        `Failed to load wireless configuration: ${configResult.error}`
      );
    }

    const contractedResult =
      await this.contractedCapacity.findKbpsByDeviceId(deviceId);
    if (contractedResult.isFailure) {
      return this.fail(
        `Failed to load contracted capacity: ${contractedResult.error}`
      );
    }

    return this.ok(
      WirelessThroughputMapper.toDTO(
        snapshot,
        configResult.value,
        contractedResult.value,
        new Date()
      )
    );
  }
}
