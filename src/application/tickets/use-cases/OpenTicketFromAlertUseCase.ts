import {
  Ticket,
  ITicketRepository,
  TicketPriority,
  TicketCategory,
  TicketOrigin
} from 'domain/tickets';
import { CustomerId, DeviceId } from 'domain/shared/ids';
import { Result, UniqueEntityID } from 'domain/shared/core';
import { UseCase } from 'application/shared/core';
import { ILogger } from 'application/shared/interfaces';
import { TicketMapper } from '../mappers';
import {
  OpenTicketFromAlertRequestDTO,
  TicketResponseDTO
} from '../dtos';
import { ICustomerDirectory, IDeviceDirectory } from '../interfaces';

const MAX_TITLE_LENGTH = 150;

/**
 * Opens a ticket for a firing alert. Has no HTTP surface — it is reached only
 * from the wireless event handler and from the device-down alert pipeline.
 */
export class OpenTicketFromAlertUseCase extends UseCase<
  OpenTicketFromAlertRequestDTO,
  TicketResponseDTO
> {
  constructor(
    private readonly ticketRepository: ITicketRepository,
    private readonly customerDirectory: ICustomerDirectory,
    private readonly deviceDirectory: IDeviceDirectory,
    logger: ILogger
  ) {
    super(logger, 'OpenTicketFromAlertUseCase');
  }

  protected async beforeExecute(
    request: OpenTicketFromAlertRequestDTO
  ): Promise<Result<void> | null> {
    if (!request.alertId || request.alertId.trim().length === 0) {
      return Result.fail('Alert ID is required');
    }
    if (!request.deviceId || request.deviceId.trim().length === 0) {
      return Result.fail('Device ID is required');
    }
    if (!request.origin || request.origin.trim().length === 0) {
      return Result.fail('Ticket origin is required');
    }
    return null;
  }

  protected async executeImpl(
    request: OpenTicketFromAlertRequestDTO
  ): Promise<Result<TicketResponseDTO>> {
    const originResult = TicketOrigin.create(request.origin);
    if (originResult.isFailure) {
      return this.fail(originResult.error!);
    }
    if (originResult.value.isManual()) {
      return this.fail(
        'A ticket opened from an alert cannot have origin MANUAL'
      );
    }

    const alertId = request.alertId.trim();
    if (!UniqueEntityID.isValid(alertId)) {
      return this.fail(
        'Invalid originating alert id: must be a valid UUID'
      );
    }

    const deviceIdResult = DeviceId.parse(request.deviceId.trim());
    if (deviceIdResult.isFailure) {
      return this.fail(`Invalid device ID: ${deviceIdResult.error}`);
    }

    // Dedupe: a metric that is still breaching re-fires on every poll. One
    // live ticket per alert, or the technician drowns in duplicates.
    const existingResult =
      await this.ticketRepository.findActiveByOrigin(
        originResult.value.value,
        alertId
      );
    if (existingResult.isFailure) {
      return this.fail(existingResult.error!);
    }
    if (existingResult.value !== null) {
      this.logger.info(
        'Alert already has a live ticket; skipping creation',
        {
          alertId,
          ticketId: existingResult.value.id.toString()
        }
      );
      return this.ok(TicketMapper.toDTO(existingResult.value));
    }

    // A device with several breaching metrics is still one site visit. Fold
    // later alerts into the ticket already raised for that device.
    const deviceTicketResult =
      await this.ticketRepository.findActiveAlertTicketForDevice(
        request.deviceId.trim()
      );
    if (deviceTicketResult.isFailure) {
      return this.fail(deviceTicketResult.error!);
    }
    if (deviceTicketResult.value !== null) {
      this.logger.info(
        'Device already has a live alert ticket; skipping creation',
        {
          alertId,
          deviceId: request.deviceId,
          ticketId: deviceTicketResult.value.id.toString()
        }
      );
      return this.ok(TicketMapper.toDTO(deviceTicketResult.value));
    }

    const deviceResult = await this.deviceDirectory.findSummary(
      request.deviceId.trim()
    );
    if (deviceResult.isFailure) {
      return this.fail(deviceResult.error!);
    }
    if (deviceResult.value === null) {
      return this.fail(`Device not found: ${request.deviceId}`);
    }

    // Best effort: an alert on a device with no contracted service still
    // deserves a ticket, it just has nobody to phone.
    const contactResult =
      await this.customerDirectory.findContactByDevice(
        request.deviceId.trim()
      );
    if (contactResult.isFailure) {
      return this.fail(contactResult.error!);
    }

    let customerId: CustomerId | null = null;
    if (contactResult.value !== null) {
      // The directory returns an id it just read from the database, so a parse
      // failure here means data corruption rather than bad input.
      const parsed = CustomerId.parse(contactResult.value.id);
      if (parsed.isFailure) {
        return this.fail(`Invalid customer ID: ${parsed.error}`);
      }
      customerId = parsed.value;
    }

    const ticketResult = Ticket.create({
      title: OpenTicketFromAlertUseCase.buildTitle(
        deviceResult.value.name,
        request.message
      ),
      description: request.message,
      priority: OpenTicketFromAlertUseCase.mapSeverity(
        request.severity
      ),
      category: TicketCategory.reconstitute(
        TicketCategory.CONNECTIVITY
      ),
      origin: originResult.value,
      originAlertId: alertId,
      customerId,
      deviceId: deviceIdResult.value,
      address: null,
      scheduledFor: null,
      createdBy: null
    });
    if (ticketResult.isFailure) {
      return this.fail(ticketResult.error!);
    }

    const saveResult = await this.ticketRepository.save(
      ticketResult.value
    );
    if (saveResult.isFailure) {
      return this.fail(
        `Failed to persist ticket: ${saveResult.error}`
      );
    }

    return this.ok(TicketMapper.toDTO(saveResult.value));
  }

  // CRITICAL means the service is down for a paying customer right now.
  private static mapSeverity(severity: string): TicketPriority {
    const normalized = (severity ?? '').trim().toUpperCase();
    return TicketPriority.reconstitute(
      normalized === 'CRITICAL'
        ? TicketPriority.URGENT
        : TicketPriority.HIGH
    );
  }

  private static buildTitle(
    deviceName: string,
    message: string
  ): string {
    const title = `${deviceName}: ${message}`;
    return title.length > MAX_TITLE_LENGTH
      ? `${title.slice(0, MAX_TITLE_LENGTH - 1)}…`
      : title;
  }
}
