import { Result } from 'domain/shared/core';
import { DeviceId } from 'domain/shared/ids';
import { Alert } from 'domain/notifications/aggregates';
import { IAlertRepository } from 'domain/notifications/repository';
import { IDeviceRepository } from 'domain/device-inventory/repository';
import { IDeviceEligibilityService } from 'domain/device-inventory/services';
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
    private readonly deviceRepository: IDeviceRepository,
    private readonly eligibility: IDeviceEligibilityService,
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

    const eligible = await this.isDeviceStillAlertable(deviceId);
    if (eligible.isFailure) {
      return this.fail(eligible.error);
    }
    if (!eligible.value) {
      return this.ok(undefined);
    }

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
      return this.fail(
        `Failed to create alert: ${alertResult.error}`
      );
    }

    const saveResult = await this.alertRepository.save(
      alertResult.value
    );
    if (saveResult.isFailure) {
      return this.fail(`Failed to save alert: ${saveResult.error}`);
    }

    await this.openTicketFor(
      alertResult.value.id.toString(),
      request
    );

    return this.ok(undefined);
  }

  // Producers select devices to poll off a flag that an event handler was
  // supposed to have cleared, and dispatch is fire-and-forget — so a device
  // can still be polled long after it was deleted or retired. Re-reading the
  // aggregate here is the check that cannot go stale, and it sits ahead of the
  // save so a dead device raises no alert and opens no ticket. Only the
  // opening path is gated; clearing an alert stays open so one raised while
  // the device was live can still be resolved.
  private async isDeviceStillAlertable(
    deviceId: DeviceId
  ): Promise<Result<boolean>> {
    const deviceResult =
      await this.deviceRepository.findById(deviceId);
    if (deviceResult.isFailure) {
      return Result.fail(
        `Failed to load device for alert: ${deviceResult.error}`
      );
    }

    // findById hides soft-deleted rows, so a tombstone arrives as null.
    if (deviceResult.value === null) {
      this.logger.warn(
        'Suppressed an alert for a device that no longer exists',
        { deviceId: deviceId.toString() }
      );
      return Result.ok(false);
    }

    const decision = this.eligibility.canAlert(deviceResult.value);
    if (!decision.eligible) {
      this.logger.warn(
        'Suppressed an alert for an ineligible device',
        {
          deviceId: deviceId.toString(),
          reason: decision.reason
        }
      );
      return Result.ok(false);
    }

    return Result.ok(true);
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
