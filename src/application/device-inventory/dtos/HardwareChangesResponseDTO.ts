import { DeviceIdentitySuggestionDTO } from './HardwareSuggestionDTO';

export interface HardwareChangeDTO {
  deviceId: string;
  name: string;
  // RADIO: from its latest wireless snapshot; ROUTER: from what the
  // MikroTik last said about itself (DEV-215)
  source: 'RADIO' | 'ROUTER';
  // when the box reported it
  collectedAt: string;
  // macAddress, serialNumber, deviceModel and, for a router, name
  suggestions: DeviceIdentitySuggestionDTO[];
}

export interface HardwareChangesResponseDTO {
  devices: HardwareChangeDTO[];
}
