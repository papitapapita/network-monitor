export interface GetDevicePollingHistoryDTO {
  deviceId: string;
  fromDate?: Date;
  toDate?: Date;
  status?: ('SUCCESS' | 'FAILED' | 'UNKNOWN')[];
  limit?: number;
  offset?: number;
}
