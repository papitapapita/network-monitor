import { IHandle } from 'domain/shared/interfaces';
import { ContractedServiceStatusChangedEvent } from 'domain/customers/events';
import { ContractedServiceStatus } from 'domain/customers/enums';
import { ILogger } from 'application/shared/interfaces';
import { SendSuspensionNoticeUseCase } from '../use-cases';

export class ContractedServiceSuspendedNotificationHandler
  implements IHandle<ContractedServiceStatusChangedEvent>
{
  constructor(
    private readonly sendSuspensionNoticeUseCase: SendSuspensionNoticeUseCase,
    private readonly logger: ILogger
  ) {}

  async handle(
    event: ContractedServiceStatusChangedEvent
  ): Promise<void> {
    if (
      event.newStatus !== ContractedServiceStatus.SUSPENDED ||
      event.previousStatus === ContractedServiceStatus.SUSPENDED
    ) {
      return;
    }

    try {
      const result = await this.sendSuspensionNoticeUseCase.execute({
        contractedServiceId: event.aggregateId.toString()
      });

      if (result.isFailure) {
        this.logger.error(
          'ContractedServiceSuspendedNotificationHandler: use case failed',
          undefined,
          { error: result.error }
        );
      }
    } catch (error) {
      this.logger.error(
        'ContractedServiceSuspendedNotificationHandler: unexpected error',
        error instanceof Error ? error : new Error(String(error))
      );
    }
  }
}
