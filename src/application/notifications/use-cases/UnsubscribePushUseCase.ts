import { Result } from 'domain/shared/core';
import { IPushSubscriptionRepository } from 'domain/notifications/repository';
import { UseCase } from 'application/shared/core';
import { ILogger } from 'application/shared/interfaces';
import { UnsubscribePushDTO } from '../dtos';

// NOT-225: a user turns off alerts on one of their own phones. Removing one
// that is already gone succeeds, so the phone's switch can always settle.
export class UnsubscribePushUseCase extends UseCase<
  UnsubscribePushDTO,
  void
> {
  constructor(
    private readonly repository: IPushSubscriptionRepository,
    logger: ILogger
  ) {
    super(logger, 'UnsubscribePushUseCase');
  }

  protected async beforeExecute(
    request: UnsubscribePushDTO
  ): Promise<Result<void> | null> {
    if (!request.endpoint?.trim()) {
      return Result.fail('endpoint is required');
    }
    return null;
  }

  protected async executeImpl(
    request: UnsubscribePushDTO
  ): Promise<Result<void>> {
    const removed = await this.repository.deleteByEndpoint(
      request.endpoint.trim(),
      request.userId
    );
    if (removed.isFailure) {
      return this.fail(
        `Failed to remove push subscription: ${removed.error}`
      );
    }
    return this.ok(undefined);
  }
}
