import { PrismaClient } from 'generated/prisma/client';
import { DeviceModel } from 'domain/device-inventory/aggregates';
import { DeviceModelId, VendorId } from 'domain/shared/ids';
import { Result, EventDispatcher } from 'domain/shared/core';
import { IDeviceModelRepository } from 'domain/device-inventory/repository';
import { DeviceModelMapper } from '../mappers';

export class PrismaDeviceModelRepository
  implements IDeviceModelRepository
{
  constructor(private readonly prisma: PrismaClient) {}

  public async save(
    deviceModel: DeviceModel
  ): Promise<Result<DeviceModel>> {
    try {
      const data = DeviceModelMapper.toPersistence(deviceModel);

      await this.prisma.deviceModel.upsert({
        where: { id: data.id },
        create: data,
        update: {
          vendorId: data.vendorId,
          model: data.model,
          deviceType: data.deviceType,
          isWireless: data.isWireless,
          updatedAt: data.updatedAt
        }
      });

      EventDispatcher.dispatchEventsForAggregate(deviceModel.id);

      // Re-fetch with vendor join so the returned aggregate has vendorName/slug
      const raw = await this.prisma.deviceModel.findUnique({
        where: { id: data.id },
        include: { vendor: true }
      });

      if (!raw) {
        return Result.fail<DeviceModel>(
          'Device model not found after save'
        );
      }

      const domainResult = DeviceModelMapper.toDomain(raw as any);
      if (domainResult.isFailure) {
        return Result.fail<DeviceModel>(
          `Failed to map device model: ${domainResult.error}`
        );
      }

      return Result.ok<DeviceModel>(domainResult.value);
    } catch (error) {
      const errorMessage =
        error instanceof Error ? error.message : String(error);

      if (errorMessage.includes('P2002')) {
        return Result.fail<DeviceModel>(
          'A device model with this name already exists for this vendor'
        );
      }

      return Result.fail<DeviceModel>(
        `Database error saving device model: ${errorMessage}`
      );
    }
  }

  public async findById(
    id: DeviceModelId
  ): Promise<Result<DeviceModel | null>> {
    try {
      const raw = await this.prisma.deviceModel.findUnique({
        where: { id: id.toString() },
        include: { vendor: true }
      });

      if (!raw) return Result.ok<DeviceModel | null>(null);

      const domainResult = DeviceModelMapper.toDomain(raw as any);
      if (domainResult.isFailure) {
        return Result.fail<DeviceModel | null>(
          `Failed to map device model: ${domainResult.error}`
        );
      }

      return Result.ok<DeviceModel | null>(domainResult.value);
    } catch (error) {
      const errorMessage =
        error instanceof Error ? error.message : String(error);
      return Result.fail<DeviceModel | null>(
        `Database error finding device model: ${errorMessage}`
      );
    }
  }

  public async findAll(
    limit?: number,
    offset?: number
  ): Promise<Result<DeviceModel[]>> {
    try {
      const rawRecords = await this.prisma.deviceModel.findMany({
        take: limit,
        skip: offset,
        include: { vendor: true },
        orderBy: [{ vendor: { name: 'asc' } }, { model: 'asc' }]
      });

      const deviceModels: DeviceModel[] = [];
      for (const raw of rawRecords) {
        const domainResult = DeviceModelMapper.toDomain(raw as any);
        if (domainResult.isFailure) {
          return Result.fail<DeviceModel[]>(
            `Failed to map device model: ${domainResult.error}`
          );
        }
        deviceModels.push(domainResult.value);
      }

      return Result.ok<DeviceModel[]>(deviceModels);
    } catch (error) {
      const errorMessage =
        error instanceof Error ? error.message : String(error);
      return Result.fail<DeviceModel[]>(
        `Database error finding all device models: ${errorMessage}`
      );
    }
  }

  public async findByVendor(
    vendorId: VendorId
  ): Promise<Result<DeviceModel[]>> {
    try {
      const rawRecords = await this.prisma.deviceModel.findMany({
        where: { vendorId: vendorId.toString() },
        include: { vendor: true },
        orderBy: { model: 'asc' }
      });

      const deviceModels: DeviceModel[] = [];
      for (const raw of rawRecords) {
        const domainResult = DeviceModelMapper.toDomain(raw as any);
        if (domainResult.isFailure) {
          return Result.fail<DeviceModel[]>(
            `Failed to map device model: ${domainResult.error}`
          );
        }
        deviceModels.push(domainResult.value);
      }

      return Result.ok<DeviceModel[]>(deviceModels);
    } catch (error) {
      const errorMessage =
        error instanceof Error ? error.message : String(error);
      return Result.fail<DeviceModel[]>(
        `Database error finding device models by vendor: ${errorMessage}`
      );
    }
  }

  public async delete(id: DeviceModelId): Promise<Result<void>> {
    try {
      await this.prisma.deviceModel.delete({
        where: { id: id.toString() }
      });

      return Result.ok<void>();
    } catch (error) {
      const errorMessage =
        error instanceof Error ? error.message : String(error);

      if (errorMessage.includes('P2025')) {
        return Result.fail<void>('Device model not found');
      }

      return Result.fail<void>(
        `Database error deleting device model: ${errorMessage}`
      );
    }
  }

  public async exists(id: DeviceModelId): Promise<Result<boolean>> {
    try {
      const count = await this.prisma.deviceModel.count({
        where: { id: id.toString() }
      });
      return Result.ok<boolean>(count > 0);
    } catch (error) {
      const errorMessage =
        error instanceof Error ? error.message : String(error);
      return Result.fail<boolean>(
        `Database error checking device model existence: ${errorMessage}`
      );
    }
  }

  public async existsByVendorAndModel(
    vendorId: VendorId,
    model: string
  ): Promise<Result<boolean>> {
    try {
      const count = await this.prisma.deviceModel.count({
        where: {
          vendorId: vendorId.toString(),
          model
        }
      });
      return Result.ok<boolean>(count > 0);
    } catch (error) {
      const errorMessage =
        error instanceof Error ? error.message : String(error);
      return Result.fail<boolean>(
        `Database error checking device model existence: ${errorMessage}`
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
