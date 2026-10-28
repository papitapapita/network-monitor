import { Prisma, PrismaClient } from 'generated/prisma/client';
import { Result } from 'domain/shared/core';
import { DeviceId } from 'domain/shared/ids';
import { RouterSystemState } from 'domain/device-monitoring/aggregates';
import { IRouterSystemStateRepository } from 'domain/device-monitoring/repository';
import { RouterSystemStateMapper } from '../mappers';
import { isForeignKeyViolation } from './prisma-errors';

export class PrismaRouterSystemStateRepository
  implements IRouterSystemStateRepository
{
  constructor(private readonly prisma: PrismaClient) {}

  async listForDevices(
    deviceIds: DeviceId[]
  ): Promise<Result<RouterSystemState[]>> {
    try {
      const records = await this.prisma.routerSystemState.findMany({
        where: {
          deviceId: { in: deviceIds.map((id) => id.toString()) }
        }
      });
      return Result.ok(records.map(RouterSystemStateMapper.toDomain));
    } catch (error) {
      return Result.fail(
        `Database error listing router system states: ${(error as Error).message}`
      );
    }
  }

  async findByDeviceId(
    deviceId: DeviceId
  ): Promise<Result<RouterSystemState | null>> {
    try {
      const record = await this.prisma.routerSystemState.findUnique({
        where: { deviceId: deviceId.toString() }
      });
      return Result.ok(
        record ? RouterSystemStateMapper.toDomain(record) : null
      );
    } catch (error) {
      return Result.fail(
        `Database error finding router system state: ${(error as Error).message}`
      );
    }
  }

  // One row at a time: a router deleted mid-check fails its own insert on the
  // foreign key and is skipped, the others are still saved.
  async saveAll(states: RouterSystemState[]): Promise<Result<void>> {
    try {
      for (const state of states) {
        const record = RouterSystemStateMapper.toPersistence(state);
        const data = {
          ...record,
          security:
            record.security === null
              ? Prisma.DbNull
              : (record.security as Prisma.InputJsonValue)
        };
        await this.prisma.routerSystemState
          .upsert({
            where: { deviceId: data.deviceId },
            create: data,
            update: data
          })
          .catch((error: unknown) => {
            if (!isForeignKeyViolation(error)) throw error;
          });
      }
      return Result.ok();
    } catch (error) {
      return Result.fail(
        `Database error saving router system states: ${(error as Error).message}`
      );
    }
  }
}
