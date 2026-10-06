import { Result } from 'domain/shared/core';
import { CustomerId } from 'domain/shared/ids';
import { BillStatus } from 'domain/billing/enums';
import {
  IBillRepository,
  IBillingSettingsRepository
} from 'domain/billing/repository';
import { UseCase } from 'application/shared/core';
import { ILogger } from 'application/shared/interfaces';
import { ICustomerServiceAccess } from '../interfaces';
import {
  RestoreServicesAfterPaymentRequestDTO,
  RestoreServicesAfterPaymentResultDTO
} from '../dtos';

// BIL-311: once a customer has no OVERDUE bill left, every one of their
// suspended services comes back — while the automatic cut is on.
export class RestoreServicesAfterPaymentUseCase extends UseCase<
  RestoreServicesAfterPaymentRequestDTO,
  RestoreServicesAfterPaymentResultDTO
> {
  constructor(
    private readonly settingsRepository: IBillingSettingsRepository,
    private readonly billRepository: IBillRepository,
    private readonly serviceAccess: ICustomerServiceAccess,
    logger: ILogger
  ) {
    super(logger, 'RestoreServicesAfterPaymentUseCase');
  }

  protected async executeImpl(
    request: RestoreServicesAfterPaymentRequestDTO
  ): Promise<Result<RestoreServicesAfterPaymentResultDTO>> {
    const customerId = CustomerId.parse(request.customerId);
    if (customerId.isFailure) {
      return this.fail(`Invalid customerId: ${customerId.error}`);
    }

    const settings = await this.settingsRepository.get();
    if (settings.isFailure) {
      return this.fail(
        `Failed to load billing settings: ${settings.error}`
      );
    }
    const skipped = { attempted: false, restored: 0, failed: [] };
    if (!settings.value.automaticCutEnabled) return this.ok(skipped);

    const overdue = await this.billRepository.count({
      customerId: customerId.value,
      status: BillStatus.OVERDUE
    });
    if (overdue.isFailure) return this.fail(overdue.error!);
    if (overdue.value > 0) return this.ok(skipped);

    const outcome = await this.serviceAccess.restoreSuspendedServices(
      request.customerId
    );
    if (outcome.isFailure) return this.fail(outcome.error!);

    return this.ok({
      attempted: true,
      restored: outcome.value.changed,
      failed: outcome.value.failed
    });
  }
}
