import { VendorId } from 'domain/shared/ids';
import {
  IVendorRepository,
  IDeviceModelRepository
} from 'domain/device-inventory/repository';
import { Result } from 'domain/shared/core';
import { UseCase } from 'application/shared/core';
import { ILogger } from 'application/shared/interfaces';
import { DeleteVendorRequestDTO } from '../dtos';

export class DeleteVendorUseCase extends UseCase<
  DeleteVendorRequestDTO,
  void
> {
  constructor(
    private readonly vendorRepository: IVendorRepository,
    private readonly deviceModelRepository: IDeviceModelRepository,
    logger: ILogger
  ) {
    super(logger, 'DeleteVendorUseCase');
  }

  protected async beforeExecute(
    request: DeleteVendorRequestDTO
  ): Promise<Result<void> | null> {
    if (!request.id || request.id.trim().length === 0) {
      return Result.fail('Vendor ID is required');
    }
    return null;
  }

  protected async executeImpl(
    request: DeleteVendorRequestDTO
  ): Promise<Result<void>> {
    const idResult = VendorId.parse(request.id.trim());
    if (idResult.isFailure) {
      return this.fail(`Invalid vendor ID: ${idResult.error}`);
    }

    const vendorId = idResult.value;

    const findResult = await this.vendorRepository.findById(vendorId);
    if (findResult.isFailure) {
      return this.fail(findResult.error!);
    }
    if (findResult.value === null) {
      return this.fail(`Vendor not found: ${request.id}`);
    }

    // Guard: cannot delete a vendor that has associated device models
    const modelsResult =
      await this.deviceModelRepository.findByVendor(vendorId);
    if (modelsResult.isFailure) {
      return this.fail(modelsResult.error!);
    }
    if (modelsResult.value.length > 0) {
      return this.fail(
        `Cannot delete vendor: it has ${modelsResult.value.length} device model(s) associated. Remove all device models first.`
      );
    }

    const deleteResult = await this.vendorRepository.delete(vendorId);
    if (deleteResult.isFailure) {
      return this.fail(deleteResult.error!);
    }

    return this.ok(undefined);
  }
}
