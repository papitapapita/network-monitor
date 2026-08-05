import {
  Ticket,
  ITicketRepository,
  ITechnicianRepository
} from 'domain/tickets';
import { TicketId } from 'domain/shared/ids';
import { Result } from 'domain/shared/core';
import { UseCase } from 'application/shared/core';
import { ILogger } from 'application/shared/interfaces';
import { TicketMapper, TechnicianMapper } from '../mappers';
import {
  GetTicketRequestDTO,
  TicketDetailResponseDTO,
  TicketCustomerContactDTO,
  TicketDeviceSummaryDTO,
  TechnicianSummaryDTO
} from '../dtos';
import { ICustomerDirectory, IDeviceDirectory } from '../interfaces';

export class GetTicketUseCase extends UseCase<
  GetTicketRequestDTO,
  TicketDetailResponseDTO
> {
  constructor(
    private readonly ticketRepository: ITicketRepository,
    private readonly technicianRepository: ITechnicianRepository,
    private readonly customerDirectory: ICustomerDirectory,
    private readonly deviceDirectory: IDeviceDirectory,
    logger: ILogger
  ) {
    super(logger, 'GetTicketUseCase');
  }

  protected async beforeExecute(
    request: GetTicketRequestDTO
  ): Promise<Result<void> | null> {
    if (!request.id || request.id.trim().length === 0) {
      return Result.fail('Ticket ID is required');
    }
    return null;
  }

  protected async executeImpl(
    request: GetTicketRequestDTO
  ): Promise<Result<TicketDetailResponseDTO>> {
    const idResult = TicketId.parse(request.id.trim());
    if (idResult.isFailure) {
      return this.fail(`Invalid ticket ID: ${idResult.error}`);
    }

    const findResult = await this.ticketRepository.findById(
      idResult.value
    );
    if (findResult.isFailure) {
      return this.fail(findResult.error!);
    }
    if (findResult.value === null) {
      return this.fail(`Ticket not found: ${request.id}`);
    }

    const enrichedResult = await this.enrich(findResult.value);
    if (enrichedResult.isFailure) {
      return this.fail(enrichedResult.error!);
    }

    return this.ok(enrichedResult.value);
  }

  // Composes the answer to "who do I call, what broke, and on which box".
  // A missing collaborator is not an error — a device can be unlinked and the
  // ticket is still worth showing.
  private async enrich(
    ticket: Ticket
  ): Promise<Result<TicketDetailResponseDTO>> {
    let customer: TicketCustomerContactDTO | null = null;
    if (ticket.customerId !== null) {
      const result = await this.customerDirectory.findContact(
        ticket.customerId.toString()
      );
      if (result.isFailure) {
        return Result.fail(result.error!);
      }
      customer = result.value;
    }

    let device: TicketDeviceSummaryDTO | null = null;
    if (ticket.deviceId !== null) {
      const result = await this.deviceDirectory.findSummary(
        ticket.deviceId.toString()
      );
      if (result.isFailure) {
        return Result.fail(result.error!);
      }
      device = result.value;
    }

    let technician: TechnicianSummaryDTO | null = null;
    if (ticket.technicianId !== null) {
      const result = await this.technicianRepository.findById(
        ticket.technicianId
      );
      if (result.isFailure) {
        return Result.fail(result.error!);
      }
      technician =
        result.value === null
          ? null
          : TechnicianMapper.toSummaryDTO(result.value);
    }

    return Result.ok(
      TicketMapper.toDetailDTO(ticket, customer, device, technician)
    );
  }
}
