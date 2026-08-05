export interface TicketFilter {
  status?: string;
  priority?: string;
  category?: string;
  technicianId?: string;
  customerId?: string;
  deviceId?: string;
  scheduledFrom?: Date;
  scheduledTo?: Date;
  unassignedOnly?: boolean;
  openOnly?: boolean;
}
