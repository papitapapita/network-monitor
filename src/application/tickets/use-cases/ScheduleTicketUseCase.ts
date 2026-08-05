import { ITicketRepository } from 'domain/tickets';
import { TicketId } from 'domain/shared/ids';
import { Result } from 'domain/shared/core';
import { UseCase } from 'application/shared/core';
import { ILogger } from 'application/shared/interfaces';
import { TicketMapper } from '../mappers';
import { ScheduleTicketRequestDTO, TicketResponseDTO } from '../dtos';
import { parseCalendarDate } from './calendar-date';

export class ScheduleTicketUseCase extends UseCase<
  ScheduleTicketRequestDTO,
  TicketResponseDTO
> {
  constructor(
    private readonly ticketRepository: ITicketRepository,
    logger: ILogger
  ) {
    super(logger, 'ScheduleTicketUseCase');
  }

  protected async beforeExecute(
    request: ScheduleTicketRequestDTO
  ): Promise<Result<void> | null> {
    if (!request.id || request.id.trim().length === 0) {
      return Result.fail('Ticket ID is required');
    }
    if (request.scheduledFor === undefined) {
      return Result.fail('scheduledFor is required');
    }
    return null;
  }

  protected async executeImpl(
    request: ScheduleTicketRequestDTO
  ): Promise<Result<TicketResponseDTO>> {
    const idResult = TicketId.parse(request.id.trim());
    if (idResult.isFailure) {
      return this.fail(`Invalid ticket ID: ${idResult.error}`);
    }

    let scheduledFor: Date | null = null;
    if (request.scheduledFor !== null) {
      const dateResult = parseCalendarDate(
        request.scheduledFor,
        'scheduledFor'
      );
      if (dateResult.isFailure) {
        return this.fail(dateResult.error!);
      }
      scheduledFor = dateResult.value;
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
    const scheduleResult = ticket.schedule(scheduledFor);
    if (scheduleResult.isFailure) {
      return this.fail(scheduleResult.error!);
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
