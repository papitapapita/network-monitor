import { Vendor } from '../../../domain/device-inventory/aggregates';
import { IVendorRepository } from '../../../domain/device-inventory/repository';
import { Result } from '../../../domain/shared/core';
import { UseCase } from '../../shared/core';
import { ILogger } from '../../shared/interfaces';
import { VendorMapper } from '../mappers';
import { CreateVendorRequestDTO, VendorResponseDTO } from '../dtos';

export class CreateVendorUseCase extends UseCase<
  CreateVendorRequestDTO,
  VendorResponseDTO
> {
  constructor(
    private readonly vendorRepository: IVendorRepository,
    logger: ILogger
  ) {
    super(logger, 'CreateVendorUseCase');
  }

  protected async beforeExecute(
    request: CreateVendorRequestDTO
  ): Promise<Result<void> | null> {
    if (!request.name || request.name.trim().length === 0) {
      return Result.fail('Vendor name is required');
    }
    if (!request.slug || request.slug.trim().length === 0) {
      return Result.fail('Vendor slug is required');
    }
    return null;
  }

  protected async executeImpl(
    request: CreateVendorRequestDTO
  ): Promise<Result<VendorResponseDTO>> {
    const slugExists = await this.vendorRepository.existsBySlug(
      request.slug.trim()
    );
    if (slugExists.isFailure) {
      return this.fail(slugExists.error!);
    }
    if (slugExists.value) {
      return this.fail(
        `A vendor with slug "${request.slug.trim()}" already exists`
      );
    }

    const vendorResult = Vendor.create({
      name: request.name.trim(),
      slug: request.slug.trim(),
      description: request.description ?? null
    });

    if (vendorResult.isFailure) {
      return this.fail(vendorResult.error!);
    }

    const saveResult = await this.vendorRepository.save(vendorResult.value);
    if (saveResult.isFailure) {
      return this.fail(`Failed to persist vendor: ${saveResult.error}`);
    }

    return this.ok(VendorMapper.toDTO(saveResult.value));
  }
}
