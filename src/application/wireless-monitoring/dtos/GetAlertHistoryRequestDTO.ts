export interface GetAlertHistoryRequestDTO {
  deviceId: string;
  from?: Date;
  to?: Date;
  limit?: number;
}
