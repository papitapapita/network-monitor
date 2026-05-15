export interface WirelessClientDTO {
  macAddress: string;
  signalRxDbm: number | null;
  signalTxDbm: number | null;
  snrDb: number | null;
  txRateMbps: number | null;
  rxRateMbps: number | null;
  throughputTxBps: number | null;
  throughputRxBps: number | null;
  ccqPercent: number | null;
  uptimeSeconds: number | null;
  ipAddress: string | null;
}
