import {
  ITicketRepository,
  ITechnicianRepository
} from 'domain/tickets';
import { TechnicianId, TicketId } from 'domain/shared/ids';
import { Result } from 'domain/shared/core';
import { UseCase } from 'application/shared/core';
import { ILogger } from 'application/shared/interfaces';
import { TicketMapper } from '../mappers';
import { AssignTicketRequestDTO, TicketResponseDTO } from '../dtos';
import { parseCalendarDate } from './calendar-date';

export class AssignTicketUseCase extends UseCase<
  AssignTicketRequestDTO,
  TicketResponseDTO
> {
  constructor(
    private readonly ticketRepository: ITicketRepository,
    private readonly technicianRepository: ITechnicianRepository,
    logger: ILogger
  ) {
    super(logger, 'AssignTicketUseCase');
  }

  protected async beforeExecute(
    request: AssignTicketRequestDTO
  ): Promise<Result<void> | null> {
    if (!request.id || request.id.trim().length === 0) {
      return Result.fail('Ticket ID is required');
    }
    if (
      !request.technicianId ||
      request.technicianId.trim().length === 0
    ) {
      return Result.fail('Technician ID is required');
    }
    return null;
  }

  protected async executeImpl(
    request: AssignTicketRequestDTO
  ): Promise<Result<TicketResponseDTO>> {
    const ticketIdResult = TicketId.parse(request.id.trim());
    if (ticketIdResult.isFailure) {
      return this.fail(`Invalid ticket ID: ${ticketIdResult.error}`);
    }

    const technicianIdResult = TechnicianId.parse(
      request.technicianId.trim()
    );
    if (technicianIdResult.isFailure) {
      return this.fail(
        `Invalid technician ID: ${technicianIdResult.error}`
      );
    }

    let scheduledFor: Date | null = null;
    if (
      request.scheduledFor !== undefined &&
      request.scheduledFor !== null
    ) {
      const dateResult = parseCalendarDate(
        request.scheduledFor,
        'scheduledFor'
      );
      if (dateResult.isFailure) {
        return this.fail(dateResult.error!);
      }
      scheduledFor = dateResult.value;
    }

    const ticketResult = await this.ticketRepository.findById(
      ticketIdResult.value
    );
    if (ticketResult.isFailure) {
      return this.fail(ticketResult.error!);
    }
    if (ticketResult.value === null) {
      return this.fail(`Ticket not found: ${request.id}`);
    }

    const technicianResult = await this.technicianRepository.findById(
      technicianIdResult.value
    );
    if (technicianResult.isFailure) {
      return this.fail(technicianResult.error!);
    }
    if (technicianResult.value === null) {
      return this.fail(
        `Technician not found: ${request.technicianId}`
      );
    }

    // A deactivated technician has left the rota; dispatching to them would
    // produce a job nobody is going to do.
    if (!technicianResult.value.isActive) {
      return this.fail(
        'Cannot assign a ticket to an inactive technician'
      );
    }

    const ticket = ticketResult.value;
    const assignResult = ticket.assign(
      technicianIdResult.value,
      scheduledFor
    );
    if (assignResult.isFailure) {
      return this.fail(assignResult.error!);
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
