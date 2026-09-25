import { Result } from 'domain/shared/core';
import { DeviceId } from 'domain/shared/ids';
import { MACAddress } from 'domain/shared/value-objects';
import { IWirelessSnapshotRepository } from 'domain/wireless-monitoring';
import { UseCase } from 'application/shared/core';
import { ILogger } from 'application/shared/interfaces';
import { IDeviceRepository } from '../interfaces';
import {
  DeviceIdentitySuggestionDTO,
  DeviceIdentitySuggestionsResponseDTO,
  GetWirelessClientsRequestDTO
} from '../dtos';

function normalizeMac(mac: string): string {
  const result = MACAddress.create(mac);
  return result.isSuccess ? result.value.value : mac.toUpperCase();
}

export class GetDeviceIdentitySuggestionsUseCase extends UseCase<
  GetWirelessClientsRequestDTO,
  DeviceIdentitySuggestionsResponseDTO
> {
  constructor(
    private readonly snapshotRepo: IWirelessSnapshotRepository,
    private readonly deviceRepo: IDeviceRepository,
    logger: ILogger
  ) {
    super(logger, 'GetDeviceIdentitySuggestionsUseCase');
  }

  protected async beforeExecute(
    request: GetWirelessClientsRequestDTO
  ): Promise<Result<void> | null> {
    if (!request.deviceId?.trim()) {
      return Result.fail('Device ID is required');
    }
    return null;
  }

  protected async executeImpl(
    request: GetWirelessClientsRequestDTO
  ): Promise<Result<DeviceIdentitySuggestionsResponseDTO>> {
    const deviceIdResult = DeviceId.parse(request.deviceId);
    if (deviceIdResult.isFailure) {
      return this.fail(`Invalid device ID: ${deviceIdResult.error}`);
    }
    const deviceId = deviceIdResult.value;

    const infoResult = await this.deviceRepo.findBasicInfoById(
      deviceId
    );
    if (infoResult.isFailure) {
      return this.fail(infoResult.error);
    }
    const info = infoResult.value;
    if (!info) {
      return this.fail('Device not found');
    }

    const snapshotResult = await this.snapshotRepo.findLatestByDevice(
      deviceId
    );
    if (snapshotResult.isFailure) {
      return this.fail(
        `Failed to load wireless snapshot: ${snapshotResult.error}`
      );
    }
    const snapshot = snapshotResult.value;

    if (!snapshot) {
      return this.ok({
        deviceId: deviceId.toString(),
        polled: false,
        collectedAt: null,
        suggestions: []
      });
    }

    const suggestions: DeviceIdentitySuggestionDTO[] = [];

    const polledName = snapshot.metrics.deviceName;
    if (
      polledName &&
      polledName.trim().toLowerCase() !== info.name.trim().toLowerCase()
    ) {
      suggestions.push({
        field: 'name',
        currentValue: info.name,
        suggestedValue: polledName.trim()
      });
    }

    const polledMac = snapshot.metrics.macAddress;
    if (polledMac) {
      const normalizedPolledMac = normalizeMac(polledMac);
      const normalizedCurrentMac = info.macAddress
        ? normalizeMac(info.macAddress)
        : null;
      if (normalizedPolledMac !== normalizedCurrentMac) {
        suggestions.push({
          field: 'macAddress',
          currentValue: info.macAddress,
          suggestedValue: normalizedPolledMac
        });
      }
    }

    return this.ok({
      deviceId: deviceId.toString(),
      polled: true,
      collectedAt: snapshot.collectedAt.toISOString(),
      suggestions
    });
  }
}
