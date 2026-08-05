import {
  ITicketRepository,
  TicketPriority,
  TicketCategory,
  ServiceAddress
} from 'domain/tickets';
import { CustomerId, DeviceId, TicketId } from 'domain/shared/ids';
import { Result } from 'domain/shared/core';
import { UseCase } from 'application/shared/core';
import { ILogger } from 'application/shared/interfaces';
import { TicketMapper } from '../mappers';
import { UpdateTicketRequestDTO, TicketResponseDTO } from '../dtos';
import { ICustomerDirectory, IDeviceDirectory } from '../interfaces';

export class UpdateTicketUseCase extends UseCase<
  UpdateTicketRequestDTO,
  TicketResponseDTO
> {
  constructor(
    private readonly ticketRepository: ITicketRepository,
    private readonly customerDirectory: ICustomerDirectory,
    private readonly deviceDirectory: IDeviceDirectory,
    logger: ILogger
  ) {
    super(logger, 'UpdateTicketUseCase');
  }

  protected async beforeExecute(
    request: UpdateTicketRequestDTO
  ): Promise<Result<void> | null> {
    if (!request.id || request.id.trim().length === 0) {
      return Result.fail('Ticket ID is required');
    }
    return null;
  }

  protected async executeImpl(
    request: UpdateTicketRequestDTO
  ): Promise<Result<TicketResponseDTO>> {
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

    const ticket = findResult.value;

    let priority: TicketPriority | undefined;
    if (request.priority !== undefined) {
      const result = TicketPriority.create(request.priority);
      if (result.isFailure) {
        return this.fail(result.error!);
      }
      priority = result.value;
    }

    let category: TicketCategory | undefined;
    if (request.category !== undefined) {
      const result = TicketCategory.create(request.category);
      if (result.isFailure) {
        return this.fail(result.error!);
      }
      category = result.value;
    }

    const detailsResult = ticket.updateDetails({
      title: request.title,
      description: request.description,
      priority,
      category
    });
    if (detailsResult.isFailure) {
      return this.fail(detailsResult.error!);
    }

    if (
      request.customerId !== undefined ||
      request.deviceId !== undefined
    ) {
      const linksResult = await this.applyLinks(ticket, request);
      if (linksResult.isFailure) {
        return this.fail(linksResult.error!);
      }
    }

    if (request.address !== undefined) {
      const addressResult = ServiceAddress.createOptional({
        street: request.address?.street ?? null,
        municipality: request.address?.municipality ?? null,
        neighborhood: request.address?.neighborhood ?? null,
        reference: request.address?.reference ?? null,
        latitude: request.address?.latitude ?? null,
        longitude: request.address?.longitude ?? null
      });
      if (addressResult.isFailure) {
        return this.fail(addressResult.error!);
      }

      const changeResult = ticket.changeAddress(addressResult.value);
      if (changeResult.isFailure) {
        return this.fail(changeResult.error!);
      }
    }

    const saveResult = await this.ticketRepository.save(ticket);
    if (saveResult.isFailure) {
      return this.fail(
        `Failed to persist ticket: ${saveResult.error}`
      );
    }

    return this.ok(TicketMapper.toDTO(saveResult.value));
  }

  private async applyLinks(
    ticket: Parameters<ITicketRepository['save']>[0],
    request: UpdateTicketRequestDTO
  ): Promise<Result<void>> {
    let customerId = ticket.customerId;
    if (request.customerId !== undefined) {
      if (request.customerId === null) {
        customerId = null;
      } else {
        const parsed = CustomerId.parse(request.customerId);
        if (parsed.isFailure) {
          return Result.fail(`Invalid customer ID: ${parsed.error}`);
        }
        const exists = await this.customerDirectory.exists(
          request.customerId
        );
        if (exists.isFailure) return Result.fail(exists.error!);
        if (!exists.value) {
          return Result.fail(
            `Customer not found: ${request.customerId}`
          );
        }
        customerId = parsed.value;
      }
    }

    let deviceId = ticket.deviceId;
    if (request.deviceId !== undefined) {
      if (request.deviceId === null) {
        deviceId = null;
      } else {
        const parsed = DeviceId.parse(request.deviceId);
        if (parsed.isFailure) {
          return Result.fail(`Invalid device ID: ${parsed.error}`);
        }
        const exists = await this.deviceDirectory.exists(
          request.deviceId
        );
        if (exists.isFailure) return Result.fail(exists.error!);
        if (!exists.value) {
          return Result.fail(`Device not found: ${request.deviceId}`);
        }
        deviceId = parsed.value;
      }
    }

    return ticket.updateLinks(customerId, deviceId);
  }
}
