// A device needs an HTTP login, SNMP access, or both: AirOS answers over HTTP,
// Mimosa only over SNMP. Every field is optional on its own — omitting one keeps
// whatever is stored, sending null clears it — but httpUsername and
// httpPassword travel together. sshPort, the port RouterOS backups log in on
// with the same username and password, defaults to 22; apiPort, the RouterOS API
// port live router traffic reads, to 8728. Sensitive fields are encrypted at
// rest (AES-256-GCM).
export interface SetDeviceCredentialsRequestDTO {
  deviceId: string;
  httpUsername?: string | null;
  httpPassword?: string | null;
  httpPort?: number;
  sshPort?: number;
  apiPort?: number;
  snmpVersion?: 1 | 2 | 3;
  snmpCommunity?: string | null;
  snmpV3AuthUser?: string | null;
  snmpV3AuthProto?: 'MD5' | 'SHA' | null;
  snmpV3AuthKey?: string | null;
  snmpV3PrivProto?: 'DES' | 'AES' | null;
  snmpV3PrivKey?: string | null;
  snmpPort?: number;
}
