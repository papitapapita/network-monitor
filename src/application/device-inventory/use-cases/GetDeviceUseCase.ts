import { DeviceId } from 'domain/shared/ids';
import { IDeviceRepository } from 'domain/device-inventory/repository';
import { Result } from 'domain/shared/core';
import { UseCase } from 'application/shared/core';
import { ILogger } from 'application/shared/interfaces';
import { GetDeviceRequestDTO, DeviceResponseDTO } from '../dtos';
import { DeviceMapper } from '../mappers';

export class GetDeviceUseCase extends UseCase<
  GetDeviceRequestDTO,
  DeviceResponseDTO
> {
  constructor(
    private readonly deviceRepository: IDeviceRepository,
    logger: ILogger
  ) {
    super(logger, 'GetDeviceUseCase');
  }

  protected async beforeExecute(
    request: GetDeviceRequestDTO
  ): Promise<Result<void> | null> {
    if (!request.id || request.id.trim().length === 0) {
      return Result.fail('Device ID is required');
    }

    return null;
  }

  protected async executeImpl(
    request: GetDeviceRequestDTO
  ): Promise<Result<DeviceResponseDTO>> {
    const deviceIdResult = DeviceId.parse(request.id.trim());
    if (deviceIdResult.isFailure) {
      return this.fail<DeviceResponseDTO>(
        `Invalid device ID: ${deviceIdResult.error}`
      );
    }

    const findResult = await this.deviceRepository.findById(
      deviceIdResult.value
    );

    if (findResult.isFailure) {
      return this.fail<DeviceResponseDTO>(findResult.error!);
    }

    const device = findResult.value;

    if (device === null) {
      return this.fail<DeviceResponseDTO>(
        `Device not found: ${request.id}`
      );
    }

    return this.ok(DeviceMapper.toDTO(device));
  }
}
