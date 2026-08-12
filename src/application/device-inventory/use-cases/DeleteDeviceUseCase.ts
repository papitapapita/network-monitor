import { DeviceId } from 'domain/shared/ids';
import { IDeviceRepository } from 'domain/device-inventory/repository';
import { IContractedServiceRepository } from 'domain/customers/repository';
import { ITicketRepository } from 'domain/tickets/repository';
import { Result } from 'domain/shared/core';
import { UseCase } from 'application/shared/core';
import { ILogger } from 'application/shared/interfaces';
import { DeleteDeviceRequestDTO } from '../dtos/DeleteDeviceRequestDTO';

// Deleting is reversible for a week and then permanent. The two guards below
// exist because the permanent half cascades: once the purge runs, every ping,
// alert and snapshot goes with the row, and anything still pointing at the
// device is silently detached.
export class DeleteDeviceUseCase extends UseCase<
  DeleteDeviceRequestDTO,
  void
> {
  constructor(
    private readonly deviceRepository: IDeviceRepository,
    private readonly contractedServiceRepository: IContractedServiceRepository,
    private readonly ticketRepository: ITicketRepository,
    logger: ILogger
  ) {
    super(logger, 'DeleteDeviceUseCase');
  }

  protected async beforeExecute(
    request: DeleteDeviceRequestDTO
  ): Promise<Result<void> | null> {
    if (!request.id || request.id.trim().length === 0) {
      return Result.fail('Device ID is required');
    }

    return null;
  }

  protected async executeImpl(
    request: DeleteDeviceRequestDTO
  ): Promise<Result<void>> {
    const deviceIdResult = DeviceId.parse(request.id.trim());
    if (deviceIdResult.isFailure) {
      return this.fail<void>(
        `Invalid device ID: ${deviceIdResult.error}`
      );
    }

    const deviceId = deviceIdResult.value;

    const findResult = await this.deviceRepository.findById(deviceId);
    if (findResult.isFailure) {
      return this.fail<void>(findResult.error!);
    }

    const device = findResult.value;
    if (device === null) {
      return this.fail<void>(`Device not found: ${request.id}`);
    }

    const contractGuard = await this.guardAgainstLiveContract(
      deviceId
    );
    if (contractGuard.isFailure) {
      return this.fail<void>(contractGuard.error!);
    }

    const ticketGuard = await this.guardAgainstOpenTickets(deviceId);
    if (ticketGuard.isFailure) {
      return this.fail<void>(ticketGuard.error!);
    }

    const deleteResult = device.softDelete(
      request.deletedBy ?? null
    );
    if (deleteResult.isFailure) {
      return this.fail<void>(deleteResult.error);
    }

    // save(), not delete() — the tombstone is a normal write, and it is what
    // dispatches DeviceDeletedEvent so the polling pipelines stand down.
    const saveResult = await this.deviceRepository.save(device);
    if (saveResult.isFailure) {
      return this.fail<void>(saveResult.error!);
    }

    return this.ok(undefined);
  }

  // A cancelled contract is history. Anything else — PENDING, ACTIVE,
  // SUSPENDED — is a customer whose service still points at this device, and
  // the FK is ON DELETE SET NULL, so the purge would detach it without a word.
  private async guardAgainstLiveContract(
    deviceId: DeviceId
  ): Promise<Result<void>> {
    const result =
      await this.contractedServiceRepository.findByDeviceId(deviceId);
    if (result.isFailure) {
      return Result.fail<void>(result.error!);
    }

    const contract = result.value;
    if (contract === null || contract.isCancelled()) {
      return Result.ok<void>();
    }

    return Result.fail<void>(
      `Cannot delete a device with a live contracted service (status ${contract.status}). Cancel the service first.`
    );
  }

  // An open ticket is unfinished field work whose subject is this device.
  // Deleting it strands the technician with a job pointing at nothing.
  private async guardAgainstOpenTickets(
    deviceId: DeviceId
  ): Promise<Result<void>> {
    const result = await this.ticketRepository.countAll({
      deviceId: deviceId.toString(),
      openOnly: true
    });
    if (result.isFailure) {
      return Result.fail<void>(result.error!);
    }

    const open = result.value;
    if (open === 0) {
      return Result.ok<void>();
    }

    return Result.fail<void>(
      `Cannot delete a device with ${open} open ticket(s). Resolve or cancel them first.`
    );
  }
}
