export interface AssignTicketRequestDTO {
  id: string;
  technicianId: string;
  /** Calendar day, `YYYY-MM-DD`. */
  scheduledFor?: string | null;
}
