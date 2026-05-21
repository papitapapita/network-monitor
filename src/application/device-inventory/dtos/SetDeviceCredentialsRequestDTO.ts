/**
 * Request DTO for creating or replacing device network access credentials.
 *
 * Used By: SetDeviceCredentialsUseCase
 * API Endpoint: PUT /api/devices/:id/credentials
 *
 * Business Rules:
 * - The device must already exist.
 * - snmpVersion is required. For v2, snmpCommunity must be provided.
 *   For v3, snmpV3AuthUser and snmpV3AuthProto are required.
 * - Providing HTTP credentials requires at least httpPassword.
 * - Calling this endpoint replaces any previously stored credentials in full.
 * - Sensitive fields (passwords, community strings, private keys) are stored
 *   encrypted at rest using AES-256-GCM.
 *
 * Authorization: This endpoint modifies security-critical data.
 * Ensure it is protected by authentication middleware in production.
 */
export interface SetDeviceCredentialsRequestDTO {
  deviceId: string;

  // ===================================
  // SNMP
  // ===================================

  /** SNMP protocol version. Required. Use 1 for legacy devices (e.g. AirOS 8). */
  snmpVersion: 1 | 2 | 3;

  /** SNMPv1/v2c community string. Required when snmpVersion is 1 or 2. */
  snmpCommunity?: string | null;

  /** SNMPv3 security user name. Required when snmpVersion is 3. */
  snmpV3AuthUser?: string | null;

  /** SNMPv3 authentication protocol. Required when snmpVersion is 3. */
  snmpV3AuthProto?: 'MD5' | 'SHA' | null;

  /** SNMPv3 authentication key. Required when snmpVersion is 3. */
  snmpV3AuthKey?: string | null;

  /** SNMPv3 privacy protocol. Optional (enables encryption when provided). */
  snmpV3PrivProto?: 'DES' | 'AES' | null;

  /** SNMPv3 privacy key. Required when snmpV3PrivProto is set. */
  snmpV3PrivKey?: string | null;

  /** SNMP UDP port. Defaults to 161. */
  snmpPort?: number;

  // ===================================
  // HTTP (Ubiquiti AirOS management API)
  // ===================================

  /** HTTP management username. */
  httpUsername?: string | null;

  /** HTTP management password. */
  httpPassword?: string | null;

  /** HTTP management port. Defaults to 80. */
  httpPort?: number;
}
