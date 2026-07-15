import { IPAddress, MACAddress } from 'domain/shared';
import { IDeviceRepository } from 'domain/device-inventory/repository';
import { DeviceOwnerType } from 'domain/device-inventory/enums';
import { LocationId, DeviceId } from 'domain/shared/ids';
import { Result } from 'domain/shared/core';
import { UseCase } from 'application/shared/core';
import { ILogger } from 'application/shared/interfaces';
import { DeviceResponseDTO, UpdateDeviceRequestDTO } from '../dtos';
import { DeviceMapper } from '../mappers';
import {
  DeviceStatus,
  DeviceCategory,
  DeviceName,
  SerialNumber
} from 'domain/device-inventory/value-objects';

export class UpdateDeviceUseCase extends UseCase<
  UpdateDeviceRequestDTO,
  DeviceResponseDTO
> {
  constructor(
    private readonly deviceRepository: IDeviceRepository,
    logger: ILogger
  ) {
    super(logger, 'UpdateDeviceUseCase');
  }

  protected async beforeExecute(
    request: UpdateDeviceRequestDTO
  ): Promise<Result<void> | null> {
    if (!request.id || request.id.trim().length === 0) {
      return Result.fail('Device ID is required');
    }

    if (request.ownerType !== undefined) {
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

    if (request.status !== undefined) {
      const statusResult = DeviceStatus.create(request.status);
      if (statusResult.isFailure) {
        return Result.fail(statusResult.error!);
      }
    }

    if (request.category !== undefined && request.category !== null) {
      const categoryResult = DeviceCategory.create(request.category);
      if (categoryResult.isFailure) {
        return Result.fail(categoryResult.error!);
      }
    }

    return null;
  }

  protected async executeImpl(
    request: UpdateDeviceRequestDTO
  ): Promise<Result<DeviceResponseDTO>> {
    const deviceIdResult = DeviceId.parse(request.id.trim());
    if (deviceIdResult.isFailure) {
      return this.fail(`Invalid device ID: ${deviceIdResult.error}`);
    }

    const findResult = await this.deviceRepository.findById(
      deviceIdResult.value
    );
    if (findResult.isFailure) {
      return this.fail(findResult.error!);
    }
    if (findResult.value === null) {
      return this.fail(`Device not found: ${request.id}`);
    }

    const device = findResult.value;
    const data = DeviceMapper.extractUpdateData(request);

    const updateFields: Parameters<typeof device.updateDetails>[0] =
      {};

    if (data.name !== undefined) {
      const nameResult = DeviceName.create(data.name);
      if (nameResult.isFailure) {
        return this.fail(nameResult.error!);
      }
      updateFields.name = nameResult.value;
    }

    if (data.description !== undefined) {
      updateFields.description = data.description;
    }

    if (data.ownerType !== undefined) {
      updateFields.ownerType =
        data.ownerType.toUpperCase() as DeviceOwnerType;
    }

    if (data.installedDate !== undefined) {
      if (data.installedDate === null) {
        updateFields.installedDate = null;
      } else {
        const parsed = new Date(data.installedDate);
        if (isNaN(parsed.getTime())) {
          return this.fail(
            `Invalid installedDate: "${data.installedDate}". Must be a valid ISO 8601 date string.`
          );
        }
        updateFields.installedDate = parsed;
      }
    }

    if (data.category !== undefined) {
      if (data.category === null) {
        updateFields.category = null;
      } else {
        const categoryResult = DeviceCategory.create(data.category);
        if (categoryResult.isFailure) {
          return this.fail(categoryResult.error!);
        }
        updateFields.category = categoryResult.value;
      }
    }

    if (data.serialNumber !== undefined) {
      if (data.serialNumber === null) {
        updateFields.serialNumber = null;
      } else {
        const serialNumberResult = SerialNumber.create(
          data.serialNumber
        );
        if (serialNumberResult.isFailure) {
          return this.fail(serialNumberResult.error!);
        }
        updateFields.serialNumber = serialNumberResult.value;
      }
    }

    if (data.macAddress !== undefined) {
      if (data.macAddress === null) {
        updateFields.macAddress = null;
      } else {
        const macResult = MACAddress.create(data.macAddress);
        if (macResult.isFailure) {
          return this.fail(macResult.error!);
        }
        const newMac = macResult.value;

        const currentMac = device.macAddress?.value ?? null;
        if (currentMac !== newMac.value) {
          const macExistsResult =
            await this.deviceRepository.existsByMacAddress(newMac);
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

        updateFields.macAddress = newMac;
      }
    }

    if (data.ipAddress !== undefined) {
      if (data.ipAddress === null) {
        updateFields.ipAddress = null;
      } else {
        const ipResult = IPAddress.create(data.ipAddress);
        if (ipResult.isFailure) {
          return this.fail(ipResult.error!);
        }
        const newIp = ipResult.value;

        const currentIp = device.ipAddress?.value ?? null;
        if (currentIp !== newIp.value) {
          const ipExistsResult =
            await this.deviceRepository.existsByIpAddress(newIp);
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

        updateFields.ipAddress = newIp;
      }
    }

    // updateDetails must run before changeStatus so that an IP set in the same
    // request is already present on the aggregate when the status transition
    // (e.g. INVENTORY → ACTIVE) is validated by the domain.
    if (Object.keys(updateFields).length > 0) {
      const updateResult = device.updateDetails(updateFields);
      if (updateResult.isFailure) {
        return this.fail(updateResult.error!);
      }
    }

    // A disable must be applied before changeStatus validates, since that validation
    // reads the aggregate's current (not-yet-updated) monitoringEnabled — otherwise
    // turning monitoring off while moving to a non-monitorable status in the same
    // request would be rejected as if monitoring were still on.
    if (data.monitoringEnabled === false) {
      const disableResult = device.disableMonitoring();
      if (disableResult.isFailure) {
        return this.fail(disableResult.error!);
      }
    }

    if (data.status !== undefined) {
      const statusResult = DeviceStatus.create(data.status);
      if (statusResult.isFailure) {
        return this.fail(statusResult.error!);
      }
      const changeStatusResult = device.changeStatus(
        statusResult.value
      );
      if (changeStatusResult.isFailure) {
        return this.fail(changeStatusResult.error!);
      }
    }

    if (data.locationId !== undefined) {
      let newLocationId: LocationId | null = null;
      if (data.locationId !== null) {
        const locationIdResult = LocationId.parse(
          data.locationId.trim()
        );
        if (locationIdResult.isFailure) {
          return this.fail(
            `Invalid locationId: ${locationIdResult.error}`
          );
        }
        newLocationId = locationIdResult.value;
      }
      const assignResult = device.assignLocation(newLocationId);
      if (assignResult.isFailure) {
        return this.fail(assignResult.error!);
      }
    }

    if (data.monitoringEnabled === true) {
      const enableResult = device.enableMonitoring();
      if (enableResult.isFailure) {
        return this.fail(enableResult.error!);
      }
    }

    const saveResult = await this.deviceRepository.save(device);
    if (saveResult.isFailure) {
      return this.fail(
        `Failed to persist device: ${saveResult.error}`
      );
    }

    return this.ok(DeviceMapper.toDTO(saveResult.value));
  }
}
