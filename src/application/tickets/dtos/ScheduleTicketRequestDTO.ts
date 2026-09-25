export interface ScheduleTicketRequestDTO {
  id: string;
  /** Calendar day, `YYYY-MM-DD`. Null clears the schedule. */
  scheduledFor: string | null;
  /** Wall-clock `HH:mm` on scheduledFor; omit both for any time that day. */
  startTime?: string | null;
  /** Wall-clock `HH:mm`, later than startTime. */
  endTime?: string | null;
}
