export interface OpenTicketFromAlertRequestDTO {
  /** `DEVICE_ALERT` or `WIRELESS_ALERT`. */
  origin: string;
  alertId: string;
  deviceId: string;
  /** `WARNING` or `CRITICAL`. */
  severity: string;
  message: string;
  /**
   * Default true: an automatic ticket joins the device's live alert ticket
   * (TKT-113). False when a person picked this alert (TKT-115).
   */
  foldIntoDeviceTicket?: boolean;
  createdBy?: string | null;
}
