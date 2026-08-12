import { DeviceResponseDTO } from './DeviceResponseDTO';

export interface ReplaceDeviceResponseDTO {
  retiredDevice: DeviceResponseDTO;
  newDevice: DeviceResponseDTO;

  // Reported rather than silent: the operator needs to know their wireless
  // polling stopped because the replacement hardware has no radio.
  wirelessConfigRemoved: boolean;
  credentialsTransferred: boolean;
  contractedServiceTransferred: boolean;
}
