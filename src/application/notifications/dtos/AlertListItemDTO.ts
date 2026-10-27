import { AlertResponseDTO } from './AlertResponseDTO';

export interface AlertTicketRefDTO {
  id: string;
  code: number;
  status: string;
}

export interface AlertListItemDTO extends AlertResponseDTO {
  deviceName: string;
  // The alert's own live ticket. A ticket raised for another alert on the
  // same device does not count: each alert can become its own job (TKT-115).
  ticket: AlertTicketRefDTO | null;
  ticketSuggested: boolean;
  // How many devices went down behind this one (NOT-243).
  affectedCount: number;
}
