import {
  PrismaClient,
  Prisma,
  TicketStatus as PrismaTicketStatus,
  TicketPriority as PrismaTicketPriority,
  TicketCategory as PrismaTicketCategory,
  TicketOrigin as PrismaTicketOrigin
} from 'generated/prisma/client';
import {
  Ticket,
  ITicketRepository,
  TicketFilter,
  TicketStatus
} from 'domain/tickets';
import { TechnicianId, TicketId } from 'domain/shared/ids';
import { Result, EventDispatcher } from 'domain/shared/core';
import { TicketMapper } from '../mappers';
import {
  isRecordNotFound,
  isForeignKeyViolation
} from '../../persistence/prisma-errors';

const NON_TERMINAL_STATUSES = [
  TicketStatus.OPEN,
  TicketStatus.ASSIGNED,
  TicketStatus.IN_PROGRESS
] as PrismaTicketStatus[];

// `scheduled_for` is a DATE column, so Prisma hands back and expects UTC
// midnight. Normalising here keeps "today" a calendar day rather than a
// 24-hour window that drifts with the caller's clock.
function toDateOnly(date: Date): Date {
  return new Date(
    Date.UTC(
      date.getUTCFullYear(),
      date.getUTCMonth(),
      date.getUTCDate()
    )
  );
}

export class PrismaTicketRepository implements ITicketRepository {
  constructor(private readonly prisma: PrismaClient) {}

  public async save(ticket: Ticket): Promise<Result<Ticket>> {
    try {
      const data = TicketMapper.toPersistence(ticket);

      // The row is read back rather than returning the in-memory aggregate:
      // `code` is assigned by the database sequence and is only known here.
      const saved = await this.prisma.ticket.upsert({
        where: { id: data.id },
        create: data,
        update: PrismaTicketRepository.toUpdateData(data)
      });

      EventDispatcher.dispatchEventsForAggregate(ticket.id);

      const domainResult = TicketMapper.toDomain(saved);
      if (domainResult.isFailure) {
        return Result.fail<Ticket>(
          `Failed to map ticket: ${domainResult.error}`
        );
      }

      return Result.ok<Ticket>(domainResult.value);
    } catch (error) {
      const errorMessage =
        error instanceof Error ? error.message : String(error);

      if (isForeignKeyViolation(error)) {
        return Result.fail<Ticket>(
          'The referenced customer, device or technician does not exist'
        );
      }

      return Result.fail<Ticket>(
        `Database error saving ticket: ${errorMessage}`
      );
    }
  }

  public async findById(
    id: TicketId
  ): Promise<Result<Ticket | null>> {
    try {
      const raw = await this.prisma.ticket.findUnique({
        where: { id: id.toString() }
      });

      if (!raw) return Result.ok<Ticket | null>(null);

      const domainResult = TicketMapper.toDomain(raw);
      if (domainResult.isFailure) {
        return Result.fail<Ticket | null>(
          `Failed to map ticket: ${domainResult.error}`
        );
      }

      return Result.ok<Ticket | null>(domainResult.value);
    } catch (error) {
      const errorMessage =
        error instanceof Error ? error.message : String(error);
      return Result.fail<Ticket | null>(
        `Database error finding ticket: ${errorMessage}`
      );
    }
  }

  public async findByCode(
    code: number
  ): Promise<Result<Ticket | null>> {
    try {
      const raw = await this.prisma.ticket.findUnique({
        where: { code }
      });

      if (!raw) return Result.ok<Ticket | null>(null);

      const domainResult = TicketMapper.toDomain(raw);
      if (domainResult.isFailure) {
        return Result.fail<Ticket | null>(
          `Failed to map ticket: ${domainResult.error}`
        );
      }

      return Result.ok<Ticket | null>(domainResult.value);
    } catch (error) {
      const errorMessage =
        error instanceof Error ? error.message : String(error);
      return Result.fail<Ticket | null>(
        `Database error finding ticket by code: ${errorMessage}`
      );
    }
  }

  public async findAll(
    filter: TicketFilter,
    limit?: number,
    offset?: number
  ): Promise<Result<Ticket[]>> {
    try {
      const rawRecords = await this.prisma.ticket.findMany({
        where: PrismaTicketRepository.buildWhere(filter),
        take: limit,
        skip: offset,
        orderBy: [
          { scheduledFor: 'asc' },
          { priority: 'desc' },
          { createdAt: 'desc' }
        ]
      });

      return PrismaTicketRepository.mapMany(rawRecords);
    } catch (error) {
      const errorMessage =
        error instanceof Error ? error.message : String(error);
      return Result.fail<Ticket[]>(
        `Database error finding tickets: ${errorMessage}`
      );
    }
  }

  public async countAll(
    filter: TicketFilter
  ): Promise<Result<number>> {
    try {
      const count = await this.prisma.ticket.count({
        where: PrismaTicketRepository.buildWhere(filter)
      });
      return Result.ok<number>(count);
    } catch (error) {
      const errorMessage =
        error instanceof Error ? error.message : String(error);
      return Result.fail<number>(
        `Database error counting tickets: ${errorMessage}`
      );
    }
  }

  public async findForTechnicianOnDate(
    technicianId: TechnicianId,
    date: Date
  ): Promise<Result<Ticket[]>> {
    try {
      const rawRecords = await this.prisma.ticket.findMany({
        where: {
          technicianId: technicianId.toString(),
          scheduledFor: toDateOnly(date),
          status: { in: NON_TERMINAL_STATUSES }
        },
        orderBy: [{ priority: 'desc' }, { createdAt: 'asc' }]
      });

      return PrismaTicketRepository.mapMany(rawRecords);
    } catch (error) {
      const errorMessage =
        error instanceof Error ? error.message : String(error);
      return Result.fail<Ticket[]>(
        `Database error finding technician day sheet: ${errorMessage}`
      );
    }
  }

  public async findActiveByOrigin(
    origin: string,
    alertId: string
  ): Promise<Result<Ticket | null>> {
    try {
      const raw = await this.prisma.ticket.findFirst({
        where: {
          origin: origin as PrismaTicketOrigin,
          originAlertId: alertId,
          status: { in: NON_TERMINAL_STATUSES }
        },
        orderBy: { createdAt: 'desc' }
      });

      if (!raw) return Result.ok<Ticket | null>(null);

      const domainResult = TicketMapper.toDomain(raw);
      if (domainResult.isFailure) {
        return Result.fail<Ticket | null>(
          `Failed to map ticket: ${domainResult.error}`
        );
      }

      return Result.ok<Ticket | null>(domainResult.value);
    } catch (error) {
      const errorMessage =
        error instanceof Error ? error.message : String(error);
      return Result.fail<Ticket | null>(
        `Database error finding ticket by origin: ${errorMessage}`
      );
    }
  }

  public async findActiveAlertTicketForDevice(
    deviceId: string
  ): Promise<Result<Ticket | null>> {
    try {
      const raw = await this.prisma.ticket.findFirst({
        where: {
          deviceId,
          origin: {
            in: [
              PrismaTicketOrigin.DEVICE_ALERT,
              PrismaTicketOrigin.WIRELESS_ALERT
            ]
          },
          status: { in: NON_TERMINAL_STATUSES }
        },
        orderBy: { createdAt: 'desc' }
      });

      if (!raw) return Result.ok<Ticket | null>(null);

      const domainResult = TicketMapper.toDomain(raw);
      if (domainResult.isFailure) {
        return Result.fail<Ticket | null>(
          `Failed to map ticket: ${domainResult.error}`
        );
      }

      return Result.ok<Ticket | null>(domainResult.value);
    } catch (error) {
      const errorMessage =
        error instanceof Error ? error.message : String(error);
      return Result.fail<Ticket | null>(
        `Database error finding active alert ticket for device: ${errorMessage}`
      );
    }
  }

  public async countByTechnician(
    id: TechnicianId
  ): Promise<Result<number>> {
    try {
      const count = await this.prisma.ticket.count({
        where: { technicianId: id.toString() }
      });
      return Result.ok<number>(count);
    } catch (error) {
      const errorMessage =
        error instanceof Error ? error.message : String(error);
      return Result.fail<number>(
        `Database error counting technician tickets: ${errorMessage}`
      );
    }
  }

  public async delete(id: TicketId): Promise<Result<void>> {
    try {
      await this.prisma.ticket.delete({
        where: { id: id.toString() }
      });

      return Result.ok<void>();
    } catch (error) {
      const errorMessage =
        error instanceof Error ? error.message : String(error);

      if (isRecordNotFound(error)) {
        return Result.fail<void>('Ticket not found');
      }

      return Result.fail<void>(
        `Database error deleting ticket: ${errorMessage}`
      );
    }
  }

  public async exists(id: TicketId): Promise<Result<boolean>> {
    try {
      const count = await this.prisma.ticket.count({
        where: { id: id.toString() }
      });
      return Result.ok<boolean>(count > 0);
    } catch (error) {
      const errorMessage =
        error instanceof Error ? error.message : String(error);
      return Result.fail<boolean>(
        `Database error checking ticket existence: ${errorMessage}`
      );
    }
  }

  // `id` is the match key and `createdAt` belongs to the insert; every other
  // column is replaced wholesale on update.
  private static toUpdateData(
    data: ReturnType<typeof TicketMapper.toPersistence>
  ) {
    const update: Partial<typeof data> = { ...data };
    delete update.id;
    delete update.createdAt;
    return update;
  }

  private static mapMany(
    rawRecords: Parameters<typeof TicketMapper.toDomain>[0][]
  ): Result<Ticket[]> {
    const tickets: Ticket[] = [];
    for (const raw of rawRecords) {
      const domainResult = TicketMapper.toDomain(raw);
      if (domainResult.isFailure) {
        return Result.fail<Ticket[]>(
          `Failed to map ticket: ${domainResult.error}`
        );
      }
      tickets.push(domainResult.value);
    }
    return Result.ok<Ticket[]>(tickets);
  }

  private static buildWhere(
    filter: TicketFilter
  ): Prisma.TicketWhereInput {
    const where: Prisma.TicketWhereInput = {};

    if (filter.status !== undefined) {
      where.status = filter.status as PrismaTicketStatus;
    }
    if (filter.priority !== undefined) {
      where.priority = filter.priority as PrismaTicketPriority;
    }
    if (filter.category !== undefined) {
      where.category = filter.category as PrismaTicketCategory;
    }
    if (filter.customerId !== undefined) {
      where.customerId = filter.customerId;
    }
    if (filter.deviceId !== undefined) {
      where.deviceId = filter.deviceId;
    }
    if (filter.unassignedOnly === true) {
      where.technicianId = null;
    } else if (filter.technicianId !== undefined) {
      where.technicianId = filter.technicianId;
    }
    if (filter.openOnly === true) {
      where.status = { in: NON_TERMINAL_STATUSES };
    }
    if (
      filter.scheduledFrom !== undefined ||
      filter.scheduledTo !== undefined
    ) {
      where.scheduledFor = {};
      if (filter.scheduledFrom !== undefined) {
        where.scheduledFor.gte = toDateOnly(filter.scheduledFrom);
      }
      if (filter.scheduledTo !== undefined) {
        where.scheduledFor.lte = toDateOnly(filter.scheduledTo);
      }
    }

    return where;
  }
}
