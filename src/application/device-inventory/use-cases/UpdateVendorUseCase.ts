import { VendorId } from 'domain/shared/ids';
import { IVendorRepository } from 'domain/device-inventory/repository';
import { Result } from 'domain/shared/core';
import { UseCase } from 'application/shared/core';
import { ILogger } from 'application/shared/interfaces';
import { VendorMapper } from '../mappers';
import { UpdateVendorRequestDTO, VendorResponseDTO } from '../dtos';

export class UpdateVendorUseCase extends UseCase<
  UpdateVendorRequestDTO,
  VendorResponseDTO
> {
  constructor(
    private readonly vendorRepository: IVendorRepository,
    logger: ILogger
  ) {
    super(logger, 'UpdateVendorUseCase');
  }

  protected async beforeExecute(
    request: UpdateVendorRequestDTO
  ): Promise<Result<void> | null> {
    if (!request.id || request.id.trim().length === 0) {
      return Result.fail('Vendor ID is required');
    }
    return null;
  }

  protected async executeImpl(
    request: UpdateVendorRequestDTO
  ): Promise<Result<VendorResponseDTO>> {
    const idResult = VendorId.parse(request.id.trim());
    if (idResult.isFailure) {
      return this.fail(`Invalid vendor ID: ${idResult.error}`);
    }

    const findResult = await this.vendorRepository.findById(
      idResult.value
    );
    if (findResult.isFailure) {
      return this.fail(findResult.error!);
    }
    if (findResult.value === null) {
      return this.fail(`Vendor not found: ${request.id}`);
    }

    const vendor = findResult.value;
    const data = VendorMapper.extractUpdateData(request);

    if (data.slug !== undefined) {
      const newSlug = data.slug.trim();
      const existingResult =
        await this.vendorRepository.findBySlug(newSlug);
      if (existingResult.isFailure) {
        return this.fail(existingResult.error!);
      }
      if (
        existingResult.value !== null &&
        !existingResult.value.id.equals(vendor.id)
      ) {
        return this.fail(
          `A vendor with slug "${newSlug}" already exists`
        );
      }

      const slugResult = vendor.updateSlug(newSlug);
      if (slugResult.isFailure) {
        return this.fail(slugResult.error!);
      }
    }

    if (data.name !== undefined) {
      const nameResult = vendor.updateName(data.name);
      if (nameResult.isFailure) {
        return this.fail(nameResult.error!);
      }
    }

    if (data.description !== undefined) {
      const descResult = vendor.updateDescription(data.description);
      if (descResult.isFailure) {
        return this.fail(descResult.error!);
      }
    }

    const saveResult = await this.vendorRepository.save(vendor);
    if (saveResult.isFailure) {
      return this.fail(
        `Failed to persist vendor: ${saveResult.error}`
      );
    }

    return this.ok(VendorMapper.toDTO(saveResult.value));
  }
}
