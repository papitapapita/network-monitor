import { Result } from 'domain/shared/core';
import { SubscriptionTerms } from 'domain/shared/value-objects';
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
    private readonly terms: SubscriptionTerms | null,
    logger: ILogger
  ) {
    super(logger, 'GetSubscriptionStatusUseCase');
  }

  protected async executeImpl(): Promise<
    Result<SubscriptionStatusDTO>
  > {
    if (this.terms === null) {
      return this.ok({
        state: 'NOT_ENFORCED',
        paidThrough: null,
        graceEndsAt: null,
        lockedAt: null,
        readOnly: false,
        locked: false
      });
    }
    const state = this.terms.stateAt(new Date());
    return this.ok({
      state,
      paidThrough: this.terms.paidThrough.toISOString(),
      graceEndsAt: this.terms.graceEndsAt.toISOString(),
      lockedAt: this.terms.lockedAt.toISOString(),
      readOnly: state === 'READ_ONLY' || state === 'LOCKED',
      locked: state === 'LOCKED'
    });
  }
}
