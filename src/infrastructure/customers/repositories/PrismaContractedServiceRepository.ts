import { PrismaClient } from 'generated/prisma/client';
import { ContractedService } from 'domain/customers/aggregates';
import {
  ContractedServiceId,
  CustomerId,
  ServicePlanId,
  DeviceId
} from 'domain/shared/ids';
import { Result, EventDispatcher } from 'domain/shared/core';
import { IContractedServiceRepository } from 'domain/customers/repository';
import { ContractedServicePrismaMapper } from '../mappers';

export class PrismaContractedServiceRepository
  implements IContractedServiceRepository
{
  constructor(private readonly prisma: PrismaClient) {}

  public async save(
    service: ContractedService
  ): Promise<Result<ContractedService>> {
    try {
      const data =
        ContractedServicePrismaMapper.toPersistence(service);

      await this.prisma.contractedService.upsert({
        where: { id: data.id },
        create: data,
        update: {
          customerId: data.customerId,
          servicePlanId: data.servicePlanId,
          deviceId: data.deviceId,
          status: data.status,
          startDate: data.startDate,
          updatedAt: data.updatedAt
        }
      });

      EventDispatcher.dispatchEventsForAggregate(service.id);

      return Result.ok<ContractedService>(service);
    } catch (error) {
      const errorMessage =
        error instanceof Error ? error.message : String(error);

      if (errorMessage.includes('P2002')) {
        return Result.fail<ContractedService>(
          'This device is already assigned to another contracted service'
        );
      }
      if (errorMessage.includes('P2003')) {
        return Result.fail<ContractedService>(
          'Referenced customer, service plan or device does not exist'
        );
      }

      return Result.fail<ContractedService>(
        `Database error saving contracted service: ${errorMessage}`
      );
    }
  }

  public async findById(
    id: ContractedServiceId
  ): Promise<Result<ContractedService | null>> {
    try {
      const raw = await this.prisma.contractedService.findUnique({
        where: { id: id.toString() }
      });

      if (!raw) return Result.ok<ContractedService | null>(null);

      const domainResult =
        ContractedServicePrismaMapper.toDomain(raw);
      if (domainResult.isFailure) {
        return Result.fail<ContractedService | null>(
          `Failed to map contracted service: ${domainResult.error}`
        );
      }

      return Result.ok<ContractedService | null>(domainResult.value);
    } catch (error) {
      const errorMessage =
        error instanceof Error ? error.message : String(error);
      return Result.fail<ContractedService | null>(
        `Database error finding contracted service: ${errorMessage}`
      );
    }
  }

  public async findByCustomerId(
    customerId: CustomerId
  ): Promise<Result<ContractedService[]>> {
    try {
      const rawRecords = await this.prisma.contractedService.findMany({
        where: { customerId: customerId.toString() },
        orderBy: { startDate: 'desc' }
      });

      return this.mapMany(rawRecords);
    } catch (error) {
      const errorMessage =
        error instanceof Error ? error.message : String(error);
      return Result.fail<ContractedService[]>(
        `Database error finding contracted services by customer: ${errorMessage}`
      );
    }
  }

  public async findByServicePlanId(
    servicePlanId: ServicePlanId
  ): Promise<Result<ContractedService[]>> {
    try {
      const rawRecords = await this.prisma.contractedService.findMany({
        where: { servicePlanId: servicePlanId.toString() },
        orderBy: { startDate: 'desc' }
      });

      return this.mapMany(rawRecords);
    } catch (error) {
      const errorMessage =
        error instanceof Error ? error.message : String(error);
      return Result.fail<ContractedService[]>(
        `Database error finding contracted services by service plan: ${errorMessage}`
      );
    }
  }

  public async findByDeviceId(
    deviceId: DeviceId
  ): Promise<Result<ContractedService | null>> {
    try {
      const raw = await this.prisma.contractedService.findUnique({
        where: { deviceId: deviceId.toString() }
      });

      if (!raw) return Result.ok<ContractedService | null>(null);

      const domainResult =
        ContractedServicePrismaMapper.toDomain(raw);
      if (domainResult.isFailure) {
        return Result.fail<ContractedService | null>(
          `Failed to map contracted service: ${domainResult.error}`
        );
      }

      return Result.ok<ContractedService | null>(domainResult.value);
    } catch (error) {
      const errorMessage =
        error instanceof Error ? error.message : String(error);
      return Result.fail<ContractedService | null>(
        `Database error finding contracted service by device: ${errorMessage}`
      );
    }
  }

  public async findAll(
    limit?: number,
    offset?: number
  ): Promise<Result<ContractedService[]>> {
    try {
      const rawRecords = await this.prisma.contractedService.findMany({
        take: limit,
        skip: offset,
        orderBy: { createdAt: 'desc' }
      });

      return this.mapMany(rawRecords);
    } catch (error) {
      const errorMessage =
        error instanceof Error ? error.message : String(error);
      return Result.fail<ContractedService[]>(
        `Database error finding all contracted services: ${errorMessage}`
      );
    }
  }

  public async delete(
    id: ContractedServiceId
  ): Promise<Result<void>> {
    try {
      await this.prisma.contractedService.delete({
        where: { id: id.toString() }
      });
      return Result.ok<void>();
    } catch (error) {
      const errorMessage =
        error instanceof Error ? error.message : String(error);

      if (errorMessage.includes('P2025')) {
        return Result.fail<void>('Contracted service not found');
      }

      return Result.fail<void>(
        `Database error deleting contracted service: ${errorMessage}`
      );
    }
  }

  public async exists(
    id: ContractedServiceId
  ): Promise<Result<boolean>> {
    try {
      const count = await this.prisma.contractedService.count({
        where: { id: id.toString() }
      });
      return Result.ok<boolean>(count > 0);
    } catch (error) {
      const errorMessage =
        error instanceof Error ? error.message : String(error);
      return Result.fail<boolean>(
        `Database error checking contracted service existence: ${errorMessage}`
      );
    }
  }

  public async count(): Promise<Result<number>> {
    try {
      const count = await this.prisma.contractedService.count();
      return Result.ok<number>(count);
    } catch (error) {
      const errorMessage =
        error instanceof Error ? error.message : String(error);
      return Result.fail<number>(
        `Database error counting contracted services: ${errorMessage}`
      );
    }
  }

  private mapMany(
    rawRecords: Parameters<
      typeof ContractedServicePrismaMapper.toDomain
    >[0][]
  ): Result<ContractedService[]> {
    const services: ContractedService[] = [];
    for (const raw of rawRecords) {
      const domainResult =
        ContractedServicePrismaMapper.toDomain(raw);
      if (domainResult.isFailure) {
        return Result.fail<ContractedService[]>(
          `Failed to map contracted service: ${domainResult.error}`
        );
      }
      services.push(domainResult.value);
    }
    return Result.ok<ContractedService[]>(services);
  }
}
