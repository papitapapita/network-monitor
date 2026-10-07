import { Result } from 'domain/shared/core';
import { DeviceId } from 'domain/shared/ids';
import {
  IConfigBackupRepository,
  IDeviceBackupStateRepository
} from 'domain/device-backups';
import { UseCase } from 'application/shared/core';
import { ILogger } from 'application/shared/interfaces';
import {
  DeviceBackupsResponseDTO,
  ListDeviceBackupsRequestDTO
} from '../dtos';
import { IBackupTargetsQuery } from '../interfaces';
import { ConfigBackupMapper } from '../mappers';

export class ListDeviceBackupsUseCase extends UseCase<
  ListDeviceBackupsRequestDTO,
  DeviceBackupsResponseDTO
> {
  constructor(
    private readonly targets: IBackupTargetsQuery,
    private readonly backups: IConfigBackupRepository,
    private readonly states: IDeviceBackupStateRepository,
    logger: ILogger
  ) {
    super(logger, 'ListDeviceBackupsUseCase');
  }

  protected async executeImpl(
    request: ListDeviceBackupsRequestDTO
  ): Promise<Result<DeviceBackupsResponseDTO>> {
    const deviceId = DeviceId.parse(request.deviceId);
    if (deviceId.isFailure)
      return this.fail(`Invalid device ID: ${deviceId.error}`);

    const candidate = await this.targets.findByDevice(deviceId.value);
    if (candidate.isFailure) return Result.fail(candidate.error);
    if (!candidate.value) return this.fail('Device not found');

    const [state, backups] = await Promise.all([
      this.states.findByDevice(deviceId.value),
      this.backups.listByDevice(deviceId.value)
    ]);
    if (state.isFailure) return Result.fail(state.error);
    if (backups.isFailure) return Result.fail(backups.error);

    return this.ok({
      deviceId: deviceId.value.toString(),
      state: state.value
        ? ConfigBackupMapper.stateToDTO(state.value)
        : null,
      backups: backups.value.map((b) => ConfigBackupMapper.toDTO(b))
    });
  }
}
