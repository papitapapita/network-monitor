import { IDeviceModelRepository } from '../../../domain/device-inventory/repository';
import { Result } from '../../../domain/shared/core';
import { UseCase } from '../../shared/core';
import { ILogger } from '../../shared/interfaces';
import { DeviceModelMapper } from '../mappers';
import {
  ListDeviceModelsQueryDTO,
  DeviceModelListResponseDTO
} from '../dtos';

export class ListDeviceModelsUseCase extends UseCase<
  ListDeviceModelsQueryDTO,
  DeviceModelListResponseDTO
> {
  private static readonly DEFAULT_LIMIT = 20;
  private static readonly MAX_LIMIT = 100;

  constructor(
    private readonly deviceModelRepository: IDeviceModelRepository,
    logger: ILogger
  ) {
    super(logger, 'ListDeviceModelsUseCase');
  }

  protected async executeImpl(
    request: ListDeviceModelsQueryDTO
  ): Promise<Result<DeviceModelListResponseDTO>> {
    const limit = Math.min(
      request.limit ?? ListDeviceModelsUseCase.DEFAULT_LIMIT,
      ListDeviceModelsUseCase.MAX_LIMIT
    );
    const offset = request.offset ?? 0;

    const recordsResult = await this.deviceModelRepository.findAll(
      limit,
      offset
    );
    if (recordsResult.isFailure) {
      return this.fail<DeviceModelListResponseDTO>(
        recordsResult.error!
      );
    }

    const countResult = await this.deviceModelRepository.count();
    if (countResult.isFailure) {
      return this.fail<DeviceModelListResponseDTO>(
        countResult.error!
      );
    }

    return this.ok<DeviceModelListResponseDTO>(
      DeviceModelMapper.toListDTO(
        recordsResult.value,
        countResult.value,
        limit,
        offset
      )
    );
  }
}
