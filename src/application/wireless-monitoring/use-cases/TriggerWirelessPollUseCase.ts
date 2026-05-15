import { Result } from 'domain/shared/core';
import { UseCase } from 'application/shared/core';
import { ILogger } from 'application/shared/interfaces';
import { TriggerPollRequestDTO } from '../dtos/TriggerPollRequestDTO';
import { PollWirelessDeviceResponseDTO } from '../dtos/PollWirelessDeviceResponseDTO';
import { IWirelessPollOrchestrator } from '../interfaces';

/**
 * TriggerWirelessPollUseCase
 *
 * Initiates an on-demand (forced) wireless poll for a given device.
 * Delegates execution to IWirelessPollOrchestrator so it remains decoupled
 * from PollWirelessDeviceUseCase (use cases must not call other use cases directly).
 *
 * The DI container registers PollWirelessDeviceUseCase as the implementation
 * of IWirelessPollOrchestrator.
 */
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
