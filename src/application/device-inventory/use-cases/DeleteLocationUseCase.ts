import { LocationId } from 'domain/shared/ids';
import {
  ILocationRepository,
  IDeviceRepository
} from 'domain/device-inventory/repository';
import { Result } from 'domain/shared/core';
import { UseCase } from 'application/shared/core';
import { ILogger } from 'application/shared/interfaces';
import { DeleteLocationRequestDTO } from '../dtos';

export class DeleteLocationUseCase extends UseCase<
  DeleteLocationRequestDTO,
  void
> {
  constructor(
    private readonly locationRepository: ILocationRepository,
    private readonly deviceRepository: IDeviceRepository,
    logger: ILogger
  ) {
    super(logger, 'DeleteLocationUseCase');
  }

  protected async beforeExecute(
    request: DeleteLocationRequestDTO
  ): Promise<Result<void> | null> {
    if (!request.id || request.id.trim().length === 0) {
      return Result.fail('Location ID is required');
    }
    return null;
  }

  protected async executeImpl(
    request: DeleteLocationRequestDTO
  ): Promise<Result<void>> {
    const idResult = LocationId.parse(request.id.trim());
    if (idResult.isFailure) {
      return this.fail(`Invalid location ID: ${idResult.error}`);
    }

    const locationId = idResult.value;

    const findResult =
      await this.locationRepository.findById(locationId);
    if (findResult.isFailure) {
      return this.fail(findResult.error!);
    }
    if (findResult.value === null) {
      return this.fail(`Location not found: ${request.id}`);
    }

    const devicesResult =
      await this.deviceRepository.findByLocation(locationId);
    if (devicesResult.isFailure) {
      return this.fail(devicesResult.error!);
    }
    if (devicesResult.value.length > 0) {
      return this.fail(
        `Cannot delete location: it has ${devicesResult.value.length} device(s) assigned. Reassign or remove those devices first.`
      );
    }

    const deleteResult =
      await this.locationRepository.delete(locationId);
    if (deleteResult.isFailure) {
      return this.fail(deleteResult.error!);
    }

    return this.ok(undefined);
  }
}
