export interface OpenTicketFromAlertRequestDTO {
  /** `DEVICE_ALERT` or `WIRELESS_ALERT`. */
  origin: string;
  alertId: string;
  deviceId: string;
  /** `WARNING` or `CRITICAL`. */
  severity: string;
  message: string;
}
