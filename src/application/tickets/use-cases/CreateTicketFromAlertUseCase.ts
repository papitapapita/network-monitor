import { ITicketRepository } from 'domain/tickets';
import { Result, UniqueEntityID } from 'domain/shared/core';
import { UseCase } from 'application/shared/core';
import { ILogger } from 'application/shared/interfaces';
import {
  CreateTicketFromAlertRequestDTO,
  TicketResponseDTO
} from '../dtos';
import { IAlertDirectory } from '../interfaces';
import { OpenTicketFromAlertUseCase } from './OpenTicketFromAlertUseCase';

// Same split the alert pipelines record under (AlertTicketing): wireless
// producers type their alerts `wireless:<metric>:<severity>`.
const WIRELESS_TYPE_PREFIX = 'wireless:';

/**
 * A person accepting an alert's ticket suggestion (TKT-115). Any alert may
 * become a ticket, open or resolved, and it gets its own ticket even when the
 * device already has one: the person has decided it is a separate job.
 */
export class CreateTicketFromAlertUseCase extends UseCase<
  CreateTicketFromAlertRequestDTO,
  TicketResponseDTO
> {
  constructor(
    private readonly alertDirectory: IAlertDirectory,
    private readonly ticketRepository: ITicketRepository,
    private readonly openTicketFromAlert: OpenTicketFromAlertUseCase,
    logger: ILogger
  ) {
    super(logger, 'CreateTicketFromAlertUseCase');
  }

  protected async beforeExecute(
    request: CreateTicketFromAlertRequestDTO
  ): Promise<Result<void> | null> {
    if (!request.alertId || request.alertId.trim().length === 0) {
      return Result.fail('Alert ID is required');
    }
    if (!UniqueEntityID.isValid(request.alertId.trim())) {
      return Result.fail('Invalid alert ID: must be a valid UUID');
    }
    return null;
  }

  protected async executeImpl(
    request: CreateTicketFromAlertRequestDTO
  ): Promise<Result<TicketResponseDTO>> {
    const alertId = request.alertId.trim();

    const alertResult =
      await this.alertDirectory.findSummary(alertId);
    if (alertResult.isFailure) {
      return this.fail(alertResult.error!);
    }
    const alert = alertResult.value;
    if (alert === null) {
      return this.fail(`Alert not found: ${alertId}`);
    }

    const origin = alert.type.startsWith(WIRELESS_TYPE_PREFIX)
      ? 'WIRELESS_ALERT'
      : 'DEVICE_ALERT';

    const existingResult =
      await this.ticketRepository.findActiveByOrigin(origin, alertId);
    if (existingResult.isFailure) {
      return this.fail(existingResult.error!);
    }
    if (existingResult.value !== null) {
      return this.fail(
        `A live ticket already exists for this alert: #${existingResult.value.code}`
      );
    }

    return this.openTicketFromAlert.execute({
      origin,
      alertId,
      deviceId: alert.deviceId,
      severity: alert.severity,
      message: alert.description,
      foldIntoDeviceTicket: false,
      createdBy: request.createdBy ?? null
    });
  }
}
