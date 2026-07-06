import { ContractedService } from 'domain/customers';
import {
  ContractedServiceResponseDTO,
  ContractedServiceListResponseDTO
} from '../dtos';

export class ContractedServiceMapper {
  public static toDTO(
    service: ContractedService
  ): ContractedServiceResponseDTO {
    return {
      id: service.id.toString(),
      customerId: service.customerId.toString(),
      servicePlanId: service.servicePlanId.toString(),
      deviceId:
        service.deviceId !== null ? service.deviceId.toString() : null,
      status: service.status,
      startDate: service.startDate.toISOString(),
      createdAt: service.createdAt.toISOString(),
      updatedAt: service.updatedAt.toISOString()
    };
  }

  public static toListDTO(
    services: ContractedService[],
    total: number,
    limit: number = 20,
    offset: number = 0
  ): ContractedServiceListResponseDTO {
    return {
      contractedServices: services.map((s) => this.toDTO(s)),
      total,
      hasMore: offset + services.length < total,
      limit,
      offset
    };
  }
}
