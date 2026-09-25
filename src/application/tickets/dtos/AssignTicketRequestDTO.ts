export interface AssignTicketRequestDTO {
  id: string;
  technicianId: string;
  /** Calendar day, `YYYY-MM-DD`. */
  scheduledFor?: string | null;
  /** Wall-clock `HH:mm` on scheduledFor; given together with endTime. */
  startTime?: string | null;
  /** Wall-clock `HH:mm`, later than startTime. */
  endTime?: string | null;
}
