import { DeviceModelId } from '../../../domain/shared/ids';
import { IDeviceModelRepository } from '../../../domain/device-inventory/repository';
import { Result } from '../../../domain/shared/core';
import { UseCase } from '../../shared/core';
import { ILogger } from '../../shared/interfaces';
import { DeviceModelMapper } from '../mappers';
import { GetDeviceModelRequestDTO, DeviceModelResponseDTO } from '../dtos';

export class GetDeviceModelUseCase extends UseCase<
  GetDeviceModelRequestDTO,
  DeviceModelResponseDTO
> {
  constructor(
    private readonly deviceModelRepository: IDeviceModelRepository,
    logger: ILogger
  ) {
    super(logger, 'GetDeviceModelUseCase');
  }

  protected async beforeExecute(
    request: GetDeviceModelRequestDTO
  ): Promise<Result<void> | null> {
    if (!request.id || request.id.trim().length === 0) {
      return Result.fail('Device model ID is required');
    }
    return null;
  }

  protected async executeImpl(
    request: GetDeviceModelRequestDTO
  ): Promise<Result<DeviceModelResponseDTO>> {
    const idResult = DeviceModelId.parse(request.id.trim());
    if (idResult.isFailure) {
      return this.fail<DeviceModelResponseDTO>(
        `Invalid device model ID: ${idResult.error}`
      );
    }

    const findResult = await this.deviceModelRepository.findById(idResult.value);
    if (findResult.isFailure) {
      return this.fail<DeviceModelResponseDTO>(findResult.error!);
    }

    if (findResult.value === null) {
      return this.fail<DeviceModelResponseDTO>(
        `Device model not found: ${request.id}`
      );
    }

    return this.ok(DeviceModelMapper.toDTO(findResult.value));
  }
}
