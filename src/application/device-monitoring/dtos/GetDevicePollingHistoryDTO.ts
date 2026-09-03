export interface GetDevicePollingHistoryDTO {
  deviceId: string;
  fromDate?: Date;
  toDate?: Date;
  status?: ('SUCCESS' | 'FAILED' | 'UNKNOWN')[];
  sortBy?: 'checkedAt' | 'latencyMs';
  sortOrder?: 'ASC' | 'DESC';
  limit?: number;
  offset?: number;
}
