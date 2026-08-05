export interface ScheduleTicketRequestDTO {
  id: string;
  /** Calendar day, `YYYY-MM-DD`. Null clears the schedule. */
  scheduledFor: string | null;
}
