import { Prisma, PrismaClient } from 'generated/prisma/client';
import { Result } from 'domain/shared/core';
import {
  AlertListCriteria,
  IAlertListQuery
} from 'application/notifications/interfaces';
import { AlertListItemDTO } from 'application/notifications/dtos';
import { AlertMapper as AlertDTOMapper } from 'application/notifications/mappers';
import { AlertMapper } from '../mappers';

export class PrismaAlertListQuery implements IAlertListQuery {
  constructor(private readonly prisma: PrismaClient) {}

  public async list(
    criteria: AlertListCriteria
  ): Promise<Result<AlertListItemDTO[]>> {
    try {
      const records = await this.prisma.alertEvent.findMany({
        where: this.buildWhere(criteria),
        include: { device: { select: { name: true } } },
        orderBy: { startedAt: 'desc' },
        take: criteria.limit,
        skip: criteria.offset
      });

      return Result.ok(
        records.map((record) => ({
          ...AlertDTOMapper.toDTO(AlertMapper.toDomain(record)),
          deviceName: record.device.name
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
