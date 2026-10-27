export type SpeedTestStatus = 'COMPLETED' | 'FAILED';

export interface SpeedTestResultProps {
  status: SpeedTestStatus;
  downloadMbps: number | null;
  uploadMbps: number | null;
  latencyMs: number | null;
  jitterMs: number | null;
  serverLocation: string | null;
  error: string | null;
  // null once that user is deleted; the email stays as it was then
  startedById: string | null;
  startedByEmail: string;
  startedAt: Date;
  finishedAt: Date;
}
