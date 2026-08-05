import { TicketResponseDTO } from './TicketResponseDTO';

export interface TicketListResponseDTO {
  tickets: TicketResponseDTO[];
  total: number;
  hasMore: boolean;
  limit: number;
  offset: number;
}
