import { IHandle } from 'domain/shared/interfaces';
import { BillPaidEvent } from 'domain/billing/events';
import { ILogger } from 'application/shared/interfaces';
import { RestoreServicesAfterPaymentUseCase } from '../use-cases';

// Restores the paid bill's services as soon as the payment is saved
// (BIL-311).
export class RestoreServicesOnPaymentHandler
  implements IHandle<BillPaidEvent>
{
  constructor(
    private readonly restoreUseCase: RestoreServicesAfterPaymentUseCase,
    private readonly logger: ILogger
  ) {}

  async handle(event: BillPaidEvent): Promise<void> {
    const billId = event.aggregateId.toString();
    try {
      const result = await this.restoreUseCase.execute({ billId });
      if (result.isFailure) {
        this.logger.error(
          'RestoreServicesOnPaymentHandler: use case failed',
          undefined,
          { billId, error: result.error }
        );
        return;
      }
      for (const failure of result.value.failed) {
        this.logger.warn(
          'RestoreServicesOnPaymentHandler: a service could not be restored',
          {
            billId,
            contractedServiceId: failure.id,
            error: failure.error
          }
        );
      }
    } catch (error) {
      this.logger.error(
        'RestoreServicesOnPaymentHandler: unexpected error',
        error instanceof Error ? error : new Error(String(error))
      );
    }
  }
}
