import { Prisma, PrismaClient } from 'generated/prisma/client';
import { Result } from 'domain/shared/core';
import { ContractedServiceId } from 'domain/shared/ids';
import {
  ContractedServiceDetailCriteria,
  IContractedServiceDetailQuery
} from 'application/customers/interfaces';
import { ContractedServiceDetailDTO } from 'application/customers/dtos';

const INCLUDE = {
  customer: {
    select: {
      id: true,
      fullName: true,
      phone: true,
      email: true,
      cedula: true
    }
  },
  servicePlan: {
    select: {
      id: true,
      name: true,
      downloadMbps: true,
      uploadMbps: true,
      monthlyPrice: true,
      isActive: true
    }
  },
  device: {
    select: {
      id: true,
      name: true,
      ipAddress: true,
      macAddress: true,
      status: true,
      category: true,
      deletedAt: true
    }
  }
} as const;

type ContractedServiceDetailRecord =
  Prisma.ContractedServiceGetPayload<{
    include: typeof INCLUDE;
  }>;

export class PrismaContractedServiceDetailQuery
  implements IContractedServiceDetailQuery
{
  constructor(private readonly prisma: PrismaClient) {}

  public async findById(
    id: ContractedServiceId
  ): Promise<Result<ContractedServiceDetailDTO | null>> {
    try {
      const raw = await this.prisma.contractedService.findUnique({
        where: { id: id.toString() },
        include: INCLUDE
      });
      return Result.ok<ContractedServiceDetailDTO | null>(
        raw ? this.toDTO(raw) : null
      );
    } catch (error) {
      const errorMessage =
        error instanceof Error ? error.message : String(error);
      return Result.fail<ContractedServiceDetailDTO | null>(
        `Database error finding contracted service: ${errorMessage}`
      );
    }
  }

  public async list(
    criteria: ContractedServiceDetailCriteria
  ): Promise<Result<ContractedServiceDetailDTO[]>> {
    try {
      const rawRecords = await this.prisma.contractedService.findMany(
        {
          where: this.buildWhere(criteria),
          include: INCLUDE,
          orderBy: this.isFiltered(criteria)
            ? { startDate: 'desc' }
            : { createdAt: 'desc' },
          take: criteria.limit,
          skip: criteria.offset
        }
      );
      return Result.ok<ContractedServiceDetailDTO[]>(
        rawRecords.map((raw) => this.toDTO(raw))
      );
    } catch (error) {
      const errorMessage =
        error instanceof Error ? error.message : String(error);
      return Result.fail<ContractedServiceDetailDTO[]>(
        `Database error listing contracted services: ${errorMessage}`
      );
    }
  }

  public async count(
    criteria: ContractedServiceDetailCriteria
  ): Promise<Result<number>> {
    try {
      const count = await this.prisma.contractedService.count({
        where: this.buildWhere(criteria)
      });
      return Result.ok<number>(count);
    } catch (error) {
      const errorMessage =
        error instanceof Error ? error.message : String(error);
      return Result.fail<number>(
        `Database error counting contracted services: ${errorMessage}`
      );
    }
  }

  private isFiltered(
    criteria: ContractedServiceDetailCriteria
  ): boolean {
    return (
      criteria.customerId !== undefined ||
      criteria.deviceId !== undefined
    );
  }

  private buildWhere(
    criteria: ContractedServiceDetailCriteria
  ): Prisma.ContractedServiceWhereInput {
    const where: Prisma.ContractedServiceWhereInput = {};
    if (criteria.customerId !== undefined) {
      where.customerId = criteria.customerId.toString();
    }
    if (criteria.deviceId !== undefined) {
      where.deviceId = criteria.deviceId.toString();
    }
    return where;
  }

  private toDTO(
    raw: ContractedServiceDetailRecord
  ): ContractedServiceDetailDTO {
    return {
      id: raw.id,
      customerId: raw.customerId,
      servicePlanId: raw.servicePlanId,
      deviceId: raw.deviceId,
      status: raw.status,
      startDate: raw.startDate.toISOString(),
      paymentDay: raw.paymentDay,
      createdAt: raw.createdAt.toISOString(),
      updatedAt: raw.updatedAt.toISOString(),
      customer: { ...raw.customer },
      servicePlan: {
        ...raw.servicePlan,
        monthlyPrice: Number(raw.servicePlan.monthlyPrice)
      },
      device: raw.device
        ? {
            ...raw.device,
            deletedAt: raw.device.deletedAt
              ? raw.device.deletedAt.toISOString()
              : null
          }
        : null
    };
  }
}
