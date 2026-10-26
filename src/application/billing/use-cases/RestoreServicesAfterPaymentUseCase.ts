import { Result } from 'domain/shared/core';
import { BillId } from 'domain/shared/ids';
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

// BIL-311: once a paid bill's service has no OVERDUE bill left, it comes back
// if suspended — while the automatic cut is on. The customer's other services
// are not touched.
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
    const billId = BillId.parse(request.billId);
    if (billId.isFailure) {
      return this.fail(`Invalid billId: ${billId.error}`);
    }

    const settings = await this.settingsRepository.get();
    if (settings.isFailure) {
      return this.fail(
        `Failed to load billing settings: ${settings.error}`
      );
    }
    if (!settings.value.automaticCutEnabled) {
      return this.ok({ attempted: false, restored: 0, failed: [] });
    }

    const bill = await this.billRepository.findById(billId.value);
    if (bill.isFailure) return this.fail(bill.error!);
    if (bill.value === null) {
      return this.fail(`Bill not found: ${request.billId}`);
    }

    const outcome: RestoreServicesAfterPaymentResultDTO = {
      attempted: true,
      restored: 0,
      failed: []
    };
    for (const item of bill.value.lineItems) {
      const id = item.contractedServiceId.toString();

      const overdue = await this.billRepository.count({
        contractedServiceId: item.contractedServiceId,
        status: BillStatus.OVERDUE
      });
      if (overdue.isFailure) {
        outcome.failed.push({ id, error: overdue.error! });
        continue;
      }
      if (overdue.value > 0) continue;

      const restored = await this.serviceAccess.restoreService(id);
      if (restored.isFailure) {
        outcome.failed.push({ id, error: restored.error! });
        continue;
      }
      if (restored.value) outcome.restored++;
    }
    return this.ok(outcome);
  }
}
