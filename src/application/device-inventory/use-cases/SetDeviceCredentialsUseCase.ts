import { Result } from 'domain/shared/core';
import { DeviceId } from 'domain/shared';
import { IDeviceRepository } from 'domain/device-inventory/repository';
import { UseCase } from 'application/shared/core';
import { ILogger } from 'application/shared/interfaces';
import { IDeviceCredentialsRepository } from '../interfaces';
import {
  SetDeviceCredentialsRequestDTO,
  DeviceCredentialsResponseDTO
} from '../dtos';
import { DeviceCredentialsMapper } from '../mappers';

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
      !request.httpUsername?.trim() ||
      !request.httpPassword?.trim()
    ) {
      return Result.fail(
        'httpUsername and httpPassword are required'
      );
    }

    // SNMP is not collected by any client today — nothing polls it yet. The
    // rules below still hold for callers that do send it, so the capability
    // survives untouched until SNMP metrics land.
    const hasSnmpInput = [
      request.snmpVersion,
      request.snmpCommunity,
      request.snmpV3AuthUser,
      request.snmpV3AuthProto,
      request.snmpV3AuthKey,
      request.snmpV3PrivProto,
      request.snmpV3PrivKey
    ].some((field) => field !== undefined && field !== null);

    if (hasSnmpInput) {
      if (request.snmpVersion === undefined) {
        return Result.fail(
          'snmpVersion is required when SNMP credentials are provided'
        );
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
          return Result.fail(
            'snmpV3AuthProto is required for SNMPv3'
          );
        }
        if (!request.snmpV3AuthKey?.trim()) {
          return Result.fail('snmpV3AuthKey is required for SNMPv3');
        }
        if (
          request.snmpV3PrivProto &&
          !request.snmpV3PrivKey?.trim()
        ) {
          return Result.fail(
            'snmpV3PrivKey is required when snmpV3PrivProto is set'
          );
        }
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

    const existingResult =
      await this.credentialsRepo.findByDeviceId(deviceId);
    if (existingResult.isFailure) {
      return this.fail(
        `Failed to look up credentials: ${existingResult.error}`
      );
    }

    const credentials = DeviceCredentialsMapper.extractCreateData(
      request,
      existingResult.value
    );

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
      DeviceCredentialsMapper.toDTO(
        request.deviceId.trim(),
        credentials
      )
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
