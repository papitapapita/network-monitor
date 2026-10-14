import { IHandle } from 'domain/shared/interfaces';
import { ContractedServiceCancelledEvent } from 'domain/customers/events';
import { ILogger } from 'application/shared/interfaces';
import { RetireDeviceAfterCancellationUseCase } from '../use-cases/RetireDeviceAfterCancellationUseCase';

// Failures are only logged: the cancellation already happened and the device
// is already free, so an operator can still retire it by hand.
export class ContractedServiceCancelledDeviceHandler
  implements IHandle<ContractedServiceCancelledEvent>
{
  constructor(
    private readonly retireDeviceUseCase: RetireDeviceAfterCancellationUseCase,
    private readonly logger: ILogger
  ) {}

  async handle(
    event: ContractedServiceCancelledEvent
  ): Promise<void> {
    if (event.releasedDeviceId === null) return;

    const contractedServiceId = event.aggregateId.toString();
    const deviceId = event.releasedDeviceId.toString();

    try {
      const result = await this.retireDeviceUseCase.execute({
        deviceId
      });
      if (result.isFailure) {
        this.logger.warn(
          'ContractedServiceCancelledDeviceHandler: device not retired',
          { contractedServiceId, deviceId, error: result.error }
        );
        return;
      }
      if (result.value.outcome !== 'RETIRED') {
        this.logger.info(
          'ContractedServiceCancelledDeviceHandler: device left as is',
          {
            contractedServiceId,
            deviceId,
            outcome: result.value.outcome
          }
        );
      }
    } catch (error) {
      this.logger.error(
        'ContractedServiceCancelledDeviceHandler: unexpected error',
        error instanceof Error ? error : new Error(String(error)),
        { contractedServiceId, deviceId }
      );
    }
  }
}
