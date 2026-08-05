import {
  Ticket,
  ITicketRepository,
  ITechnicianRepository
} from 'domain/tickets';
import { TechnicianId } from 'domain/shared/ids';
import { Result } from 'domain/shared/core';
import { UseCase } from 'application/shared/core';
import { ILogger } from 'application/shared/interfaces';
import { TicketMapper, TechnicianMapper } from '../mappers';
import {
  GetTechnicianDayQueryDTO,
  TechnicianDayResponseDTO,
  TicketDetailResponseDTO,
  TicketCustomerContactDTO,
  TicketDeviceSummaryDTO,
  TechnicianSummaryDTO
} from '../dtos';
import { ICustomerDirectory, IDeviceDirectory } from '../interfaces';
import { parseCalendarDate, startOfUtcDay } from './calendar-date';

/**
 * The technician's day sheet: today's tasks, in the order they should be
 * worked, each carrying the contact details, the suspected failure and the
 * related device.
 */
export class GetTechnicianDayUseCase extends UseCase<
  GetTechnicianDayQueryDTO,
  TechnicianDayResponseDTO
> {
  constructor(
    private readonly ticketRepository: ITicketRepository,
    private readonly technicianRepository: ITechnicianRepository,
    private readonly customerDirectory: ICustomerDirectory,
    private readonly deviceDirectory: IDeviceDirectory,
    logger: ILogger
  ) {
    super(logger, 'GetTechnicianDayUseCase');
  }

  protected async beforeExecute(
    request: GetTechnicianDayQueryDTO
  ): Promise<Result<void> | null> {
    if (
      !request.technicianId ||
      request.technicianId.trim().length === 0
    ) {
      return Result.fail('Technician ID is required');
    }
    return null;
  }

  protected async executeImpl(
    request: GetTechnicianDayQueryDTO
  ): Promise<Result<TechnicianDayResponseDTO>> {
    const idResult = TechnicianId.parse(request.technicianId.trim());
    if (idResult.isFailure) {
      return this.fail(`Invalid technician ID: ${idResult.error}`);
    }

    let date: Date;
    if (request.date !== undefined && request.date !== null) {
      const dateResult = parseCalendarDate(request.date, 'date');
      if (dateResult.isFailure) {
        return this.fail(dateResult.error!);
      }
      date = dateResult.value;
    } else {
      date = startOfUtcDay(new Date());
    }

    const technicianResult = await this.technicianRepository.findById(
      idResult.value
    );
    if (technicianResult.isFailure) {
      return this.fail(technicianResult.error!);
    }
    if (technicianResult.value === null) {
      return this.fail(
        `Technician not found: ${request.technicianId}`
      );
    }

    const ticketsResult =
      await this.ticketRepository.findForTechnicianOnDate(
        idResult.value,
        date
      );
    if (ticketsResult.isFailure) {
      return this.fail(ticketsResult.error!);
    }

    // Most urgent first, then oldest first within a priority — the order the
    // technician should work the day in.
    const ordered = [...ticketsResult.value].sort((a, b) => {
      const byPriority = a.priority.rank - b.priority.rank;
      if (byPriority !== 0) return byPriority;
      return a.createdAt.getTime() - b.createdAt.getTime();
    });

    const details: TicketDetailResponseDTO[] = [];
    for (const ticket of ordered) {
      const enrichedResult = await this.enrich(
        ticket,
        TechnicianMapper.toSummaryDTO(technicianResult.value)
      );
      if (enrichedResult.isFailure) {
        return this.fail(enrichedResult.error!);
      }
      details.push(enrichedResult.value);
    }

    return this.ok({
      technician: TechnicianMapper.toSummaryDTO(
        technicianResult.value
      ),
      date: date.toISOString().slice(0, 10),
      tickets: details,
      total: details.length
    });
  }

  private async enrich(
    ticket: Ticket,
    technician: TechnicianSummaryDTO
  ): Promise<Result<TicketDetailResponseDTO>> {
    let customer: TicketCustomerContactDTO | null = null;
    if (ticket.customerId !== null) {
      const result = await this.customerDirectory.findContact(
        ticket.customerId.toString()
      );
      if (result.isFailure) {
        return Result.fail(result.error!);
      }
      customer = result.value;
    }

    let device: TicketDeviceSummaryDTO | null = null;
    if (ticket.deviceId !== null) {
      const result = await this.deviceDirectory.findSummary(
        ticket.deviceId.toString()
      );
      if (result.isFailure) {
        return Result.fail(result.error!);
      }
      device = result.value;
    }

    return Result.ok(
      TicketMapper.toDetailDTO(ticket, customer, device, technician)
    );
  }
}
