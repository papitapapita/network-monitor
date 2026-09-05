import { WirelessClientDTO } from './WirelessClientDTO';

export interface ExpectedApClientDTO {
  deviceId: string;
  deviceName: string;
  macAddress: string | null;
  connected: boolean;
  client: WirelessClientDTO | null;
}

export interface WirelessExpectedClientsResponseDTO {
  apDeviceId: string;
  collectedAt: string | null;
  expected: ExpectedApClientDTO[];
  missingCount: number;
  unexpectedConnected: WirelessClientDTO[];
}
