// ============================================================================
// CREDENTIAL TYPES
// ============================================================================

/**
 * Base credential interface
 */
export interface BaseCredential {
  type:
    | 'snmp_v2'
    | 'snmp_v3'
    | 'http_basic'
    | 'http_bearer'
    | 'api_key'
    | 'custom';
}

/**
 * SNMPv2 credentials
 */
export interface SNMPv2Credential extends BaseCredential {
  type: 'snmp_v2';
  community: string;
}

/**
 * SNMPv3 security levels
 */
export enum SNMPv3SecurityLevel {
  NO_AUTH_NO_PRIV = 'noAuthNoPriv',
  AUTH_NO_PRIV = 'authNoPriv',
  AUTH_PRIV = 'authPriv'
}

/**
 * SNMPv3 authentication protocols
 */
export enum SNMPv3AuthProtocol {
  MD5 = 'MD5',
  SHA = 'SHA',
  SHA224 = 'SHA-224',
  SHA256 = 'SHA-256',
  SHA384 = 'SHA-384',
  SHA512 = 'SHA-512'
}

/**
 * SNMPv3 privacy protocols
 */
export enum SNMPv3PrivProtocol {
  DES = 'DES',
  AES = 'AES',
  AES192 = 'AES-192',
  AES256 = 'AES-256'
}

/**
 * SNMPv3 credentials
 */
export interface SNMPv3Credential extends BaseCredential {
  type: 'snmp_v3';
  username: string;
  securityLevel: SNMPv3SecurityLevel;
  authProtocol?: SNMPv3AuthProtocol;
  authPassword?: string;
  privProtocol?: SNMPv3PrivProtocol;
  privPassword?: string;
  contextName?: string;
  contextEngineId?: string;
}

/**
 * HTTP Basic Authentication credentials
 */
export interface HTTPBasicCredential extends BaseCredential {
  type: 'http_basic';
  username: string;
  password: string;
}

/**
 * HTTP Bearer Token credentials
 */
export interface HTTPBearerCredential extends BaseCredential {
  type: 'http_bearer';
  token: string;
}

/**
 * API Key credentials
 */
export interface APIKeyCredential extends BaseCredential {
  type: 'api_key';
  key: string;
  header?: string; // Header name (default: 'X-API-Key')
}

/**
 * Custom credentials for vendor-specific implementations
 */
export interface CustomCredential extends BaseCredential {
  type: 'custom';
  data: Record<string, unknown>;
}

/**
 * Union type for all credential types
 */
export type DeviceCredential =
  | SNMPv2Credential
  | SNMPv3Credential
  | HTTPBasicCredential
  | HTTPBearerCredential
  | APIKeyCredential
  | CustomCredential;
