import { Result } from 'domain/shared/core';
import { DeviceId } from 'domain/shared/ids';
import { Alert } from 'domain/notifications/aggregates';
import { IAlertRepository } from 'domain/notifications/repository';
import { UseCase } from 'application/shared/core';
import { ILogger } from 'application/shared/interfaces';
import { ITicketOpener } from 'application/tickets/interfaces';
import { OpenAlertDTO } from '../dtos';

// Wireless producers record alerts as `wireless:<metric>:<severity>`; anything
// else on this path is the ICMP device-down pipeline.
const WIRELESS_TYPE_PREFIX = 'wireless:';

/**
 * Persists an operational alert into the shared alert store, deduplicated by
 * (device, type). Does not notify — delivery is a separate concern. Any
 * producer BC records alerts through this (via IAlertRecorder) so they surface
 * in the unified alert list.
 */
export class OpenAlertUseCase extends UseCase<OpenAlertDTO, void> {
  constructor(
    private readonly alertRepository: IAlertRepository,
    logger: ILogger,
    // Optional so the notifications context still works without tickets wired
    // in. `Alert` raises no domain events, so this is the only seam where a
    // newly opened alert can become a work order.
    private readonly ticketOpener?: ITicketOpener
  ) {
    super(logger, 'OpenAlertUseCase');
  }

  protected async executeImpl(
    request: OpenAlertDTO
  ): Promise<Result<void>> {
    const deviceIdResult = DeviceId.parse(request.deviceId);
    if (deviceIdResult.isFailure) {
      return this.fail(`Invalid device ID: ${deviceIdResult.error}`);
    }
    const deviceId = deviceIdResult.value;

    const existing =
      await this.alertRepository.findOpenByDeviceAndType(
        deviceId,
        request.type
      );
    if (existing.isFailure) {
      return this.fail(
        `Failed to check existing alerts: ${existing.error}`
      );
    }
    if (existing.value !== null) {
      // Already open — idempotent; producers re-emit every cycle.
      return this.ok(undefined);
    }

    const alertResult = Alert.open(
      deviceId,
      request.severity,
      request.source,
      request.type,
      request.description,
      request.details
    );
    if (alertResult.isFailure) {
      return this.fail(`Failed to create alert: ${alertResult.error}`);
    }

    const saveResult = await this.alertRepository.save(
      alertResult.value
    );
    if (saveResult.isFailure) {
      return this.fail(`Failed to save alert: ${saveResult.error}`);
    }

    await this.openTicketFor(alertResult.value.id.toString(), request);

    return this.ok(undefined);
  }

  // Best effort: a ticket that fails to open must not fail the alert. The
  // alert is the record of the fault; the ticket is the follow-up work.
  private async openTicketFor(
    alertId: string,
    request: OpenAlertDTO
  ): Promise<void> {
    if (this.ticketOpener === undefined) return;

    try {
      const result = await this.ticketOpener.openFromAlert({
        origin: request.type.startsWith(WIRELESS_TYPE_PREFIX)
          ? 'WIRELESS_ALERT'
          : 'DEVICE_ALERT',
        alertId,
        deviceId: request.deviceId,
        severity: request.severity,
        message: request.description
      });

      if (result.isFailure) {
        this.logger.warn(
          'Alert recorded but no ticket was opened for it',
          { alertId, error: result.error }
        );
      }
    } catch (error) {
      this.logger.error(
        'Unexpected error opening a ticket for an alert',
        error instanceof Error ? error : new Error(String(error)),
        { alertId }
      );
    }
  }
}
