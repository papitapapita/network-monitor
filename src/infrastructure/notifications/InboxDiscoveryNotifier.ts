import { AlertSeverity } from 'domain/shared/enums';
import { ILogger } from 'application/shared/interfaces';
import {
  IDiscoveryNotifier,
  NewDevicesNotice
} from 'application/device-inventory/interfaces';
import { RecordInboxNotificationUseCase } from 'application/notifications/use-cases';

export const DEVICE_DISCOVERED_TYPE = 'device_discovered';

// Inbox only (DEV-206): a new host on the network is something to review,
// not an outage, so it stays off Telegram and phones.
export class InboxDiscoveryNotifier implements IDiscoveryNotifier {
  constructor(
    private readonly recordUseCase: RecordInboxNotificationUseCase,
    private readonly logger: ILogger
  ) {}

  async newDevicesFound(notice: NewDevicesNotice): Promise<void> {
    const title =
      notice.count === 1
        ? `Se detectó un dispositivo nuevo en ${notice.where}`
        : `Se detectaron ${notice.count} dispositivos nuevos en ${notice.where}`;
    const recorded = await this.recordUseCase.execute({
      type: DEVICE_DISCOVERED_TYPE,
      severity: AlertSeverity.WARNING,
      resolved: false,
      title,
      body: 'Revísalos en Dispositivos detectados para agregarlos al inventario o ignorarlos.',
      deviceId: null,
      alertId: null,
      occurredAt: notice.occurredAt
    });
    if (recorded.isFailure) {
      this.logger.warn('Discovery notice not recorded', {
        count: notice.count,
        error: recorded.error
      });
    }
  }
}
