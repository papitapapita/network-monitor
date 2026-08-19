export interface BulkDeleteAlertsResponseDTO {
  deleted: string[];
  skipped: { id: string; reason: string }[];
  failed: { id: string; error: string }[];
}
