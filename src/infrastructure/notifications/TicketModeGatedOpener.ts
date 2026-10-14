import { Result } from 'domain/shared/core';
import { INotificationSettingsRepository } from 'domain/notifications/repository';
import { ILogger } from 'application/shared/interfaces';
import {
  ITicketOpener,
  OpenTicketFromAlertRequestDTO
} from 'application/tickets';

// Wraps the opener both alert pipelines share, so the administrator's ticket
// mode (NOT-205) applies from the next alert without a restart. In SUGGEST
// mode nothing is opened: the alert list offers the ticket instead.
export class TicketModeGatedOpener implements ITicketOpener {
  constructor(
    private readonly inner: ITicketOpener,
    private readonly settingsRepository: INotificationSettingsRepository,
    private readonly logger: ILogger
  ) {}

  async openFromAlert(
    request: OpenTicketFromAlertRequestDTO
  ): Promise<Result<void>> {
    const settings = await this.settingsRepository.get();
    if (settings.isFailure) {
      // Falling back to a suggestion loses nothing: the alert still offers
      // the ticket, whereas a wrong automatic one lands on a day sheet.
      this.logger.error(
        'TicketModeGatedOpener: failed to read notification settings, suggesting instead',
        undefined,
        { alertId: request.alertId, error: settings.error }
      );
      return Result.ok();
    }
    if (!settings.value.opensTicketsAutomatically) {
      return Result.ok();
    }

    return this.inner.openFromAlert(request);
  }
}
