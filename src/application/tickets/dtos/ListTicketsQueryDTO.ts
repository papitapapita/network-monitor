export interface ListTicketsQueryDTO {
  status?: string;
  priority?: string;
  category?: string;
  technicianId?: string;
  customerId?: string;
  deviceId?: string;
  /** Calendar day, `YYYY-MM-DD`. */
  scheduledFrom?: string;
  /** Calendar day, `YYYY-MM-DD`. */
  scheduledTo?: string;
  unassignedOnly?: boolean;
  openOnly?: boolean;
  limit?: number;
  offset?: number;
}
