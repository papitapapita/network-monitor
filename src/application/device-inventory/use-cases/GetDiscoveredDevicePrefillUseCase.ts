import { Result } from 'domain/shared/core';
import { DiscoveredDeviceId } from 'domain/shared/ids';
import { IDiscoveredDeviceRepository } from 'domain/device-inventory/repository';
import { UseCase } from 'application/shared/core';
import { ILogger } from 'application/shared/interfaces';
import {
  DiscoveredDeviceIdRequestDTO,
  DiscoveredDevicePrefillDTO
} from '../dtos';
import { IDiscoveryPrefillQuery } from '../interfaces';
import { DISCOVERED_DEVICE_NOT_FOUND } from './IgnoreDiscoveredDeviceUseCase';

// DEV-209: turns a suggestion into a create-device form already filled in.
export class GetDiscoveredDevicePrefillUseCase extends UseCase<
  DiscoveredDeviceIdRequestDTO,
  DiscoveredDevicePrefillDTO
> {
  constructor(
    private readonly repository: IDiscoveredDeviceRepository,
    private readonly query: IDiscoveryPrefillQuery,
    logger: ILogger
  ) {
    super(logger, 'GetDiscoveredDevicePrefillUseCase');
  }

  protected async executeImpl(
    request: DiscoveredDeviceIdRequestDTO
  ): Promise<Result<DiscoveredDevicePrefillDTO>> {
    const idResult = DiscoveredDeviceId.parse(request.id);
    if (idResult.isFailure) {
      return this.fail(
        `Invalid discovered device ID: ${idResult.error}`
      );
    }

    const found = await this.repository.findById(idResult.value);
    if (found.isFailure) {
      return this.fail(
        `Failed to load discovered device: ${found.error}`
      );
    }
    if (found.value === null)
      return this.fail(DISCOVERED_DEVICE_NOT_FOUND);
    const device = found.value;

    const accessPoint = device.accessPointId
      ? await this.query.findAccessPoint(device.accessPointId)
      : Result.ok(null);
    if (accessPoint.isFailure) {
      return this.fail(
        `Failed to load the access point: ${accessPoint.error}`
      );
    }

    const model = device.model
      ? await this.query.guessModel(device.model)
      : Result.ok(null);
    if (model.isFailure) {
      return this.fail(`Failed to guess the model: ${model.error}`);
    }

    const ap = accessPoint.value;
    return this.ok({
      name: device.hostname,
      macAddress: device.macAddress,
      ipAddress: device.ipAddress,
      deviceModelId: model.value?.id ?? null,
      deviceModelName: model.value?.model ?? null,
      category: device.accessPointId ? 'WIRELESS_CPE' : null,
      upstreamDeviceId: ap?.deviceId ?? null,
      ...(ap ? { agentId: ap.agentId } : {})
    });
  }
}
