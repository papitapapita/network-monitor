import { WirelessClientDTO } from './WirelessClientDTO';

export interface WirelessClientListResponseDTO {
  deviceId: string;
  collectedAt: string;
  clients: WirelessClientDTO[];
}
