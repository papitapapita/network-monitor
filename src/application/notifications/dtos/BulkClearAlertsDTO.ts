export interface BulkClearAlertsDTO {
  // exactly one of the two is expected — explicit ids, or every open
  // alert for a device
  ids?: string[];
  deviceId?: string;
}
