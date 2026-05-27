// Full-replace semantics: calling this endpoint replaces all previously
// stored credentials. Sensitive fields are encrypted at rest (AES-256-GCM).
export interface SetDeviceCredentialsRequestDTO {
  deviceId: string;
  // Use version 1 for legacy devices (e.g. AirOS 8 which does not support v3).
  snmpVersion: 1 | 2 | 3;
  snmpCommunity?: string | null;
  snmpV3AuthUser?: string | null;
  snmpV3AuthProto?: 'MD5' | 'SHA' | null;
  snmpV3AuthKey?: string | null;
  snmpV3PrivProto?: 'DES' | 'AES' | null;
  snmpV3PrivKey?: string | null;
  snmpPort?: number;
  httpUsername?: string | null;
  httpPassword?: string | null;
  httpPort?: number;
}
