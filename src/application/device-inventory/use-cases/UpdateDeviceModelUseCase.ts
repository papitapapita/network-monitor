import {
  IDeviceModelRepository,
  IVendorRepository,
  IDeviceRepository
} from 'domain/device-inventory/repository';
import { IWirelessDeviceConfigRepository } from 'domain/wireless-monitoring/repository';
import { DeviceType } from 'domain/device-inventory/value-objects';
import { DeviceModelId, VendorId } from 'domain/shared/ids';
import { Result } from 'domain/shared/core';
import { UseCase } from 'application/shared/core';
import { ILogger } from 'application/shared/interfaces';
import { DeviceModelMapper } from '../mappers';
import {
  UpdateDeviceModelRequestDTO,
  DeviceModelResponseDTO
} from '../dtos';

export class UpdateDeviceModelUseCase extends UseCase<
  UpdateDeviceModelRequestDTO,
  DeviceModelResponseDTO
> {
  constructor(
    private readonly deviceModelRepository: IDeviceModelRepository,
    private readonly vendorRepository: IVendorRepository,
    private readonly deviceRepository: IDeviceRepository,
    private readonly wirelessConfigRepo: IWirelessDeviceConfigRepository,
    logger: ILogger
  ) {
    super(logger, 'UpdateDeviceModelUseCase');
  }

  protected async beforeExecute(
    request: UpdateDeviceModelRequestDTO
  ): Promise<Result<void> | null> {
    if (!request.id || request.id.trim().length === 0) {
      return Result.fail('Device model ID is required');
    }
    return null;
  }

  protected async executeImpl(
    request: UpdateDeviceModelRequestDTO
  ): Promise<Result<DeviceModelResponseDTO>> {
    const idResult = DeviceModelId.parse(request.id.trim());
    if (idResult.isFailure) {
      return this.fail(`Invalid device model ID: ${idResult.error}`);
    }

    const findResult = await this.deviceModelRepository.findById(
      idResult.value
    );
    if (findResult.isFailure) {
      return this.fail(findResult.error!);
    }
    if (findResult.value === null) {
      return this.fail(`Device model not found: ${request.id}`);
    }

    const deviceModel = findResult.value;
    const data = DeviceModelMapper.extractUpdateData(request);

    let targetVendorId = deviceModel.vendorId;
    let targetVendorName: string | undefined;
    let targetVendorSlug: string | undefined;

    if (data.vendorId !== undefined) {
      const vendorIdResult = VendorId.parse(data.vendorId.trim());
      if (vendorIdResult.isFailure) {
        return this.fail(
          `Invalid vendor ID: ${vendorIdResult.error}`
        );
      }

      const vendorResult = await this.vendorRepository.findById(
        vendorIdResult.value
      );
      if (vendorResult.isFailure) {
        return this.fail(vendorResult.error!);
      }
      if (vendorResult.value === null) {
        return this.fail(`Vendor not found: ${data.vendorId}`);
      }

      targetVendorId = vendorIdResult.value;
      targetVendorName = vendorResult.value.name;
      targetVendorSlug = vendorResult.value.slug;
    }

    const targetModel =
      data.model !== undefined
        ? data.model.trim()
        : deviceModel.model;

    if (data.vendorId !== undefined || data.model !== undefined) {
      const conflictResult =
        await this.deviceModelRepository.findByVendorAndModel(
          targetVendorId,
          targetModel
        );
      if (conflictResult.isFailure) {
        return this.fail(conflictResult.error!);
      }
      if (
        conflictResult.value !== null &&
        !conflictResult.value.id.equals(deviceModel.id)
      ) {
        return this.fail(
          `A device model "${targetModel}" already exists for this vendor`
        );
      }
    }

    if (data.vendorId !== undefined) {
      const updateResult = deviceModel.updateVendor(
        targetVendorId,
        targetVendorName!,
        targetVendorSlug!
      );
      if (updateResult.isFailure) {
        return this.fail(updateResult.error!);
      }
    }

    if (data.model !== undefined) {
      const modelResult = deviceModel.updateModel(data.model);
      if (modelResult.isFailure) {
        return this.fail(modelResult.error!);
      }
    }

    if (data.deviceType !== undefined) {
      const deviceTypeResult = DeviceType.create(data.deviceType);
      if (deviceTypeResult.isFailure) {
        return this.fail(deviceTypeResult.error!);
      }

      const typeResult = deviceModel.updateDeviceType(
        deviceTypeResult.value
      );
      if (typeResult.isFailure) {
        return this.fail(typeResult.error!);
      }
    }

    if (data.isWireless !== undefined) {
      // The configs hold operator-entered values (linkCapacityKbps /
      // clientsProvisionedLimit) that deleting them would discard — the same
      // data DEV-065 refuses to discard one device at a time. So the flag is
      // refused while any of them exists rather than cascading.
      if (deviceModel.isWireless && !data.isWireless) {
        const guardResult = await this.guardAgainstWirelessConfigs(
          deviceModel.id
        );
        if (guardResult.isFailure) {
          return this.fail(guardResult.error);
        }
      }

      const wirelessResult = deviceModel.updateIsWireless(
        data.isWireless
      );
      if (wirelessResult.isFailure) {
        return this.fail(wirelessResult.error!);
      }
    }

    const saveResult =
      await this.deviceModelRepository.save(deviceModel);
    if (saveResult.isFailure) {
      return this.fail(
        `Failed to persist device model: ${saveResult.error}`
      );
    }

    return this.ok(DeviceModelMapper.toDTO(saveResult.value));
  }

  private async guardAgainstWirelessConfigs(
    deviceModelId: DeviceModelId
  ): Promise<Result<void>> {
    const devicesResult =
      await this.deviceRepository.findByDeviceModel(deviceModelId);
    if (devicesResult.isFailure) {
      return Result.fail(
        `Failed to load devices for the wireless config check: ${devicesResult.error}`
      );
    }

    const configResults = await Promise.all(
      devicesResult.value.map((d) =>
        this.wirelessConfigRepo.findByDeviceId(d.id)
      )
    );

    // A lookup that failed is not an absent config: aborting keeps the
    // operation retryable instead of clearing the flag on a partial answer.
    const failure = configResults.find((r) => r.isFailure);
    if (failure !== undefined) {
      return Result.fail(
        `Failed to check for existing wireless configs: ${failure.error}`
      );
    }

    const configured = configResults.filter(
      (r) => r.value !== null
    ).length;
    if (configured > 0) {
      return Result.fail(
        `Cannot mark device model as non-wireless: ${configured} device(s) built on it have a wireless config. Delete those wireless configs first.`
      );
    }

    return Result.ok<void>();
  }
}
