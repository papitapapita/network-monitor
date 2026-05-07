export interface AlertResponseDTO {
  id: string;
  deviceId: string;
  severity: string;
  status: 'OPEN' | 'RESOLVED';
  startedAt: string;
  resolvedAt: string | null;
  notifiedAt: string | null;
  recoveryNotifiedAt: string | null;
  durationSecs: number | null;
}
