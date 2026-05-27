import { PrismaClient } from '@prisma/client';
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
        create: data
      });

      return Result.ok(alert);
    } catch (error) {
      return Result.fail(`save failed: ${(error as Error).message}`);
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
        `findById failed: ${(error as Error).message}`
      );
    }
  }

  async findOpenByDeviceId(
    deviceId: DeviceId
  ): Promise<Result<Alert | null>> {
    try {
      const record = await this.prisma.alertEvent.findFirst({
        where: { deviceId: deviceId.toString(), resolvedAt: null },
        orderBy: { startedAt: 'desc' }
      });

      if (!record) return Result.ok(null);

      return Result.ok(AlertMapper.toDomain(record));
    } catch (error) {
      return Result.fail(
        `findOpenByDeviceId failed: ${(error as Error).message}`
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
        `findAllByDeviceId failed: ${(error as Error).message}`
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
        `findAll failed: ${(error as Error).message}`
      );
    }
  }
}
