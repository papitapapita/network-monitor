import { IHandle } from 'domain/shared/interfaces';
import { BillPaidEvent } from 'domain/billing/events';
import { ILogger } from 'application/shared/interfaces';
import { RestoreServicesAfterPaymentUseCase } from '../use-cases';

// Restores a paid-up customer's service as soon as the payment is saved
// (BIL-311).
export class RestoreServicesOnPaymentHandler
  implements IHandle<BillPaidEvent>
{
  constructor(
    private readonly restoreUseCase: RestoreServicesAfterPaymentUseCase,
    private readonly logger: ILogger
  ) {}

  async handle(event: BillPaidEvent): Promise<void> {
    const customerId = event.customerId.toString();
    try {
      const result = await this.restoreUseCase.execute({
        customerId
      });
      if (result.isFailure) {
        this.logger.error(
          'RestoreServicesOnPaymentHandler: use case failed',
          undefined,
          { customerId, error: result.error }
        );
        return;
      }
      for (const failure of result.value.failed) {
        this.logger.warn(
          'RestoreServicesOnPaymentHandler: a service could not be restored',
          {
            customerId,
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
