import { Technician } from 'domain/tickets';
import {
  TechnicianResponseDTO,
  TechnicianListResponseDTO,
  TechnicianSummaryDTO
} from '../dtos';

export class TechnicianMapper {
  public static toDTO(technician: Technician): TechnicianResponseDTO {
    return {
      id: technician.id.toString(),
      fullName: technician.fullName,
      phone: technician.phone.toString(),
      email: technician.email,
      userId:
        technician.userId !== null
          ? technician.userId.toString()
          : null,
      isActive: technician.isActive,
      createdAt: technician.createdAt.toISOString(),
      updatedAt: technician.updatedAt.toISOString()
    };
  }

  public static toSummaryDTO(
    technician: Technician
  ): TechnicianSummaryDTO {
    return {
      id: technician.id.toString(),
      fullName: technician.fullName,
      phone: technician.phone.toString(),
      email: technician.email,
      isActive: technician.isActive
    };
  }

  public static toListDTO(
    technicians: Technician[],
    total: number,
    limit: number = 20,
    offset: number = 0
  ): TechnicianListResponseDTO {
    return {
      technicians: technicians.map((t) => TechnicianMapper.toDTO(t)),
      total,
      hasMore: offset + technicians.length < total,
      limit,
      offset
    };
  }
}
