import { DeviceCredentials } from '../interfaces';
import {
  DeviceCredentialsResponseDTO,
  SetDeviceCredentialsRequestDTO
} from '../dtos';

export class DeviceCredentialsMapper {
  public static toDTO(
    deviceId: string,
    c: DeviceCredentials
  ): DeviceCredentialsResponseDTO {
    // Secrets are masked rather than omitted so callers can distinguish
    // "credential is set" from "credential is absent" without exposing values.
    // hasSnmpCredentials varies by version: v1/v2 need community, v3 needs user+key.
    const hasSnmpCredentials =
      c.snmpVersion === 1 || c.snmpVersion === 2
        ? !!c.snmpCommunity
        : !!(c.snmpV3AuthUser && c.snmpV3AuthKey);

    return {
      deviceId,
      snmpVersion: c.snmpVersion,
      snmpCommunity: c.snmpCommunity ? '***' : null,
      snmpV3AuthUser: c.snmpV3AuthUser,
      snmpV3AuthProto: c.snmpV3AuthProto,
      snmpV3AuthKey: c.snmpV3AuthKey ? '***' : null,
      snmpV3PrivProto: c.snmpV3PrivProto,
      snmpV3PrivKey: c.snmpV3PrivKey ? '***' : null,
      snmpPort: c.snmpPort,
      httpUsername: c.httpUsername,
      httpPassword: c.httpPassword ? '***' : null,
      httpPort: c.httpPort,
      hasSnmpCredentials,
      hasHttpCredentials: !!(c.httpUsername && c.httpPassword)
    };
  }

  // HTTP fields are replaced outright. SNMP fields are carried forward from
  // the stored row when the request omits them: no client collects SNMP today,
  // so a plain HTTP save must not silently wipe keys that would be tedious to
  // re-enter. Passing null for an SNMP field still clears it.
  public static extractCreateData(
    dto: SetDeviceCredentialsRequestDTO,
    existing?: DeviceCredentials | null
  ): DeviceCredentials {
    const keep = <T>(
      incoming: T | null | undefined,
      stored: T | null | undefined
    ): T | null =>
      incoming !== undefined ? incoming : (stored ?? null);

    return {
      snmpVersion: dto.snmpVersion ?? existing?.snmpVersion ?? 1,
      snmpCommunity: keep(dto.snmpCommunity, existing?.snmpCommunity),
      snmpV3AuthUser: keep(
        dto.snmpV3AuthUser,
        existing?.snmpV3AuthUser
      ),
      snmpV3AuthProto: keep(
        dto.snmpV3AuthProto,
        existing?.snmpV3AuthProto
      ),
      snmpV3AuthKey: keep(dto.snmpV3AuthKey, existing?.snmpV3AuthKey),
      snmpV3PrivProto: keep(
        dto.snmpV3PrivProto,
        existing?.snmpV3PrivProto
      ),
      snmpV3PrivKey: keep(dto.snmpV3PrivKey, existing?.snmpV3PrivKey),
      snmpPort: dto.snmpPort ?? existing?.snmpPort ?? 161,
      httpUsername: dto.httpUsername ?? null,
      httpPassword: dto.httpPassword ?? null,
      httpPort: dto.httpPort ?? 443
    };
  }
}
