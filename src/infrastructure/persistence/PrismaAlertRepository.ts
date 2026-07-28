import { PrismaClient, Prisma } from 'generated/prisma/client';
import { Result } from 'domain/shared/core';
import { AlertId, DeviceId } from 'domain/shared/ids';
import { IAlertRepository } from 'domain/notifications/repository';
import { Alert } from 'domain/notifications/aggregates';
import { AlertMapper } from '../mappers';

export class PrismaAlertRepository implements IAlertRepository {
  constructor(private readonly prisma: PrismaClient) {}

  async save(alert: Alert): Promise<Result<Alert>> {
    try {
      const data = AlertMapper.toPersistence(alert);

      await this.prisma.alertEvent.upsert({
        where: { id: data.id },
        update: {
          resolvedAt: data.resolvedAt,
          notifiedAt: data.notifiedAt,
          recoveryNotifiedAt: data.recoveryNotifiedAt
        },
        // Prisma's generated type expects enum literal for severity and a JSON
        // input value for details — casts required from the mapper's plain shape
        create: {
          ...data,
          severity: data.severity as 'WARNING' | 'CRITICAL',
          details: data.details as Prisma.InputJsonValue
        }
      });

      return Result.ok(alert);
    } catch (error) {
      return Result.fail(`Database error saving alert: ${(error as Error).message}`);
    }
  }

  async findById(id: AlertId): Promise<Result<Alert | null>> {
    try {
      const record = await this.prisma.alertEvent.findUnique({
        where: { id: id.toString() }
      });

      if (!record) return Result.ok(null);

      return Result.ok(AlertMapper.toDomain(record));
    } catch (error) {
      return Result.fail(
        `Database error finding alert: ${(error as Error).message}`
      );
    }
  }

  async findOpenByDeviceAndType(
    deviceId: DeviceId,
    type: string
  ): Promise<Result<Alert | null>> {
    try {
      const record = await this.prisma.alertEvent.findFirst({
        where: {
          deviceId: deviceId.toString(),
          type,
          resolvedAt: null
        },
        orderBy: { startedAt: 'desc' }
      });

      if (!record) return Result.ok(null);

      return Result.ok(AlertMapper.toDomain(record));
    } catch (error) {
      return Result.fail(
        `Database error finding open alert: ${(error as Error).message}`
      );
    }
  }

  async deleteById(id: AlertId): Promise<Result<void>> {
    try {
      await this.prisma.alertEvent.delete({
        where: { id: id.toString() }
      });
      return Result.ok();
    } catch (error) {
      return Result.fail(
        `Database error deleting alert: ${(error as Error).message}`
      );
    }
  }

  async findAllByDeviceId(
    deviceId: DeviceId,
    limit = 50,
    offset = 0
  ): Promise<Result<Alert[]>> {
    try {
      const records = await this.prisma.alertEvent.findMany({
        where: { deviceId: deviceId.toString() },
        orderBy: { startedAt: 'desc' },
        take: limit,
        skip: offset
      });

      return Result.ok(records.map(AlertMapper.toDomain));
    } catch (error) {
      return Result.fail(
        `Database error finding alerts by device: ${(error as Error).message}`
      );
    }
  }

  async findAll(limit = 50, offset = 0): Promise<Result<Alert[]>> {
    try {
      const records = await this.prisma.alertEvent.findMany({
        orderBy: { startedAt: 'desc' },
        take: limit,
        skip: offset
      });

      return Result.ok(records.map(AlertMapper.toDomain));
    } catch (error) {
      return Result.fail(
        `Database error finding all alerts: ${(error as Error).message}`
      );
    }
  }

  async deleteResolvedOlderThan(cutoff: Date): Promise<Result<number>> {
    try {
      const { count } = await this.prisma.alertEvent.deleteMany({
        where: { resolvedAt: { not: null, lt: cutoff } }
      });
      return Result.ok(count);
    } catch (error) {
      return Result.fail(
        `deleteResolvedOlderThan failed: ${(error as Error).message}`
      );
    }
  }
}
