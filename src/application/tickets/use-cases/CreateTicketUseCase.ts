import {
  Ticket,
  ITicketRepository,
  ITechnicianRepository,
  TicketPriority,
  TicketCategory,
  TicketOrigin,
  ServiceAddress
} from 'domain/tickets';
import {
  CustomerId,
  DeviceId,
  TechnicianId,
  UserId
} from 'domain/shared/ids';
import { Result } from 'domain/shared/core';
import { UseCase } from 'application/shared/core';
import { ILogger } from 'application/shared/interfaces';
import { TicketMapper } from '../mappers';
import { CreateTicketRequestDTO, TicketResponseDTO } from '../dtos';
import { ICustomerDirectory, IDeviceDirectory } from '../interfaces';
import { parseCalendarDate } from './calendar-date';

export class CreateTicketUseCase extends UseCase<
  CreateTicketRequestDTO,
  TicketResponseDTO
> {
  constructor(
    private readonly ticketRepository: ITicketRepository,
    private readonly technicianRepository: ITechnicianRepository,
    private readonly customerDirectory: ICustomerDirectory,
    private readonly deviceDirectory: IDeviceDirectory,
    logger: ILogger
  ) {
    super(logger, 'CreateTicketUseCase');
  }

  protected async beforeExecute(
    request: CreateTicketRequestDTO
  ): Promise<Result<void> | null> {
    if (!request.title || request.title.trim().length === 0) {
      return Result.fail('Ticket title is required');
    }
    if (
      !request.description ||
      request.description.trim().length === 0
    ) {
      return Result.fail('Ticket description is required');
    }
    if (!request.category || request.category.trim().length === 0) {
      return Result.fail('Ticket category is required');
    }
    return null;
  }

  protected async executeImpl(
    request: CreateTicketRequestDTO
  ): Promise<Result<TicketResponseDTO>> {
    const categoryResult = TicketCategory.create(request.category);
    if (categoryResult.isFailure) {
      return this.fail(categoryResult.error!);
    }

    const priorityResult = TicketPriority.create(
      request.priority ?? TicketPriority.NORMAL
    );
    if (priorityResult.isFailure) {
      return this.fail(priorityResult.error!);
    }

    const customerResult = await this.resolveCustomer(
      request.customerId ?? null
    );
    if (customerResult.isFailure) {
      return this.fail(customerResult.error!);
    }

    const deviceResult = await this.resolveDevice(
      request.deviceId ?? null
    );
    if (deviceResult.isFailure) {
      return this.fail(deviceResult.error!);
    }

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

    let scheduledFor: Date | null = null;
    if (
      request.scheduledFor !== undefined &&
      request.scheduledFor !== null
    ) {
      const dateResult = parseCalendarDate(
        request.scheduledFor,
        'scheduledFor'
      );
      if (dateResult.isFailure) {
        return this.fail(dateResult.error!);
      }
      scheduledFor = dateResult.value;
    }

    let createdBy: UserId | null = null;
    if (
      request.createdBy !== undefined &&
      request.createdBy !== null
    ) {
      const userIdResult = UserId.parse(request.createdBy);
      if (userIdResult.isFailure) {
        return this.fail(`Invalid createdBy: ${userIdResult.error}`);
      }
      createdBy = userIdResult.value;
    }

    const ticketResult = Ticket.create({
      title: request.title,
      description: request.description,
      priority: priorityResult.value,
      category: categoryResult.value,
      origin: TicketOrigin.reconstitute(TicketOrigin.MANUAL),
      originAlertId: null,
      customerId: customerResult.value,
      deviceId: deviceResult.value,
      address: addressResult.value,
      scheduledFor,
      createdBy
    });
    if (ticketResult.isFailure) {
      return this.fail(ticketResult.error!);
    }

    const ticket = ticketResult.value;

    // Assigning at creation is a convenience for the dispatcher; it still goes
    // through the aggregate so the status transition and events are identical
    // to assigning later.
    if (
      request.technicianId !== undefined &&
      request.technicianId !== null
    ) {
      const assignResult = await this.assignAtCreation(
        ticket,
        request.technicianId,
        scheduledFor
      );
      if (assignResult.isFailure) {
        return this.fail(assignResult.error!);
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

  private async assignAtCreation(
    ticket: Ticket,
    technicianId: string,
    scheduledFor: Date | null
  ): Promise<Result<void>> {
    const idResult = TechnicianId.parse(technicianId);
    if (idResult.isFailure) {
      return Result.fail(`Invalid technician ID: ${idResult.error}`);
    }

    const findResult = await this.technicianRepository.findById(
      idResult.value
    );
    if (findResult.isFailure) {
      return Result.fail(findResult.error!);
    }
    if (findResult.value === null) {
      return Result.fail(`Technician not found: ${technicianId}`);
    }
    if (!findResult.value.isActive) {
      return Result.fail(
        'Cannot assign a ticket to an inactive technician'
      );
    }

    return ticket.assign(idResult.value, scheduledFor);
  }

  private async resolveCustomer(
    customerId: string | null
  ): Promise<Result<CustomerId | null>> {
    if (customerId === null) {
      return Result.ok<CustomerId | null>(null);
    }

    const idResult = CustomerId.parse(customerId);
    if (idResult.isFailure) {
      return Result.fail(`Invalid customer ID: ${idResult.error}`);
    }

    const existsResult =
      await this.customerDirectory.exists(customerId);
    if (existsResult.isFailure) {
      return Result.fail(existsResult.error!);
    }
    if (!existsResult.value) {
      return Result.fail(`Customer not found: ${customerId}`);
    }

    return Result.ok<CustomerId | null>(idResult.value);
  }

  private async resolveDevice(
    deviceId: string | null
  ): Promise<Result<DeviceId | null>> {
    if (deviceId === null) {
      return Result.ok<DeviceId | null>(null);
    }

    const idResult = DeviceId.parse(deviceId);
    if (idResult.isFailure) {
      return Result.fail(`Invalid device ID: ${idResult.error}`);
    }

    const existsResult = await this.deviceDirectory.exists(deviceId);
    if (existsResult.isFailure) {
      return Result.fail(existsResult.error!);
    }
    if (!existsResult.value) {
      return Result.fail(`Device not found: ${deviceId}`);
    }

    return Result.ok<DeviceId | null>(idResult.value);
  }
}
