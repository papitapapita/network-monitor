import { DeviceModel } from 'domain/device-inventory/aggregates';
import {
  IDeviceModelRepository,
  IVendorRepository
} from 'domain/device-inventory/repository';
import { VendorId } from 'domain/shared/ids';
import { Result } from 'domain/shared/core';
import { UseCase } from 'application/shared/core';
import { ILogger } from 'application/shared/interfaces';
import { DeviceModelMapper } from '../mappers';
import {
  CreateDeviceModelRequestDTO,
  DeviceModelResponseDTO
} from '../dtos';

export class CreateDeviceModelUseCase extends UseCase<
  CreateDeviceModelRequestDTO,
  DeviceModelResponseDTO
> {
  constructor(
    private readonly deviceModelRepository: IDeviceModelRepository,
    private readonly vendorRepository: IVendorRepository,
    logger: ILogger
  ) {
    super(logger, 'CreateDeviceModelUseCase');
  }

  protected async beforeExecute(
    request: CreateDeviceModelRequestDTO
  ): Promise<Result<void> | null> {
    if (!request.vendorId || request.vendorId.trim().length === 0) {
      return Result.fail('Vendor ID is required');
    }
    if (!request.model || request.model.trim().length === 0) {
      return Result.fail('Model name is required');
    }
    if (
      !request.deviceType ||
      request.deviceType.trim().length === 0
    ) {
      return Result.fail('Device type is required');
    }
    return null;
  }

  protected async executeImpl(
    request: CreateDeviceModelRequestDTO
  ): Promise<Result<DeviceModelResponseDTO>> {
    const data = DeviceModelMapper.extractCreateData(request);

    const vendorIdResult = VendorId.parse(data.vendorId.trim());
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
      return this.fail(`Vendor not found: ${data.vendorId}`);
    }

    const vendor = vendorResult.value;
    const modelTrimmed = data.model.trim();

    const existsResult =
      await this.deviceModelRepository.existsByVendorAndModel(
        vendorIdResult.value,
        modelTrimmed
      );
    if (existsResult.isFailure) {
      return this.fail(existsResult.error!);
    }
    if (existsResult.value) {
      return this.fail(
        `A device model "${modelTrimmed}" already exists for this vendor`
      );
    }

    const deviceModelResult = DeviceModel.create({
      vendorId: vendorIdResult.value,
      vendorName: vendor.name,
      vendorSlug: vendor.slug,
      model: modelTrimmed,
      deviceType: data.deviceType.trim(),
      isWireless: data.isWireless
    });

    if (deviceModelResult.isFailure) {
      return this.fail(deviceModelResult.error!);
    }

    const saveResult = await this.deviceModelRepository.save(
      deviceModelResult.value
    );
    if (saveResult.isFailure) {
      return this.fail(
        `Failed to persist device model: ${saveResult.error}`
      );
    }

    return this.ok(DeviceModelMapper.toDTO(saveResult.value));
  }
}
