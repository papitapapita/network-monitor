import { TicketDetailResponseDTO } from './TicketDetailResponseDTO';
import { TechnicianSummaryDTO } from './TechnicianSummaryDTO';

export interface TechnicianDayResponseDTO {
  technician: TechnicianSummaryDTO;
  /** Calendar day, `YYYY-MM-DD`. */
  date: string;
  tickets: TicketDetailResponseDTO[];
  total: number;
}
