import { TechnicianResponseDTO } from './TechnicianResponseDTO';

export interface TechnicianListResponseDTO {
  technicians: TechnicianResponseDTO[];
  total: number;
  hasMore: boolean;
  limit: number;
  offset: number;
}
