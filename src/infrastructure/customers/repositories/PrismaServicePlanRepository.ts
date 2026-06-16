import { PrismaClient } from 'generated/prisma/client';
import { ServicePlan } from 'domain/customers/aggregates';
import { ServicePlanId } from 'domain/shared/ids';
import { Result, EventDispatcher } from 'domain/shared/core';
import { IServicePlanRepository } from 'domain/customers/repository';
import { ServicePlanPrismaMapper } from '../mappers';

export class PrismaServicePlanRepository
  implements IServicePlanRepository
{
  constructor(private readonly prisma: PrismaClient) {}

  public async save(plan: ServicePlan): Promise<Result<ServicePlan>> {
    try {
      const data = ServicePlanPrismaMapper.toPersistence(plan);

      await this.prisma.servicePlan.upsert({
        where: { id: data.id },
        create: data,
        update: {
          name: data.name,
          downloadMbps: data.downloadMbps,
          uploadMbps: data.uploadMbps,
          monthlyPrice: data.monthlyPrice,
          description: data.description,
          isActive: data.isActive,
          updatedAt: data.updatedAt
        }
      });

      EventDispatcher.dispatchEventsForAggregate(plan.id);

      return Result.ok<ServicePlan>(plan);
    } catch (error) {
      const errorMessage =
        error instanceof Error ? error.message : String(error);

      if (errorMessage.includes('P2002')) {
        return Result.fail<ServicePlan>(
          'A service plan with this name already exists'
        );
      }

      return Result.fail<ServicePlan>(
        `Database error saving service plan: ${errorMessage}`
      );
    }
  }

  public async findById(
    id: ServicePlanId
  ): Promise<Result<ServicePlan | null>> {
    try {
      const raw = await this.prisma.servicePlan.findUnique({
        where: { id: id.toString() }
      });

      if (!raw) return Result.ok<ServicePlan | null>(null);

      return this.toDomainResult(raw);
    } catch (error) {
      const errorMessage =
        error instanceof Error ? error.message : String(error);
      return Result.fail<ServicePlan | null>(
        `Database error finding service plan: ${errorMessage}`
      );
    }
  }

  public async findByName(
    name: string
  ): Promise<Result<ServicePlan | null>> {
    try {
      const raw = await this.prisma.servicePlan.findUnique({
        where: { name }
      });

      if (!raw) return Result.ok<ServicePlan | null>(null);

      return this.toDomainResult(raw);
    } catch (error) {
      const errorMessage =
        error instanceof Error ? error.message : String(error);
      return Result.fail<ServicePlan | null>(
        `Database error finding service plan by name: ${errorMessage}`
      );
    }
  }

  public async findAll(
    limit?: number,
    offset?: number
  ): Promise<Result<ServicePlan[]>> {
    try {
      const rawRecords = await this.prisma.servicePlan.findMany({
        take: limit,
        skip: offset,
        orderBy: { name: 'asc' }
      });

      const plans: ServicePlan[] = [];
      for (const raw of rawRecords) {
        const domainResult = ServicePlanPrismaMapper.toDomain(raw);
        if (domainResult.isFailure) {
          return Result.fail<ServicePlan[]>(
            `Failed to map service plan: ${domainResult.error}`
          );
        }
        plans.push(domainResult.value);
      }

      return Result.ok<ServicePlan[]>(plans);
    } catch (error) {
      const errorMessage =
        error instanceof Error ? error.message : String(error);
      return Result.fail<ServicePlan[]>(
        `Database error finding all service plans: ${errorMessage}`
      );
    }
  }

  public async delete(id: ServicePlanId): Promise<Result<void>> {
    try {
      await this.prisma.servicePlan.delete({
        where: { id: id.toString() }
      });
      return Result.ok<void>();
    } catch (error) {
      const errorMessage =
        error instanceof Error ? error.message : String(error);

      if (errorMessage.includes('P2025')) {
        return Result.fail<void>('Service plan not found');
      }
      if (errorMessage.includes('P2003')) {
        return Result.fail<void>(
          'Cannot delete a service plan that is referenced by contracted services'
        );
      }

      return Result.fail<void>(
        `Database error deleting service plan: ${errorMessage}`
      );
    }
  }

  public async exists(id: ServicePlanId): Promise<Result<boolean>> {
    try {
      const count = await this.prisma.servicePlan.count({
        where: { id: id.toString() }
      });
      return Result.ok<boolean>(count > 0);
    } catch (error) {
      const errorMessage =
        error instanceof Error ? error.message : String(error);
      return Result.fail<boolean>(
        `Database error checking service plan existence: ${errorMessage}`
      );
    }
  }

  public async count(): Promise<Result<number>> {
    try {
      const count = await this.prisma.servicePlan.count();
      return Result.ok<number>(count);
    } catch (error) {
      const errorMessage =
        error instanceof Error ? error.message : String(error);
      return Result.fail<number>(
        `Database error counting service plans: ${errorMessage}`
      );
    }
  }

  private toDomainResult(
    raw: Parameters<typeof ServicePlanPrismaMapper.toDomain>[0]
  ): Result<ServicePlan | null> {
    const domainResult = ServicePlanPrismaMapper.toDomain(raw);
    if (domainResult.isFailure) {
      return Result.fail<ServicePlan | null>(
        `Failed to map service plan: ${domainResult.error}`
      );
    }
    return Result.ok<ServicePlan | null>(domainResult.value);
  }
}
