import {
  ITechnicianRepository,
  ITicketRepository
} from 'domain/tickets';
import { TechnicianId } from 'domain/shared/ids';
import { Result } from 'domain/shared/core';
import { UseCase } from 'application/shared/core';
import { ILogger } from 'application/shared/interfaces';
import { DeleteTechnicianRequestDTO } from '../dtos';

export class DeleteTechnicianUseCase extends UseCase<
  DeleteTechnicianRequestDTO,
  void
> {
  constructor(
    private readonly technicianRepository: ITechnicianRepository,
    private readonly ticketRepository: ITicketRepository,
    logger: ILogger
  ) {
    super(logger, 'DeleteTechnicianUseCase');
  }

  protected async beforeExecute(
    request: DeleteTechnicianRequestDTO
  ): Promise<Result<void> | null> {
    if (!request.id || request.id.trim().length === 0) {
      return Result.fail('Technician ID is required');
    }
    return null;
  }

  protected async executeImpl(
    request: DeleteTechnicianRequestDTO
  ): Promise<Result<void>> {
    const idResult = TechnicianId.parse(request.id.trim());
    if (idResult.isFailure) {
      return this.fail(`Invalid technician ID: ${idResult.error}`);
    }

    const existsResult = await this.technicianRepository.exists(
      idResult.value
    );
    if (existsResult.isFailure) {
      return this.fail(existsResult.error!);
    }
    if (!existsResult.value) {
      return this.fail(`Technician not found: ${request.id}`);
    }

    // Deleting would blank the technician on every ticket they ever worked,
    // erasing who did what. Deactivate instead to take them off the rota.
    const countResult = await this.ticketRepository.countByTechnician(
      idResult.value
    );
    if (countResult.isFailure) {
      return this.fail(countResult.error!);
    }
    if (countResult.value > 0) {
      return this.fail(
        `Cannot delete a technician with ${countResult.value} ticket(s); deactivate them instead`
      );
    }

    const deleteResult = await this.technicianRepository.delete(
      idResult.value
    );
    if (deleteResult.isFailure) {
      return this.fail(deleteResult.error!);
    }

    return this.ok(undefined);
  }
}
