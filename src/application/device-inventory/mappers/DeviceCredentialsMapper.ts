import { DeviceCredentials } from '../interfaces';
import { DeviceCredentialsResponseDTO } from '../dtos';

export class DeviceCredentialsMapper {
  // Secrets are masked rather than omitted so callers can distinguish
  // "credential is set" from "credential is absent" without exposing values.
  public static toDTO(
    deviceId: string,
    c: DeviceCredentials
  ): DeviceCredentialsResponseDTO {
    const hasSnmpCredentials =
      c.snmpVersion === 2
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
}
