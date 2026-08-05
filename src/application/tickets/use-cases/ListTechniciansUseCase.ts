import { ITechnicianRepository } from 'domain/tickets';
import { Result } from 'domain/shared/core';
import { UseCase } from 'application/shared/core';
import { ILogger } from 'application/shared/interfaces';
import { TechnicianMapper } from '../mappers';
import {
  ListTechniciansQueryDTO,
  TechnicianListResponseDTO
} from '../dtos';

const DEFAULT_LIMIT = 20;
const MAX_LIMIT = 100;

export class ListTechniciansUseCase extends UseCase<
  ListTechniciansQueryDTO,
  TechnicianListResponseDTO
> {
  constructor(
    private readonly technicianRepository: ITechnicianRepository,
    logger: ILogger
  ) {
    super(logger, 'ListTechniciansUseCase');
  }

  protected async executeImpl(
    request: ListTechniciansQueryDTO
  ): Promise<Result<TechnicianListResponseDTO>> {
    const limit = Math.min(request.limit ?? DEFAULT_LIMIT, MAX_LIMIT);
    const offset = request.offset ?? 0;

    if (limit < 1) {
      return this.fail('limit must be at least 1');
    }
    if (offset < 0) {
      return this.fail('offset cannot be negative');
    }

    const findResult = await this.technicianRepository.findAll(
      request.activeOnly,
      limit,
      offset
    );
    if (findResult.isFailure) {
      return this.fail(findResult.error!);
    }

    const countResult = await this.technicianRepository.count(
      request.activeOnly
    );
    if (countResult.isFailure) {
      return this.fail(countResult.error!);
    }

    return this.ok(
      TechnicianMapper.toListDTO(
        findResult.value,
        countResult.value,
        limit,
        offset
      )
    );
  }
}
