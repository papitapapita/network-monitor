import { Result } from 'domain/shared/core';
import { IMutedAlertTypeRepository } from 'domain/notifications/repository';
import {
  IAlertPublisher,
  AlertNotification,
  TYPE_MUTED_SUPPRESSED,
  ILogger
} from 'application/shared/interfaces';

const WIRELESS_TYPE_PREFIX = 'wireless:';

// Wraps the real publisher, same composition point as QuietHoursAlertPublisher
// (NOT-174) — every alert-producing path shares one IAlertPublisher instance,
// see container.ts. Mutes by bare metric name, severity-agnostic: muting
// `cpu_load_percent` silences both its WARNING and CRITICAL pushes. Never
// touches Alert/WirelessAlertRecord creation — the alert stays visible on
// GET /api/alerts regardless of muting, only the push is suppressed.
export class MutedTypeAlertPublisher implements IAlertPublisher {
  constructor(
    private readonly inner: IAlertPublisher,
    private readonly mutedAlertTypeRepository: IMutedAlertTypeRepository,
    private readonly logger: ILogger
  ) {}

  async publish(
    notification: AlertNotification
  ): Promise<Result<void>> {
    const metric = MutedTypeAlertPublisher.extractMetric(
      notification.type
    );

    const mutedResult =
      await this.mutedAlertTypeRepository.isMuted(metric);
    if (mutedResult.isFailure) {
      this.logger.error(
        'MutedTypeAlertPublisher: failed to check muted alert types, notifying anyway',
        undefined,
        { type: notification.type, error: mutedResult.error }
      );
    } else if (mutedResult.value) {
      return Result.fail(TYPE_MUTED_SUPPRESSED);
    }

    return this.inner.publish(notification);
  }

  private static extractMetric(type: string): string {
    if (!type.startsWith(WIRELESS_TYPE_PREFIX)) return type;
    const parts = type.split(':');
    return parts.length === 3 ? parts[1] : type;
  }
}
