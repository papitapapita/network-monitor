import { Result } from 'domain/shared/core';
import { ServicePlanId } from 'domain/shared/ids';
import { ServicePlan } from 'domain/customers/aggregates';

interface ServicePlanRecord {
  id: string;
  name: string;
  downloadMbps: number;
  uploadMbps: number;
  monthlyPrice: number | { toNumber(): number };
  description: string | null;
  isActive: boolean;
  createdAt: Date;
  updatedAt: Date;
}

export class ServicePlanPrismaMapper {
  public static toDomain(
    raw: ServicePlanRecord
  ): Result<ServicePlan> {
    const idResult = ServicePlanId.parse(raw.id);
    if (idResult.isFailure) {
      return Result.fail<ServicePlan>(
        `Invalid service plan id: ${idResult.error}`
      );
    }

    return Result.ok<ServicePlan>(
      ServicePlan.reconstitute(idResult.value, {
        name: raw.name,
        downloadMbps: raw.downloadMbps,
        uploadMbps: raw.uploadMbps,
        // Prisma stores price as Decimal — normalise to number before use.
        monthlyPrice: Number(raw.monthlyPrice),
        description: raw.description ?? null,
        isActive: raw.isActive,
        createdAt: raw.createdAt,
        updatedAt: raw.updatedAt
      })
    );
  }

  public static toPersistence(plan: ServicePlan): {
    id: string;
    name: string;
    downloadMbps: number;
    uploadMbps: number;
    monthlyPrice: number;
    description: string | null;
    isActive: boolean;
    createdAt: Date;
    updatedAt: Date;
  } {
    return {
      id: plan.id.toString(),
      name: plan.name,
      downloadMbps: plan.downloadMbps,
      uploadMbps: plan.uploadMbps,
      monthlyPrice: plan.monthlyPrice,
      description: plan.description ?? null,
      isActive: plan.isActive,
      createdAt: plan.createdAt,
      updatedAt: plan.updatedAt
    };
  }
}
