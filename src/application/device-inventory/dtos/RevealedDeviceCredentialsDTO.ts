// The stored secrets in plaintext, for a user who unlocked them (DEV-134).
export interface RevealedDeviceCredentialsDTO {
  deviceId: string;
  snmpVersion: 1 | 2 | 3;
  snmpCommunity: string | null;
  snmpV3AuthUser: string | null;
  snmpV3AuthProto: 'MD5' | 'SHA' | null;
  snmpV3AuthKey: string | null;
  snmpV3PrivProto: 'DES' | 'AES' | null;
  snmpV3PrivKey: string | null;
  snmpPort: number;
  httpUsername: string | null;
  httpPassword: string | null;
  httpPort: number;
  sshPort: number;
}
