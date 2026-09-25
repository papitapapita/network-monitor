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
  /** Wall-clock `HH:mm` on scheduledFor; given together with endTime. */
  startTime?: string | null;
  /** Wall-clock `HH:mm`, later than startTime. */
  endTime?: string | null;
  /** Set by the controller from the authenticated user, never by the client. */
  createdBy?: string | null;
}
