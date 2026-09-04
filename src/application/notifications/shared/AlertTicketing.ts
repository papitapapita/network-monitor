import { ILogger } from 'application/shared/interfaces';
import { ITicketOpener } from 'application/tickets/interfaces';

// Wireless producers record as `wireless:<metric>:<severity>`; anything else
// on this path is the ICMP device-down pipeline.
const WIRELESS_TYPE_PREFIX = 'wireless:';

export interface OpenTicketForAlertParams {
  alertId: string;
  deviceId: string;
  type: string;
  severity: string;
  message: string;
}

// Shared by OpenAlertUseCase (immediate — wireless, and any alert opened with
// skipTicket unset) and SendDeviceDownAlertUseCase (deferred to the moment a
// down alert is actually notified, so a blip that never pages anyone never
// opens a ticket either). Best effort: a ticket that fails to open must not
// fail the alert.
export async function openTicketForAlert(
  ticketOpener: ITicketOpener | undefined,
  logger: ILogger,
  params: OpenTicketForAlertParams
): Promise<void> {
  if (ticketOpener === undefined) return;

  try {
    const result = await ticketOpener.openFromAlert({
      origin: params.type.startsWith(WIRELESS_TYPE_PREFIX)
        ? 'WIRELESS_ALERT'
        : 'DEVICE_ALERT',
      alertId: params.alertId,
      deviceId: params.deviceId,
      severity: params.severity,
      message: params.message
    });

    if (result.isFailure) {
      logger.warn('Alert recorded but no ticket was opened for it', {
        alertId: params.alertId,
        error: result.error
      });
    }
  } catch (error) {
    logger.error(
      'Unexpected error opening a ticket for an alert',
      error instanceof Error ? error : new Error(String(error)),
      { alertId: params.alertId }
    );
  }
}
