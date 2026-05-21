import { Result } from 'domain/shared/core';
import { DeviceId } from 'domain/shared';
import { IDeviceRepository } from 'domain/device-inventory/repository';
import { UseCase } from '../../shared/core';
import { ILogger } from '../../shared/interfaces';
import {
  IDeviceCredentialsRepository,
  DeviceCredentials
} from '../interfaces/IDeviceCredentialsRepository';
import { SetDeviceCredentialsRequestDTO } from '../dtos/SetDeviceCredentialsRequestDTO';
import { DeviceCredentialsResponseDTO } from '../dtos/DeviceCredentialsResponseDTO';
import { maskCredentials } from '../mappers/DeviceCredentialsMapper';

export class SetDeviceCredentialsUseCase extends UseCase<
  SetDeviceCredentialsRequestDTO,
  DeviceCredentialsResponseDTO
> {
  constructor(
    private readonly deviceRepo: IDeviceRepository,
    private readonly credentialsRepo: IDeviceCredentialsRepository,
    logger: ILogger
  ) {
    super(logger, 'SetDeviceCredentialsUseCase');
  }

  protected async beforeExecute(
    request: SetDeviceCredentialsRequestDTO
  ): Promise<Result<void> | null> {
    if (!request.deviceId?.trim()) {
      return Result.fail('deviceId is required');
    }

    if (
      request.snmpVersion !== 1 &&
      request.snmpVersion !== 2 &&
      request.snmpVersion !== 3
    ) {
      return Result.fail('snmpVersion must be 1, 2, or 3');
    }

    if (
      (request.snmpVersion === 1 || request.snmpVersion === 2) &&
      !request.snmpCommunity?.trim()
    ) {
      return Result.fail(
        'snmpCommunity is required for SNMPv1 and SNMPv2'
      );
    }

    if (request.snmpVersion === 3) {
      if (!request.snmpV3AuthUser?.trim()) {
        return Result.fail('snmpV3AuthUser is required for SNMPv3');
      }
      if (!request.snmpV3AuthProto) {
        return Result.fail('snmpV3AuthProto is required for SNMPv3');
      }
      if (!request.snmpV3AuthKey?.trim()) {
        return Result.fail('snmpV3AuthKey is required for SNMPv3');
      }
      if (request.snmpV3PrivProto && !request.snmpV3PrivKey?.trim()) {
        return Result.fail(
          'snmpV3PrivKey is required when snmpV3PrivProto is set'
        );
      }
    }

    if (
      request.snmpPort !== undefined &&
      (request.snmpPort < 1 || request.snmpPort > 65535)
    ) {
      return Result.fail('snmpPort must be between 1 and 65535');
    }

    if (
      request.httpPort !== undefined &&
      (request.httpPort < 1 || request.httpPort > 65535)
    ) {
      return Result.fail('httpPort must be between 1 and 65535');
    }

    return null;
  }

  protected async executeImpl(
    request: SetDeviceCredentialsRequestDTO
  ): Promise<Result<DeviceCredentialsResponseDTO>> {
    const deviceIdResult = DeviceId.parse(request.deviceId.trim());
    if (deviceIdResult.isFailure) {
      return this.fail(`Invalid deviceId: ${deviceIdResult.error}`);
    }
    const deviceId = deviceIdResult.value;

    const deviceResult = await this.deviceRepo.findById(deviceId);
    if (deviceResult.isFailure) {
      return this.fail(
        `Failed to look up device: ${deviceResult.error}`
      );
    }
    if (!deviceResult.value) {
      return this.fail('Device not found');
    }

    const credentials: DeviceCredentials = {
      snmpVersion: request.snmpVersion,
      snmpCommunity: request.snmpCommunity ?? null,
      snmpV3AuthUser: request.snmpV3AuthUser ?? null,
      snmpV3AuthProto: request.snmpV3AuthProto ?? null,
      snmpV3AuthKey: request.snmpV3AuthKey ?? null,
      snmpV3PrivProto: request.snmpV3PrivProto ?? null,
      snmpV3PrivKey: request.snmpV3PrivKey ?? null,
      httpUsername: request.httpUsername ?? null,
      httpPassword: request.httpPassword ?? null,
      snmpPort: request.snmpPort ?? 161,
      httpPort: request.httpPort ?? 80
    };

    const saveResult = await this.credentialsRepo.save(
      deviceId,
      credentials
    );
    if (saveResult.isFailure) {
      return this.fail(
        `Failed to save credentials: ${saveResult.error}`
      );
    }

    return this.ok(
      maskCredentials(request.deviceId.trim(), credentials)
    );
  }

  protected sanitizeForLogging(data: unknown): unknown {
    if (!data || typeof data !== 'object') return data;
    const sanitized = { ...(data as Record<string, unknown>) };
    for (const key of [
      'snmpCommunity',
      'snmpV3AuthKey',
      'snmpV3PrivKey',
      'httpPassword'
    ]) {
      if (key in sanitized) sanitized[key] = '***';
    }
    return sanitized;
  }
}
