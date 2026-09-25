import { TicketAddressDTO } from './TicketAddressDTO';
import { TicketContactDTO } from './TicketContactDTO';

export interface TicketResponseDTO {
  id: string;
  code: number | null;
  status: string;
  priority: string;
  category: string;
  title: string;
  description: string;
  customerId: string | null;
  deviceId: string | null;
  technicianId: string | null;
  address: TicketAddressDTO | null;
  contact: TicketContactDTO | null;
  /** Calendar day, `YYYY-MM-DD`. */
  scheduledFor: string | null;
  /** Wall-clock `HH:mm` on scheduledFor; null means any time that day. */
  startTime: string | null;
  endTime: string | null;
  origin: string;
  originAlertId: string | null;
  resolutionNotes: string | null;
  cancelReason: string | null;
  createdBy: string | null;
  assignedAt: string | null;
  startedAt: string | null;
  resolvedAt: string | null;
  cancelledAt: string | null;
  createdAt: string;
  updatedAt: string;
}
