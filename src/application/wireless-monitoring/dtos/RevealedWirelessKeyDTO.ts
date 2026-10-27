export interface RevealedWirelessKeyDTO {
  deviceId: string;
  role: 'ACCESS_POINT' | 'STATION';
  ssid: string | null;
  security: 'WPA_PSK' | 'OPEN' | 'OTHER';
  // Plaintext. null unless security is WPA_PSK.
  key: string | null;
  readAt: string;
}
