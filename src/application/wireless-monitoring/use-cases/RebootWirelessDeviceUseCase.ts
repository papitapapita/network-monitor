import { Result } from 'domain/shared/core';
import { DeviceId } from 'domain/shared';
import { IWirelessDeviceConfigRepository } from 'domain/wireless-monitoring';
import { UseCase } from 'application/shared/core';
import { ILogger } from 'application/shared/interfaces';
import {
  HttpCredentials,
  IDeviceCredentialsRepository,
  IWirelessDeviceRebooter
} from '../interfaces';
import {
  RebootWirelessDeviceRequestDTO,
  RebootWirelessDeviceResponseDTO
} from '../dtos';

export class RebootWirelessDeviceUseCase extends UseCase<
  RebootWirelessDeviceRequestDTO,
  RebootWirelessDeviceResponseDTO
> {
  constructor(
    private readonly wirelessDeviceConfigRepo: IWirelessDeviceConfigRepository,
    private readonly credentialsRepo: IDeviceCredentialsRepository,
    private readonly rebooter: IWirelessDeviceRebooter,
    logger: ILogger
  ) {
    super(logger, 'RebootWirelessDeviceUseCase');
  }

  protected async beforeExecute(
    request: RebootWirelessDeviceRequestDTO
  ): Promise<Result<void> | null> {
    if (!request.deviceId?.trim()) {
      return Result.fail('Device ID is required');
    }
    return null;
  }

  protected async executeImpl(
    request: RebootWirelessDeviceRequestDTO
  ): Promise<Result<RebootWirelessDeviceResponseDTO>> {
    const deviceIdResult = DeviceId.parse(request.deviceId);
    if (deviceIdResult.isFailure) {
      return this.fail(`Invalid device ID: ${deviceIdResult.error}`);
    }
    const deviceId = deviceIdResult.value;
    const now = new Date();

    const configResult =
      await this.wirelessDeviceConfigRepo.findByDeviceId(deviceId);
    if (configResult.isFailure) {
      return this.fail(
        `Failed to load wireless polling config: ${configResult.error}`
      );
    }
    const config = configResult.value;
    if (!config) {
      return this.fail(
        'No wireless polling configuration found for device'
      );
    }

    if (!config.ipAddress) {
      return this.fail('Device has no IP address configured');
    }

    const credentialsResult =
      await this.credentialsRepo.findByDeviceId(deviceId);
    if (credentialsResult.isFailure) {
      return this.fail(
        `Failed to load credentials: ${credentialsResult.error}`
      );
    }
    const credentials = credentialsResult.value;
    if (!credentials) {
      return this.fail('Credentials not configured for device');
    }

    const ipAddress = config.ipAddress.value;
    const httpCreds: HttpCredentials = {
      username: credentials.httpUsername ?? '',
      password: credentials.httpPassword ?? '',
      port: credentials.httpPort
    };

    this.logger.info(
      '[RebootWirelessDeviceUseCase] rebooting device',
      {
        deviceId: deviceId.toString(),
        ip: ipAddress,
        port: httpCreds.port
      }
    );

    const rebootResult = await this.rebooter.reboot(
      ipAddress,
      httpCreds
    );
    if (rebootResult.isFailure) {
      return this.fail(
        `Failed to reboot device: ${rebootResult.error}`
      );
    }

    return this.ok({
      deviceId: request.deviceId,
      requestedAt: now.toISOString()
    });
  }
}
