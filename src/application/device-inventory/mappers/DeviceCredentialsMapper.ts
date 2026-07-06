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

  public static extractCreateData(dto: SetDeviceCredentialsRequestDTO) {
    return {
      snmpVersion: dto.snmpVersion ?? 1,
      snmpCommunity: dto.snmpCommunity ?? null,
      snmpV3AuthUser: dto.snmpV3AuthUser ?? null,
      snmpV3AuthProto: dto.snmpV3AuthProto ?? null,
      snmpV3AuthKey: dto.snmpV3AuthKey ?? null,
      snmpV3PrivProto: dto.snmpV3PrivProto ?? null,
      snmpV3PrivKey: dto.snmpV3PrivKey ?? null,
      snmpPort: dto.snmpPort ?? 161,
      httpUsername: dto.httpUsername ?? null,
      httpPassword: dto.httpPassword ?? null,
      httpPort: dto.httpPort ?? 443
    };
  }
}
