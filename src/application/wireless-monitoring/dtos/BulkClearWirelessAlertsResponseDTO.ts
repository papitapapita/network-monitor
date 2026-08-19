import { WirelessAlertResponseDTO } from './WirelessAlertResponseDTO';

export interface BulkClearWirelessAlertsResponseDTO {
  cleared: WirelessAlertResponseDTO[];
  skipped: { id: string; reason: string }[];
  failed: { id: string; error: string }[];
}
