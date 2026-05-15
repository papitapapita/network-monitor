import { WirelessStatusResponseDTO } from './WirelessStatusResponseDTO';

export interface WirelessHistoryResponseDTO {
  snapshots: WirelessStatusResponseDTO[];
  total: number;
}
