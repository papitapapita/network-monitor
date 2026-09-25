import {
  CustomerId,
  DeviceId,
  TechnicianId,
  UserId
} from 'domain/shared/ids';
import {
  ServiceAddress,
  TicketContact,
  TicketCategory,
  TicketOrigin,
  TicketPriority,
  TicketStatus,
  TimeBlock
} from '../value-objects';

export interface TicketProps {
  // Assigned by the database sequence on first insert, so it is null only
  // between create() and the first save().
  code: number | null;
  status: TicketStatus;
  priority: TicketPriority;
  category: TicketCategory;
  title: string;
  description: string;
  customerId: CustomerId | null;
  deviceId: DeviceId | null;
  technicianId: TechnicianId | null;
  address: ServiceAddress | null;
  // Free-text person to ask for — the only record of a prospect who is not a
  // customer yet.
  contact: TicketContact | null;
  scheduledFor: Date | null;
  // Optional window within scheduledFor; null means any time that day.
  timeBlock: TimeBlock | null;
  origin: TicketOrigin;
  // Raw uuid, not a typed id: it points at alert_events or
  // wireless_alert_records depending on origin.
  originAlertId: string | null;
  resolutionNotes: string | null;
  cancelReason: string | null;
  createdBy: UserId | null;
  assignedAt: Date | null;
  startedAt: Date | null;
  resolvedAt: Date | null;
  cancelledAt: Date | null;
  createdAt: Date;
  updatedAt: Date;
}
