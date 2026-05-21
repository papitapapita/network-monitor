import { IVendorRepository } from '../../../domain/device-inventory/repository';
import { Result } from '../../../domain/shared/core';
import { UseCase } from '../../shared/core';
import { ILogger } from '../../shared/interfaces';
import { VendorMapper } from '../mappers';
import { ListVendorsQueryDTO, VendorListResponseDTO } from '../dtos';

export class ListVendorsUseCase extends UseCase<
  ListVendorsQueryDTO,
  VendorListResponseDTO
> {
  private static readonly DEFAULT_LIMIT = 20;
  private static readonly MAX_LIMIT = 100;

  constructor(
    private readonly vendorRepository: IVendorRepository,
    logger: ILogger
  ) {
    super(logger, 'ListVendorsUseCase');
  }

  protected async executeImpl(
    request: ListVendorsQueryDTO
  ): Promise<Result<VendorListResponseDTO>> {
    const limit = Math.min(
      request.limit ?? ListVendorsUseCase.DEFAULT_LIMIT,
      ListVendorsUseCase.MAX_LIMIT
    );
    const offset = request.offset ?? 0;

    const vendorsResult = await this.vendorRepository.findAll(
      limit,
      offset
    );
    if (vendorsResult.isFailure) {
      return this.fail(vendorsResult.error!);
    }

    const countResult = await this.vendorRepository.count();
    if (countResult.isFailure) {
      return this.fail(countResult.error!);
    }

    return this.ok(
      VendorMapper.toListDTO(
        vendorsResult.value,
        countResult.value,
        limit,
        offset
      )
    );
  }
}
