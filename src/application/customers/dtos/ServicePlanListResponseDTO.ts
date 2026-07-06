import { ServicePlanResponseDTO } from './ServicePlanResponseDTO';

export interface ServicePlanListResponseDTO {
  servicePlans: ServicePlanResponseDTO[];
  total: number;
  hasMore: boolean;
  limit: number;
  offset: number;
}
