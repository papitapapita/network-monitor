import { AlertResponseDTO } from './AlertResponseDTO';

export interface BulkClearAlertsResponseDTO {
  cleared: AlertResponseDTO[];
  skipped: { id: string; reason: string }[];
  failed: { id: string; error: string }[];
}
