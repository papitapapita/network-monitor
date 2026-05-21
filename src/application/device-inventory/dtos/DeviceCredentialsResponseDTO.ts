/**
 * Response DTO for device credentials.
 *
 * Sensitive fields (passwords, community strings, private keys) are NEVER
 * returned in plain text. A masked placeholder indicates whether a value is
 * stored; null means no value is configured.
 *
 * Convenience flags (hasSnmpCredentials, hasHttpCredentials) let consumers
 * check capability without needing to inspect individual masked fields.
 */
export interface DeviceCredentialsResponseDTO {
  deviceId: string;

  snmpVersion: 1 | 2 | 3;

  /** Masked — "***" if a community string is stored, null otherwise. */
  snmpCommunity: '***' | null;

  snmpV3AuthUser: string | null;
  snmpV3AuthProto: 'MD5' | 'SHA' | null;

  /** Masked — "***" if an auth key is stored, null otherwise. */
  snmpV3AuthKey: '***' | null;

  snmpV3PrivProto: 'DES' | 'AES' | null;

  /** Masked — "***" if a privacy key is stored, null otherwise. */
  snmpV3PrivKey: '***' | null;

  snmpPort: number;

  httpUsername: string | null;

  /** Masked — "***" if a password is stored, null otherwise. */
  httpPassword: '***' | null;

  httpPort: number;

  /** True when all fields required to perform an SNMP poll are present. */
  hasSnmpCredentials: boolean;

  /** True when HTTP username and password are both stored. */
  hasHttpCredentials: boolean;
}
