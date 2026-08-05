import { ITicketRepository, TicketFilter } from 'domain/tickets';
import { Result } from 'domain/shared/core';
import { UseCase } from 'application/shared/core';
import { ILogger } from 'application/shared/interfaces';
import { TicketMapper } from '../mappers';
import { ListTicketsQueryDTO, TicketListResponseDTO } from '../dtos';
import { parseCalendarDate } from './calendar-date';

const DEFAULT_LIMIT = 20;
const MAX_LIMIT = 100;

export class ListTicketsUseCase extends UseCase<
  ListTicketsQueryDTO,
  TicketListResponseDTO
> {
  constructor(
    private readonly ticketRepository: ITicketRepository,
    logger: ILogger
  ) {
    super(logger, 'ListTicketsUseCase');
  }

  protected async executeImpl(
    request: ListTicketsQueryDTO
  ): Promise<Result<TicketListResponseDTO>> {
    const limit = Math.min(request.limit ?? DEFAULT_LIMIT, MAX_LIMIT);
    const offset = request.offset ?? 0;

    if (limit < 1) {
      return this.fail('limit must be at least 1');
    }
    if (offset < 0) {
      return this.fail('offset cannot be negative');
    }

    const filterResult = this.buildFilter(request);
    if (filterResult.isFailure) {
      return this.fail(filterResult.error!);
    }

    const findResult = await this.ticketRepository.findAll(
      filterResult.value,
      limit,
      offset
    );
    if (findResult.isFailure) {
      return this.fail(findResult.error!);
    }

    const countResult = await this.ticketRepository.countAll(
      filterResult.value
    );
    if (countResult.isFailure) {
      return this.fail(countResult.error!);
    }

    return this.ok(
      TicketMapper.toListDTO(
        findResult.value,
        countResult.value,
        limit,
        offset
      )
    );
  }

  private buildFilter(
    request: ListTicketsQueryDTO
  ): Result<TicketFilter> {
    const filter: TicketFilter = {};

    if (request.status !== undefined) {
      filter.status = request.status.trim().toUpperCase();
    }
    if (request.priority !== undefined) {
      filter.priority = request.priority.trim().toUpperCase();
    }
    if (request.category !== undefined) {
      filter.category = request.category.trim().toUpperCase();
    }
    if (request.technicianId !== undefined) {
      filter.technicianId = request.technicianId;
    }
    if (request.customerId !== undefined) {
      filter.customerId = request.customerId;
    }
    if (request.deviceId !== undefined) {
      filter.deviceId = request.deviceId;
    }
    if (request.unassignedOnly !== undefined) {
      filter.unassignedOnly = request.unassignedOnly;
    }
    if (request.openOnly !== undefined) {
      filter.openOnly = request.openOnly;
    }

    if (request.scheduledFrom !== undefined) {
      const result = parseCalendarDate(
        request.scheduledFrom,
        'scheduledFrom'
      );
      if (result.isFailure) return Result.fail(result.error);
      filter.scheduledFrom = result.value;
    }

    if (request.scheduledTo !== undefined) {
      const result = parseCalendarDate(
        request.scheduledTo,
        'scheduledTo'
      );
      if (result.isFailure) return Result.fail(result.error);
      filter.scheduledTo = result.value;
    }

    if (
      filter.scheduledFrom !== undefined &&
      filter.scheduledTo !== undefined &&
      filter.scheduledFrom > filter.scheduledTo
    ) {
      return Result.fail(
        'scheduledFrom cannot be later than scheduledTo'
      );
    }

    return Result.ok(filter);
  }
}
