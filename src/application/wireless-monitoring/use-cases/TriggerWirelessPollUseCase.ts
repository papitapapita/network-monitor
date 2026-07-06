import { Result } from 'domain/shared/core';
import { UseCase } from 'application/shared/core';
import { ILogger } from 'application/shared/interfaces';
import {
  TriggerPollRequestDTO,
  PollWirelessDeviceResponseDTO
} from '../dtos';
import { IWirelessPollOrchestrator } from '../interfaces';

// Delegates to IWirelessPollOrchestrator (bound to PollWirelessDeviceUseCase in the DI
// container) so this use case never calls another use case directly.
export class TriggerWirelessPollUseCase extends UseCase<
  TriggerPollRequestDTO,
  PollWirelessDeviceResponseDTO
> {
  constructor(
    private readonly pollOrchestrator: IWirelessPollOrchestrator,
    logger: ILogger
  ) {
    super(logger, 'TriggerWirelessPollUseCase');
  }

  protected async beforeExecute(
    request: TriggerPollRequestDTO
  ): Promise<Result<void> | null> {
    if (!request.deviceId?.trim()) {
      return Result.fail('Device ID is required');
    }
    return null;
  }

  protected async executeImpl(
    request: TriggerPollRequestDTO
  ): Promise<Result<PollWirelessDeviceResponseDTO>> {
    return this.pollOrchestrator.execute({
      deviceId: request.deviceId,
      forceExecution: true
    });
  }
}
