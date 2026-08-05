import { ITicketRepository } from 'domain/tickets';
import { TicketId } from 'domain/shared/ids';
import { Result } from 'domain/shared/core';
import { UseCase } from 'application/shared/core';
import { ILogger } from 'application/shared/interfaces';
import { DeleteTicketRequestDTO } from '../dtos';

/**
 * Hard delete, for tickets raised in error. Cancelling is the normal way to
 * close a ticket that should not be worked — it keeps the record and the reason.
 */
export class DeleteTicketUseCase extends UseCase<
  DeleteTicketRequestDTO,
  void
> {
  constructor(
    private readonly ticketRepository: ITicketRepository,
    logger: ILogger
  ) {
    super(logger, 'DeleteTicketUseCase');
  }

  protected async beforeExecute(
    request: DeleteTicketRequestDTO
  ): Promise<Result<void> | null> {
    if (!request.id || request.id.trim().length === 0) {
      return Result.fail('Ticket ID is required');
    }
    return null;
  }

  protected async executeImpl(
    request: DeleteTicketRequestDTO
  ): Promise<Result<void>> {
    const idResult = TicketId.parse(request.id.trim());
    if (idResult.isFailure) {
      return this.fail(`Invalid ticket ID: ${idResult.error}`);
    }

    const existsResult = await this.ticketRepository.exists(
      idResult.value
    );
    if (existsResult.isFailure) {
      return this.fail(existsResult.error!);
    }
    if (!existsResult.value) {
      return this.fail(`Ticket not found: ${request.id}`);
    }

    const deleteResult = await this.ticketRepository.delete(
      idResult.value
    );
    if (deleteResult.isFailure) {
      return this.fail(deleteResult.error!);
    }

    return this.ok(undefined);
  }
}
