import { VendorId } from '../../../domain/shared/ids';
import { IVendorRepository } from '../../../domain/device-inventory/repository';
import { Result } from '../../../domain/shared/core';
import { UseCase } from '../../shared/core';
import { ILogger } from '../../shared/interfaces';
import { VendorMapper } from '../mappers';
import { GetVendorRequestDTO, VendorResponseDTO } from '../dtos';

export class GetVendorUseCase extends UseCase<
  GetVendorRequestDTO,
  VendorResponseDTO
> {
  constructor(
    private readonly vendorRepository: IVendorRepository,
    logger: ILogger
  ) {
    super(logger, 'GetVendorUseCase');
  }

  protected async beforeExecute(
    request: GetVendorRequestDTO
  ): Promise<Result<void> | null> {
    if (!request.id || request.id.trim().length === 0) {
      return Result.fail('Vendor ID is required');
    }
    return null;
  }

  protected async executeImpl(
    request: GetVendorRequestDTO
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

    return this.ok(VendorMapper.toDTO(findResult.value));
  }
}
