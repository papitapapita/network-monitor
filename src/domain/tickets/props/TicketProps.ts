import {
  CustomerId,
  DeviceId,
  TechnicianId,
  UserId
} from 'domain/shared/ids';
import {
  ServiceAddress,
  TicketCategory,
  TicketOrigin,
  TicketPriority,
  TicketStatus
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
  scheduledFor: Date | null;
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
