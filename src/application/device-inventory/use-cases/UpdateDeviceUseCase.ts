import { IPAddress, MACAddress } from 'domain/shared';
import {
  IDeviceRepository,
  IDeviceModelRepository,
  ILocationRepository
} from 'domain/device-inventory/repository';
import { DeviceOwnerType } from 'domain/device-inventory/enums';
import { DeviceChanges } from 'domain/device-inventory/props';
import {
  LocationId,
  DeviceId,
  DeviceModelId
} from 'domain/shared/ids';
import { IWirelessDeviceConfigRepository } from 'domain/wireless-monitoring/repository';
import { Result } from 'domain/shared/core';
import { UseCase } from 'application/shared/core';
import { ILogger } from 'application/shared/interfaces';
import { parseIso8601Date } from 'application/shared/utils';
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
    private readonly deviceModelRepository: IDeviceModelRepository,
    private readonly locationRepository: ILocationRepository,
    private readonly wirelessConfigRepository: IWirelessDeviceConfigRepository,
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

    if (
      request.deviceModelId !== undefined &&
      request.deviceModelId.trim().length === 0
    ) {
      return Result.fail('deviceModelId cannot be empty');
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

    const updateFields: DeviceChanges = {};

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
        const parsed = parseIso8601Date(data.installedDate);
        if (parsed === null) {
          return this.fail(
            `Invalid installedDate: "${data.installedDate}". Must be a valid ISO 8601 date string.`
          );
        }
        updateFields.installedDate = parsed;
      }
    }

    if (data.category !== undefined) {
      let nextCategory: DeviceCategory | null = null;
      if (data.category !== null) {
        const categoryResult = DeviceCategory.create(data.category);
        if (categoryResult.isFailure) {
          return this.fail(categoryResult.error!);
        }
        nextCategory = categoryResult.value;
      }

      const categoryChanged =
        (device.category?.value ?? null) !==
        (nextCategory?.value ?? null);

      // DEV-064 derives the wireless radio mode from this category once, at
      // config creation, and nothing re-derives it. Moving the category
      // afterwards is refused rather than cascaded: which of linkCapacityKbps
      // / clientsProvisionedLimit is legal flips with the mode, so a cascade
      // would have to silently discard whichever value the operator set.
      if (categoryChanged) {
        const configResult =
          await this.wirelessConfigRepository.findByDeviceId(
            device.id
          );
        if (configResult.isFailure) {
          return this.fail(
            `Failed to check for an existing wireless config: ${configResult.error}`
          );
        }
        if (configResult.value !== null) {
          return this.fail(
            'Cannot change the category of a device that has a wireless config. Delete the wireless config first, then recategorise the device.'
          );
        }
      }

      updateFields.category = nextCategory;
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

    if (data.deviceModelId !== undefined) {
      const deviceModelIdResult = DeviceModelId.parse(
        data.deviceModelId.trim()
      );
      if (deviceModelIdResult.isFailure) {
        return this.fail(
          `Invalid deviceModelId: ${deviceModelIdResult.error}`
        );
      }
      const newDeviceModelId = deviceModelIdResult.value;

      if (!device.deviceModelId.equals(newDeviceModelId)) {
        const modelExistsResult =
          await this.deviceModelRepository.exists(newDeviceModelId);
        if (modelExistsResult.isFailure) {
          return this.fail(
            `Failed to verify device model: ${modelExistsResult.error}`
          );
        }
        if (!modelExistsResult.value) {
          return this.fail(
            `Device model not found: ${data.deviceModelId}`
          );
        }
      }

      updateFields.deviceModelId = newDeviceModelId;
    }

    if (data.status !== undefined) {
      const statusResult = DeviceStatus.create(data.status);
      if (statusResult.isFailure) {
        return this.fail(statusResult.error!);
      }
      updateFields.status = statusResult.value;
    }

    if (data.locationId !== undefined) {
      if (data.locationId === null) {
        updateFields.locationId = null;
      } else {
        const locationIdResult = LocationId.parse(
          data.locationId.trim()
        );
        if (locationIdResult.isFailure) {
          return this.fail(
            `Invalid locationId: ${locationIdResult.error}`
          );
        }
        const newLocationId = locationIdResult.value;

        if (!device.locationId?.equals(newLocationId)) {
          const locationExistsResult =
            await this.locationRepository.exists(newLocationId);
          if (locationExistsResult.isFailure) {
            return this.fail(
              `Failed to verify location: ${locationExistsResult.error}`
            );
          }
          if (!locationExistsResult.value) {
            return this.fail(
              `Location not found: ${data.locationId}`
            );
          }
        }

        updateFields.locationId = newLocationId;
      }
    }

    if (data.monitoringEnabled !== undefined) {
      updateFields.monitoringEnabled = data.monitoringEnabled;
    }

    // One call, one validation of the whole candidate state — so no field in
    // the request can be judged against a half-applied version of the others.
    const applyResult = device.applyChanges(updateFields);
    if (applyResult.isFailure) {
      return this.fail(applyResult.error!);
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
