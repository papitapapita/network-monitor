// httpUsername + httpPassword are the required pair and are replaced on every
// call. The SNMP fields are optional and nothing polls them yet: omitting one
// keeps whatever is stored, sending null clears it. Sensitive fields are
// encrypted at rest (AES-256-GCM).
export interface SetDeviceCredentialsRequestDTO {
  deviceId: string;
  httpUsername: string;
  httpPassword: string;
  httpPort?: number;
  snmpVersion?: 1 | 2 | 3;
  snmpCommunity?: string | null;
  snmpV3AuthUser?: string | null;
  snmpV3AuthProto?: 'MD5' | 'SHA' | null;
  snmpV3AuthKey?: string | null;
  snmpV3PrivProto?: 'DES' | 'AES' | null;
  snmpV3PrivKey?: string | null;
  snmpPort?: number;
}
