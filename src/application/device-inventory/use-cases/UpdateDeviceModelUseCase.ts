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
    const wasWireless = deviceModel.isWireless;
    const data = DeviceModelMapper.extractUpdateData(request);

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

      const updateResult = deviceModel.updateVendor(
        vendorIdResult.value,
        vendorResult.value.name,
        vendorResult.value.slug
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
      const wirelessResult = deviceModel.updateIsWireless(
        data.isWireless
      );
      if (wirelessResult.isFailure) {
        return this.fail(wirelessResult.error!);
      }
    }

    // The cascade runs before the flag is persisted: it only ever fires on the
    // true → false edge, so a failure after the save would leave configs no
    // later update could reach.
    if (wasWireless && data.isWireless === false) {
      const cascadeResult = await this.removeWirelessConfigs(
        deviceModel.id
      );
      if (cascadeResult.isFailure) {
        return this.fail(cascadeResult.error);
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

  private async removeWirelessConfigs(
    deviceModelId: DeviceModelId
  ): Promise<Result<void>> {
    const devicesResult =
      await this.deviceRepository.findByDeviceModel(deviceModelId);
    if (devicesResult.isFailure) {
      return Result.fail(
        `Failed to load devices for wireless config cleanup: ${devicesResult.error}`
      );
    }

    const deleteResults = await Promise.all(
      devicesResult.value.map((d) =>
        this.wirelessConfigRepo.delete(d.id)
      )
    );

    const failure = deleteResults.find((r) => r.isFailure);
    if (failure !== undefined) {
      return Result.fail(
        `Failed to remove wireless config: ${failure.error}`
      );
    }

    return Result.ok<void>();
  }
}
