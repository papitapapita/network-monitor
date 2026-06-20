import { Result } from 'domain/shared/core';
import { DeviceId } from 'domain/shared/ids';
import { IPAddress, PollingInterval } from 'domain/shared/value-objects';
import {
  IDeviceRepository,
  IDeviceModelRepository
} from 'domain/device-inventory/repository';
import { WirelessDeviceConfig } from 'domain/wireless-monitoring/aggregates';
import { IWirelessDeviceConfigRepository } from 'domain/wireless-monitoring/repository';
import { UseCase } from 'application/shared/core';
import { ILogger } from 'application/shared/interfaces';
import {
  CreateWirelessConfigRequestDTO,
  WirelessConfigResponseDTO
} from '../dtos';
import { WirelessDeviceConfigMapper } from '../mappers';

export class CreateWirelessConfigUseCase extends UseCase<
  CreateWirelessConfigRequestDTO,
  WirelessConfigResponseDTO
> {
  constructor(
    private readonly deviceRepo: IDeviceRepository,
    private readonly deviceModelRepo: IDeviceModelRepository,
    private readonly configRepo: IWirelessDeviceConfigRepository,
    logger: ILogger
  ) {
    super(logger, 'CreateWirelessConfigUseCase');
  }

  protected async beforeExecute(
    request: CreateWirelessConfigRequestDTO
  ): Promise<Result<void> | null> {
    if (!request.deviceId?.trim()) {
      return Result.fail('Device ID is required');
    }
    if (!request.deviceType?.trim()) {
      return Result.fail('Device type is required');
    }
    return null;
  }

  protected async executeImpl(
    request: CreateWirelessConfigRequestDTO
  ): Promise<Result<WirelessConfigResponseDTO>> {
    const data = WirelessDeviceConfigMapper.extractCreateData(request);

    const deviceIdResult = DeviceId.parse(data.deviceId);
    if (deviceIdResult.isFailure) {
      return this.fail(`Invalid device ID: ${deviceIdResult.error}`);
    }
    const deviceId = deviceIdResult.value;

    const deviceResult = await this.deviceRepo.findById(deviceId);
    if (deviceResult.isFailure) {
      return this.fail(deviceResult.error);
    }
    if (deviceResult.value === null) {
      return this.fail('Device not found');
    }
    const device = deviceResult.value;

    if (!device.canHaveWirelessConfig()) {
      return this.fail(
        'Only WIRELESS_CPE and AP devices can have a wireless config'
      );
    }

    const modelResult = await this.deviceModelRepo.findById(
      device.deviceModelId
    );
    if (modelResult.isFailure) {
      return this.fail(modelResult.error);
    }
    if (modelResult.value === null) {
      return this.fail('Device model not found');
    }
    if (!modelResult.value.isWireless) {
      return this.fail(
        'Device model is not wireless-capable. Mark the device model as wireless before configuring wireless polling.'
      );
    }

    const existingResult =
      await this.configRepo.findByDeviceId(deviceId);
    if (existingResult.isFailure) {
      return this.fail(existingResult.error);
    }
    if (existingResult.value !== null) {
      return this.fail(
        'Wireless config already exists for this device'
      );
    }

    let ipAddress = null;
    if (data.ipAddress != null) {
      const ipResult = IPAddress.create(data.ipAddress);
      if (ipResult.isFailure) {
        return this.fail(`Invalid IP address: ${ipResult.error}`);
      }
      ipAddress = ipResult.value;
    }

    const intervalResult = PollingInterval.create(data.intervalSecs ?? 3600);
    if (intervalResult.isFailure) {
      return this.fail(`Invalid polling interval: ${intervalResult.error}`);
    }

    const configResult = WirelessDeviceConfig.create({
      deviceId,
      ipAddress,
      enabled: data.enabled ?? true,
      pollingInterval: intervalResult.value,
      deviceType: data.deviceType,
      linkCapacityKbps: data.linkCapacityKbps ?? null,
      clientsProvisionedLimit: data.clientsProvisionedLimit ?? null,
      lastPolledAt: null
    });
    if (configResult.isFailure) {
      return this.fail(configResult.error);
    }
    const config = configResult.value;

    const saveResult = await this.configRepo.save(config);
    if (saveResult.isFailure) {
      return this.fail(saveResult.error);
    }

    return this.ok(WirelessDeviceConfigMapper.toDTO(saveResult.value));
  }
}
