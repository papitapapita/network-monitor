import { Result } from 'domain/shared/core';
import { DeviceId } from 'domain/shared/ids';
import { RadioHostname } from 'domain/wireless-monitoring';
import { UseCase } from 'application/shared/core';
import { ILogger } from 'application/shared/interfaces';
import {
  IRadioSettingsGateway,
  RADIO_SETTINGS_FAILURES
} from '../interfaces';
import {
  RenameRadioRequestDTO,
  RenameRadioResponseDTO
} from '../dtos';
import { RadioTargetSources, resolveRadioTarget } from '../services';

// Changes the name the radio gives itself, not the device's name in the
// inventory (WLS-224). The next poll reads the new name back.
export class RenameRadioUseCase extends UseCase<
  RenameRadioRequestDTO,
  RenameRadioResponseDTO
> {
  constructor(
    private readonly sources: RadioTargetSources,
    private readonly gateway: IRadioSettingsGateway,
    logger: ILogger,
    private readonly clock: () => Date = () => new Date()
  ) {
    super(logger, 'RenameRadioUseCase');
  }

  protected async beforeExecute(
    request: RenameRadioRequestDTO
  ): Promise<Result<void> | null> {
    if (!request.deviceId?.trim()) {
      return Result.fail('Device ID is required');
    }
    return null;
  }

  protected async executeImpl(
    request: RenameRadioRequestDTO
  ): Promise<Result<RenameRadioResponseDTO>> {
    const deviceId = DeviceId.parse(request.deviceId.trim());
    if (deviceId.isFailure) {
      return this.fail(`Invalid device ID: ${deviceId.error}`);
    }

    const hostname = RadioHostname.create(request.hostname);
    if (hostname.isFailure) {
      return this.fail(hostname.error);
    }

    const resolved = await resolveRadioTarget(
      this.sources,
      deviceId.value
    );
    if (resolved.isFailure) {
      return this.fail(`Cannot rename the radio — ${resolved.error}`);
    }
    const { reach, target } = resolved.value;

    const answer = await this.gateway.setHostname(
      reach,
      target,
      hostname.value.value
    );
    if (!answer.ok) {
      return this.fail(
        `Cannot rename the radio — ${RADIO_SETTINGS_FAILURES[answer.reason]}: ${answer.error}`
      );
    }

    this.logger.info('Radio renamed', {
      deviceId: deviceId.value.toString(),
      hostname: hostname.value.value,
      renamedBy: request.renamedBy
    });

    return this.ok({
      deviceId: deviceId.value.toString(),
      hostname: hostname.value.value,
      renamedAt: this.clock().toISOString()
    });
  }
}
