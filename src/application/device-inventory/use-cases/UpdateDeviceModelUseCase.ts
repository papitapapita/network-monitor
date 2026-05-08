import {
  IDeviceModelRepository,
  IVendorRepository
} from '../../../domain/device-inventory/repository';
import { DeviceModelId, VendorId } from '../../../domain/shared/ids';
import { Result } from '../../../domain/shared/core';
import { UseCase } from '../../shared/core';
import { ILogger } from '../../shared/interfaces';
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

    const findResult = await this.deviceModelRepository.findById(idResult.value);
    if (findResult.isFailure) {
      return this.fail(findResult.error!);
    }
    if (findResult.value === null) {
      return this.fail(`Device model not found: ${request.id}`);
    }

    const deviceModel = findResult.value;

    if (request.vendorId !== undefined) {
      const vendorIdResult = VendorId.parse(request.vendorId.trim());
      if (vendorIdResult.isFailure) {
        return this.fail(`Invalid vendor ID: ${vendorIdResult.error}`);
      }

      const vendorResult = await this.vendorRepository.findById(
        vendorIdResult.value
      );
      if (vendorResult.isFailure) {
        return this.fail(vendorResult.error!);
      }
      if (vendorResult.value === null) {
        return this.fail(`Vendor not found: ${request.vendorId}`);
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

    if (request.model !== undefined) {
      const modelResult = deviceModel.updateModel(request.model);
      if (modelResult.isFailure) {
        return this.fail(modelResult.error!);
      }
    }

    if (request.deviceType !== undefined) {
      const typeResult = deviceModel.updateDeviceType(request.deviceType);
      if (typeResult.isFailure) {
        return this.fail(typeResult.error!);
      }
    }

    const saveResult = await this.deviceModelRepository.save(deviceModel);
    if (saveResult.isFailure) {
      return this.fail(`Failed to persist device model: ${saveResult.error}`);
    }

    return this.ok(DeviceModelMapper.toDTO(saveResult.value));
  }
}
