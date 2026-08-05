export interface GetTechnicianDayQueryDTO {
  technicianId: string;
  /** Calendar day, `YYYY-MM-DD`. Defaults to today when omitted. */
  date?: string;
}
