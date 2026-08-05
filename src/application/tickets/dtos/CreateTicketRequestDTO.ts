import { TicketAddressDTO } from './TicketAddressDTO';

export interface CreateTicketRequestDTO {
  title: string;
  description: string;
  category: string;
  priority?: string;
  customerId?: string | null;
  deviceId?: string | null;
  technicianId?: string | null;
  address?: Partial<TicketAddressDTO> | null;
  /** Calendar day, `YYYY-MM-DD`. */
  scheduledFor?: string | null;
  /** Set by the controller from the authenticated user, never by the client. */
  createdBy?: string | null;
}
