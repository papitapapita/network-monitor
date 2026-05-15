import { Result } from 'domain/shared/core';
import { PollWirelessDeviceRequestDTO } from '../dtos/PollWirelessDeviceRequestDTO';
import { PollWirelessDeviceResponseDTO } from '../dtos/PollWirelessDeviceResponseDTO';

/**
 * Application-layer abstraction for executing a wireless device poll.
 *
 * Used by TriggerWirelessPollUseCase so it does not couple directly to
 * PollWirelessDeviceUseCase (use cases must not call other use cases).
 * The infrastructure DI container registers PollWirelessDeviceUseCase as the
 * implementation of this interface.
 */
export interface IWirelessPollOrchestrator {
  execute(request: PollWirelessDeviceRequestDTO): Promise<Result<PollWirelessDeviceResponseDTO>>;
}
