export interface AffectedDeviceDTO {
  deviceId: string;
  name: string;
  ipAddress: string | null;
  // DOWN while the device's own alert is open, UP once it answered again.
  status: 'DOWN' | 'UP';
  // The nearest affected device between this one and the root, so a list can
  // read "Switch Barrio Sur → Cliente Ruiz"; null when it hangs off the root.
  viaDeviceId: string | null;
  viaDeviceName: string | null;
}
