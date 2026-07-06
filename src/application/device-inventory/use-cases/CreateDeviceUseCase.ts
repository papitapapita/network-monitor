import { IPAddress, MACAddress } from 'domain/shared/value-objects';
import { DeviceModelId, LocationId } from 'domain/shared/ids';
import { Result } from 'domain/shared/core';
import { Device } from 'domain/device-inventory/aggregates';
import { IDeviceRepository } from 'domain/device-inventory/repository';
import { DeviceOwnerType } from 'domain/device-inventory/enums';
import { UseCase } from 'application/shared/core';
import { ILogger } from 'application/shared/interfaces';
import { CreateDeviceRequestDTO, DeviceResponseDTO } from '../dtos';
import { DeviceMapper } from '../mappers';
import {
  DeviceStatus,
  DeviceCategory,
  SerialNumber,
  DeviceName
} from 'domain/device-inventory/value-objects';

export class CreateDeviceUseCase extends UseCase<
  CreateDeviceRequestDTO,
  DeviceResponseDTO
> {
  constructor(
    private readonly deviceRepository: IDeviceRepository,
    logger: ILogger
  ) {
    super(logger, 'CreateDeviceUseCase');
  }

  protected async beforeExecute(
    request: CreateDeviceRequestDTO
  ): Promise<Result<void> | null> {
    if (
      !request.deviceModelId ||
      request.deviceModelId.trim().length === 0
    ) {
      return Result.fail('deviceModelId is required');
    }

    if (!request.name || request.name.trim().length === 0) {
      return Result.fail('Device name is required');
    }

    if (request.ownerType) {
      const validOwnerTypes = Object.values(
        DeviceOwnerType
      ) as string[];
      if (
        !validOwnerTypes.includes(request.ownerType.toUpperCase())
      ) {
        return Result.fail(
          `Invalid ownerType: "${request.ownerType}". Must be one of: ${validOwnerTypes.join(', ')}`
        );
      }
    }

    if (request.status) {
      const statusResult = DeviceStatus.create(request.status);
      if (statusResult.isFailure) {
        return Result.fail(statusResult.error!);
      }
    }

    if (request.category) {
      const categoryResult = DeviceCategory.create(request.category);
      if (categoryResult.isFailure) {
        return Result.fail(categoryResult.error!);
      }
    }

    return null;
  }

  protected async executeImpl(
    request: CreateDeviceRequestDTO
  ): Promise<Result<DeviceResponseDTO>> {
    const data = DeviceMapper.extractCreateData(request);

    const deviceModelIdResult = DeviceModelId.parse(
      data.deviceModelId.trim()
    );
    if (deviceModelIdResult.isFailure) {
      return this.fail(
        `Invalid deviceModelId: ${deviceModelIdResult.error}`
      );
    }

    let locationId: LocationId | null = null;
    if (data.locationId) {
      const locationIdResult = LocationId.parse(data.locationId.trim());
      if (locationIdResult.isFailure) {
        return this.fail(
          `Invalid locationId: ${locationIdResult.error}`
        );
      }
      locationId = locationIdResult.value;
    }

    const nameResult = DeviceName.create(data.name);
    if (nameResult.isFailure) {
      return this.fail(nameResult.error!);
    }

    const statusResult = DeviceStatus.create(
      data.status ?? DeviceStatus.INVENTORY
    );
    if (statusResult.isFailure) {
      return this.fail(statusResult.error!);
    }

    let category: DeviceCategory | null = null;
    if (data.category) {
      const categoryResult = DeviceCategory.create(data.category);
      if (categoryResult.isFailure) {
        return this.fail(categoryResult.error!);
      }
      category = categoryResult.value;
    }

    let serialNumber: SerialNumber | null = null;
    if (data.serialNumber) {
      const serialNumberResult = SerialNumber.create(data.serialNumber);
      if (serialNumberResult.isFailure) {
        return this.fail(serialNumberResult.error!);
      }
      serialNumber = serialNumberResult.value;
    }

    let macAddress: MACAddress | null = null;
    if (data.macAddress) {
      const macResult = MACAddress.create(data.macAddress);
      if (macResult.isFailure) {
        return this.fail(macResult.error!);
      }
      macAddress = macResult.value;

      const macExistsResult =
        await this.deviceRepository.existsByMacAddress(macAddress);
      if (macExistsResult.isFailure) {
        return this.fail(
          `Failed to check MAC address uniqueness: ${macExistsResult.error}`
        );
      }
      if (macExistsResult.value) {
        return this.fail(
          `MAC address "${data.macAddress}" is already assigned to another device`
        );
      }
    }

    let ipAddress: IPAddress | null = null;
    if (data.ipAddress) {
      const ipResult = IPAddress.create(data.ipAddress);
      if (ipResult.isFailure) {
        return this.fail(ipResult.error!);
      }
      ipAddress = ipResult.value;

      const ipExistsResult =
        await this.deviceRepository.existsByIpAddress(ipAddress);
      if (ipExistsResult.isFailure) {
        return this.fail(
          `Failed to check IP address uniqueness: ${ipExistsResult.error}`
        );
      }
      if (ipExistsResult.value) {
        return this.fail(
          `IP address "${data.ipAddress}" is already assigned to another device`
        );
      }
    }

    let installedDate: Date | null = null;
    if (data.installedDate) {
      const parsed = new Date(data.installedDate);
      if (isNaN(parsed.getTime())) {
        return this.fail(
          `Invalid installedDate: "${data.installedDate}". Must be a valid ISO 8601 date string.`
        );
      }
      installedDate = parsed;
    }

    const deviceResult = Device.create({
      deviceModelId: deviceModelIdResult.value,
      locationId,
      name: nameResult.value,
      status: statusResult.value,
      category,
      ownerType: data.ownerType
        ? (data.ownerType.toUpperCase() as DeviceOwnerType)
        : null,
      serialNumber,
      macAddress,
      ipAddress,
      description: data.description,
      installedDate,
      monitoringEnabled: data.monitoringEnabled
    });

    if (deviceResult.isFailure) {
      return this.fail(deviceResult.error!);
    }

    const device = deviceResult.value;

    const saveResult = await this.deviceRepository.save(device);
    if (saveResult.isFailure) {
      return this.fail(
        `Failed to persist device: ${saveResult.error}`
      );
    }

    return this.ok(DeviceMapper.toDTO(saveResult.value));
  }
}
