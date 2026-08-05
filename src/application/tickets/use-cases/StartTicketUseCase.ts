import { ITicketRepository } from 'domain/tickets';
import { TicketId } from 'domain/shared/ids';
import { Result } from 'domain/shared/core';
import { UseCase } from 'application/shared/core';
import { ILogger } from 'application/shared/interfaces';
import { TicketMapper } from '../mappers';
import { StartTicketRequestDTO, TicketResponseDTO } from '../dtos';

export class StartTicketUseCase extends UseCase<
  StartTicketRequestDTO,
  TicketResponseDTO
> {
  constructor(
    private readonly ticketRepository: ITicketRepository,
    logger: ILogger
  ) {
    super(logger, 'StartTicketUseCase');
  }

  protected async beforeExecute(
    request: StartTicketRequestDTO
  ): Promise<Result<void> | null> {
    if (!request.id || request.id.trim().length === 0) {
      return Result.fail('Ticket ID is required');
    }
    return null;
  }

  protected async executeImpl(
    request: StartTicketRequestDTO
  ): Promise<Result<TicketResponseDTO>> {
    const idResult = TicketId.parse(request.id.trim());
    if (idResult.isFailure) {
      return this.fail(`Invalid ticket ID: ${idResult.error}`);
    }

    const findResult = await this.ticketRepository.findById(
      idResult.value
    );
    if (findResult.isFailure) {
      return this.fail(findResult.error!);
    }
    if (findResult.value === null) {
      return this.fail(`Ticket not found: ${request.id}`);
    }

    const ticket = findResult.value;
    const startResult = ticket.start();
    if (startResult.isFailure) {
      return this.fail(startResult.error!);
    }

    const saveResult = await this.ticketRepository.save(ticket);
    if (saveResult.isFailure) {
      return this.fail(
        `Failed to persist ticket: ${saveResult.error}`
      );
    }

    return this.ok(TicketMapper.toDTO(saveResult.value));
  }
}
