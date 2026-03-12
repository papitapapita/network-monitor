import { PrismaClient } from '../../generated/prisma/client';
import { DeviceModelId } from '../../domain/shared/ids';
import { Result } from '../../domain/shared/core';
import {
  IDeviceModelRepository,
  DeviceModelRecord
} from '../../domain/device-inventory/repository';

export class PrismaDeviceModelRepository
  implements IDeviceModelRepository
{
  constructor(private readonly prisma: PrismaClient) {}

  public async findById(
    id: DeviceModelId
  ): Promise<Result<DeviceModelRecord | null>> {
    try {
      const raw = await this.prisma.deviceModel.findUnique({
        where: { id: id.toString() }
      });

      if (!raw) {
        return Result.ok<DeviceModelRecord | null>(null);
      }

      return Result.ok<DeviceModelRecord | null>({
        id: raw.id,
        manufacturer: raw.manufacturer,
        model: raw.model,
        deviceType: raw.deviceType,
        createdAt: raw.createdAt,
        updatedAt: raw.updatedAt
      });
    } catch (error) {
      const errorMessage =
        error instanceof Error ? error.message : String(error);
      return Result.fail<DeviceModelRecord | null>(
        `Database error finding device model: ${errorMessage}`
      );
    }
  }

  public async findAll(
    limit?: number,
    offset?: number
  ): Promise<Result<DeviceModelRecord[]>> {
    try {
      const rawRecords = await this.prisma.deviceModel.findMany({
        take: limit,
        skip: offset,
        orderBy: [{ manufacturer: 'asc' }, { model: 'asc' }]
      });

      const records: DeviceModelRecord[] = rawRecords.map((raw) => ({
        id: raw.id,
        manufacturer: raw.manufacturer,
        model: raw.model,
        deviceType: raw.deviceType,
        createdAt: raw.createdAt,
        updatedAt: raw.updatedAt
      }));

      return Result.ok<DeviceModelRecord[]>(records);
    } catch (error) {
      const errorMessage =
        error instanceof Error ? error.message : String(error);
      return Result.fail<DeviceModelRecord[]>(
        `Database error finding all device models: ${errorMessage}`
      );
    }
  }

  public async count(): Promise<Result<number>> {
    try {
      const count = await this.prisma.deviceModel.count();
      return Result.ok<number>(count);
    } catch (error) {
      const errorMessage =
        error instanceof Error ? error.message : String(error);
      return Result.fail<number>(
        `Database error counting device models: ${errorMessage}`
      );
    }
  }
}
