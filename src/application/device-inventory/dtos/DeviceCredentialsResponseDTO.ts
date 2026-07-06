// Sensitive fields are masked: "***" means a value is stored; null means absent.
// hasSnmpCredentials / hasHttpCredentials let callers check capability without
// inspecting individual masked fields.
export interface DeviceCredentialsResponseDTO {
  deviceId: string;
  snmpVersion: 1 | 2 | 3;
  snmpCommunity: '***' | null;
  snmpV3AuthUser: string | null;
  snmpV3AuthProto: 'MD5' | 'SHA' | null;
  snmpV3AuthKey: '***' | null;
  snmpV3PrivProto: 'DES' | 'AES' | null;
  snmpV3PrivKey: '***' | null;
  snmpPort: number;
  httpUsername: string | null;
  httpPassword: '***' | null;
  httpPort: number;
  hasSnmpCredentials: boolean;
  hasHttpCredentials: boolean;
}
