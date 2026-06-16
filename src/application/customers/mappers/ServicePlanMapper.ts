import { ServicePlan } from 'domain/customers';
import {
  ServicePlanResponseDTO,
  ServicePlanListResponseDTO,
  CreateServicePlanRequestDTO,
  UpdateServicePlanRequestDTO
} from '../dtos';

export class ServicePlanMapper {
  public static toDTO(plan: ServicePlan): ServicePlanResponseDTO {
    return {
      id: plan.id.toString(),
      name: plan.name,
      downloadMbps: plan.downloadMbps,
      uploadMbps: plan.uploadMbps,
      monthlyPrice: plan.monthlyPrice,
      description: plan.description,
      isActive: plan.isActive,
      createdAt: plan.createdAt.toISOString(),
      updatedAt: plan.updatedAt.toISOString()
    };
  }

  public static toListDTO(
    plans: ServicePlan[],
    total: number,
    limit: number = 20,
    offset: number = 0
  ): ServicePlanListResponseDTO {
    return {
      servicePlans: plans.map((p) => this.toDTO(p)),
      total,
      hasMore: offset + plans.length < total,
      limit,
      offset
    };
  }

  public static extractCreateData(dto: CreateServicePlanRequestDTO) {
    return {
      name: dto.name,
      downloadMbps: dto.downloadMbps,
      uploadMbps: dto.uploadMbps,
      monthlyPrice: dto.monthlyPrice,
      description: dto.description ?? null,
      isActive: dto.isActive
    };
  }

  public static extractUpdateData(dto: UpdateServicePlanRequestDTO) {
    const updates: {
      name?: string;
      downloadMbps?: number;
      uploadMbps?: number;
      monthlyPrice?: number;
      description?: string | null;
      isActive?: boolean;
    } = {};
    if (dto.name !== undefined) updates.name = dto.name;
    if (dto.downloadMbps !== undefined)
      updates.downloadMbps = dto.downloadMbps;
    if (dto.uploadMbps !== undefined)
      updates.uploadMbps = dto.uploadMbps;
    if (dto.monthlyPrice !== undefined)
      updates.monthlyPrice = dto.monthlyPrice;
    if (dto.description !== undefined)
      updates.description = dto.description;
    if (dto.isActive !== undefined) updates.isActive = dto.isActive;
    return updates;
  }
}
