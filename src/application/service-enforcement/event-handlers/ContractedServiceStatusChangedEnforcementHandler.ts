import { IHandle } from 'domain/shared/interfaces';
import { ContractedServiceStatusChangedEvent } from 'domain/customers/events';
import { ContractedServiceStatus } from 'domain/customers/enums';
import { ILogger } from 'application/shared/interfaces';
import {
  EnforceSuspensionUseCase,
  ReleaseSuspensionUseCase
} from '../use-cases';

// Failures are only logged: the reconciliation orchestrator is the
// safety net that converges router state on its next tick.
export class ContractedServiceStatusChangedEnforcementHandler
  implements IHandle<ContractedServiceStatusChangedEvent>
{
  constructor(
    private readonly enforceSuspensionUseCase: EnforceSuspensionUseCase,
    private readonly releaseSuspensionUseCase: ReleaseSuspensionUseCase,
    private readonly logger: ILogger
  ) {}

  async handle(
    event: ContractedServiceStatusChangedEvent
  ): Promise<void> {
    const contractedServiceId = event.aggregateId.toString();

    try {
      if (
        event.newStatus === ContractedServiceStatus.SUSPENDED &&
        event.previousStatus !== ContractedServiceStatus.SUSPENDED
      ) {
        const result = await this.enforceSuspensionUseCase.execute({
          contractedServiceId
        });
        if (result.isFailure) {
          this.logger.error(
            'ContractedServiceStatusChangedEnforcementHandler: enforce failed',
            undefined,
            { contractedServiceId, error: result.error }
          );
        }
        return;
      }

      if (
        event.previousStatus === ContractedServiceStatus.SUSPENDED &&
        event.newStatus !== ContractedServiceStatus.SUSPENDED
      ) {
        const result = await this.releaseSuspensionUseCase.execute({
          contractedServiceId
        });
        if (result.isFailure) {
          this.logger.error(
            'ContractedServiceStatusChangedEnforcementHandler: release failed',
            undefined,
            { contractedServiceId, error: result.error }
          );
        }
      }
    } catch (error) {
      this.logger.error(
        'ContractedServiceStatusChangedEnforcementHandler: unexpected error',
        error instanceof Error ? error : new Error(String(error)),
        { contractedServiceId }
      );
    }
  }
}
