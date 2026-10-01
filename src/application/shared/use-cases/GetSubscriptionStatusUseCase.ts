import { Result } from 'domain/shared/core';
import { IVendorSettingsRepository } from 'domain/shared/interfaces';
import { UseCase } from '../core';
import { ILogger } from '../interfaces';
import { SubscriptionStatusDTO } from '../dtos';

// Install-wide, not owned by any context: the agent gateway, the alert
// publisher, the HTTP guard, the job supervisor and the dashboard all ask the
// same question (ADR 0002, R17).
export class GetSubscriptionStatusUseCase extends UseCase<
  void,
  SubscriptionStatusDTO
> {
  constructor(
    private readonly vendorSettings: IVendorSettingsRepository,
    logger: ILogger
  ) {
    super(logger, 'GetSubscriptionStatusUseCase');
  }

  protected async executeImpl(): Promise<
    Result<SubscriptionStatusDTO>
  > {
    // Read on every call, so a payment recorded from the dashboard applies
    // at once (INS-028).
    const settings = await this.vendorSettings.get();
    if (settings.isFailure) {
      return this.fail(
        `Failed to read the subscription terms: ${settings.error}`
      );
    }
    const terms = settings.value.subscriptionTerms();
    if (terms === null) {
      return this.ok({
        state: 'NOT_ENFORCED',
        paidThrough: null,
        graceEndsAt: null,
        lockedAt: null,
        readOnly: false,
        locked: false
      });
    }
    const state = terms.stateAt(new Date());
    return this.ok({
      state,
      paidThrough: terms.paidThrough.toISOString(),
      graceEndsAt: terms.graceEndsAt.toISOString(),
      lockedAt: terms.lockedAt.toISOString(),
      readOnly: state === 'READ_ONLY' || state === 'LOCKED',
      locked: state === 'LOCKED'
    });
  }
}
