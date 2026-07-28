export interface AlertResponseDTO {
  id: string;
  deviceId: string;
  severity: string;
  source: string;
  type: string;
  description: string;
  details: Record<string, unknown>;
  status: 'OPEN' | 'RESOLVED';
  startedAt: string;
  resolvedAt: string | null;
  notifiedAt: string | null;
  recoveryNotifiedAt: string | null;
  durationSecs: number | null;
}
