import {
  Prisma,
  PrismaClient,
  TicketStatus
} from 'generated/prisma/client';
import { Result } from 'domain/shared/core';
import {
  AlertListCriteria,
  AlertListRow,
  IAlertListQuery
} from 'application/notifications/interfaces';
import { AlertTicketRefDTO } from 'application/notifications/dtos';
import { AlertMapper as AlertDTOMapper } from 'application/notifications/mappers';
import { AlertMapper } from '../mappers';

const LIVE_TICKET_STATUSES = [
  TicketStatus.OPEN,
  TicketStatus.ASSIGNED,
  TicketStatus.IN_PROGRESS
];

export class PrismaAlertListQuery implements IAlertListQuery {
  constructor(private readonly prisma: PrismaClient) {}

  public async list(
    criteria: AlertListCriteria
  ): Promise<Result<AlertListRow[]>> {
    try {
      const records = await this.prisma.alertEvent.findMany({
        where: this.buildWhere(criteria),
        include: { device: { select: { name: true } } },
        orderBy: { startedAt: 'desc' },
        take: criteria.limit,
        skip: criteria.offset
      });

      const tickets = await this.liveTicketsByAlert(
        records.map((record) => record.id)
      );

      return Result.ok(
        records.map((record) => ({
          ...AlertDTOMapper.toDTO(AlertMapper.toDomain(record)),
          deviceName: record.device.name,
          ticket: tickets.get(record.id) ?? null
        }))
      );
    } catch (error) {
      return Result.fail(
        `Database error listing alerts: ${(error as Error).message}`
      );
    }
  }

  public async count(
    criteria: Omit<AlertListCriteria, 'limit' | 'offset'>
  ): Promise<Result<number>> {
    try {
      const count = await this.prisma.alertEvent.count({
        where: this.buildWhere(criteria)
      });
      return Result.ok(count);
    } catch (error) {
      return Result.fail(
        `Database error counting alerts: ${(error as Error).message}`
      );
    }
  }

  // One query for the page rather than one per alert. Newest first, so an
  // alert that somehow has two live tickets shows the latest.
  private async liveTicketsByAlert(
    alertIds: string[]
  ): Promise<Map<string, AlertTicketRefDTO>> {
    const byAlert = new Map<string, AlertTicketRefDTO>();
    if (alertIds.length === 0) return byAlert;

    const tickets = await this.prisma.ticket.findMany({
      where: {
        originAlertId: { in: alertIds },
        status: { in: LIVE_TICKET_STATUSES }
      },
      select: {
        id: true,
        code: true,
        status: true,
        originAlertId: true
      },
      orderBy: { createdAt: 'desc' }
    });

    for (const ticket of tickets) {
      if (ticket.originAlertId === null) continue;
      if (byAlert.has(ticket.originAlertId)) continue;
      byAlert.set(ticket.originAlertId, {
        id: ticket.id,
        code: ticket.code,
        status: ticket.status
      });
    }
    return byAlert;
  }

  private buildWhere(
    criteria: Omit<AlertListCriteria, 'limit' | 'offset'>
  ): Prisma.AlertEventWhereInput {
    const where: Prisma.AlertEventWhereInput = {};

    if (criteria.deviceId !== undefined) {
      where.deviceId = criteria.deviceId.toString();
    }

    // An alert is open exactly while it has no resolvedAt — the same test
    // Alert.isOpen applies.
    if (criteria.status === 'OPEN') {
      where.resolvedAt = null;
    } else if (criteria.status === 'RESOLVED') {
      where.resolvedAt = { not: null };
    }

    if (criteria.severity !== undefined) {
      where.severity = criteria.severity;
    }

    return where;
  }
}
