import { ITechnicianRepository } from 'domain/tickets';
import { TechnicianId } from 'domain/shared/ids';
import { Result } from 'domain/shared/core';
import { UseCase } from 'application/shared/core';
import { ILogger } from 'application/shared/interfaces';
import { TechnicianMapper } from '../mappers';
import {
  GetTechnicianRequestDTO,
  TechnicianResponseDTO
} from '../dtos';

export class GetTechnicianUseCase extends UseCase<
  GetTechnicianRequestDTO,
  TechnicianResponseDTO
> {
  constructor(
    private readonly technicianRepository: ITechnicianRepository,
    logger: ILogger
  ) {
    super(logger, 'GetTechnicianUseCase');
  }

  protected async beforeExecute(
    request: GetTechnicianRequestDTO
  ): Promise<Result<void> | null> {
    if (!request.id || request.id.trim().length === 0) {
      return Result.fail('Technician ID is required');
    }
    return null;
  }

  protected async executeImpl(
    request: GetTechnicianRequestDTO
  ): Promise<Result<TechnicianResponseDTO>> {
    const idResult = TechnicianId.parse(request.id.trim());
    if (idResult.isFailure) {
      return this.fail(`Invalid technician ID: ${idResult.error}`);
    }

    const findResult = await this.technicianRepository.findById(
      idResult.value
    );
    if (findResult.isFailure) {
      return this.fail(findResult.error!);
    }
    if (findResult.value === null) {
      return this.fail(`Technician not found: ${request.id}`);
    }

    return this.ok(TechnicianMapper.toDTO(findResult.value));
  }
}
