import { Result } from 'domain/shared/core';
import { AgentId, DeviceId } from 'domain/shared/ids';
import { Device } from 'domain/device-inventory/aggregates';
import { IDeviceRepository } from 'domain/device-inventory/repository';
import { UseCase } from 'application/shared/core';
import { ILogger } from 'application/shared/interfaces';
import {
  AssignDevicesToAgentRequestDTO,
  AssignDevicesToAgentResponseDTO
} from '../dtos';
import { AgentAssignmentPolicy } from '../services';

// Moves many devices behind one agent at once — how an install migrates onto
// its first agent, how devices follow a replaced PC, and how they fall back
// to in-process polling if an agent misbehaves (ADR 0002, 1.9). Each device
// is its own aggregate and its own save, so one refusal does not undo the
// rest; the response says which ones moved.
export class AssignDevicesToAgentUseCase extends UseCase<
  AssignDevicesToAgentRequestDTO,
  AssignDevicesToAgentResponseDTO
> {
  constructor(
    private readonly deviceRepository: IDeviceRepository,
    private readonly agentAssignment: AgentAssignmentPolicy,
    logger: ILogger
  ) {
    super(logger, 'AssignDevicesToAgentUseCase');
  }

  protected async beforeExecute(
    request: AssignDevicesToAgentRequestDTO
  ): Promise<Result<void> | null> {
    const byIds = request.deviceIds !== undefined;
    const byAgent = request.fromAgentId !== undefined;
    if (byIds === byAgent) {
      return Result.fail(
        'Provide exactly one of deviceIds or fromAgentId (required)'
      );
    }
    if (byIds && request.deviceIds!.length === 0) {
      return Result.fail('deviceIds must contain at least one id');
    }
    return null;
  }

  protected async executeImpl(
    request: AssignDevicesToAgentRequestDTO
  ): Promise<Result<AssignDevicesToAgentResponseDTO>> {
    let target: AgentId | null = null;
    if (request.agentId !== null) {
      const agentResult = await this.agentAssignment.resolve(
        request.agentId
      );
      if (agentResult.isFailure) {
        return this.fail(agentResult.error);
      }
      target = agentResult.value;
    }

    const selection =
      request.deviceIds !== undefined
        ? await this.selectByIds(request.deviceIds)
        : await this.selectByAgent(request.fromAgentId!);
    if (selection.isFailure) {
      return this.fail(selection.error);
    }

    const { devices, failed } = selection.value;
    const assigned: string[] = [];
    for (const device of devices) {
      const id = device.id.toString();
      const assignResult = device.assignAgent(target);
      if (assignResult.isFailure) {
        failed.push({ id, error: assignResult.error });
        continue;
      }
      const saveResult = await this.deviceRepository.save(device);
      if (saveResult.isFailure) {
        failed.push({ id, error: saveResult.error });
        continue;
      }
      assigned.push(id);
    }

    return this.ok({ assigned, failed });
  }

  private async selectByIds(rawIds: string[]): Promise<
    Result<{
      devices: Device[];
      failed: AssignDevicesToAgentResponseDTO['failed'];
    }>
  > {
    const devices: Device[] = [];
    const failed: AssignDevicesToAgentResponseDTO['failed'] = [];
    for (const rawId of new Set(rawIds)) {
      const idResult = DeviceId.parse(rawId);
      if (idResult.isFailure) {
        failed.push({
          id: rawId,
          error: `Invalid device ID: ${rawId}`
        });
        continue;
      }
      const findResult = await this.deviceRepository.findById(
        idResult.value
      );
      if (findResult.isFailure) {
        failed.push({ id: rawId, error: findResult.error });
        continue;
      }
      if (findResult.value === null) {
        failed.push({
          id: rawId,
          error: `Device not found: ${rawId}`
        });
        continue;
      }
      devices.push(findResult.value);
    }
    return Result.ok({ devices, failed });
  }

  private async selectByAgent(rawFromAgentId: string | null): Promise<
    Result<{
      devices: Device[];
      failed: AssignDevicesToAgentResponseDTO['failed'];
    }>
  > {
    let from: AgentId | null = null;
    if (rawFromAgentId !== null) {
      const idResult = AgentId.parse(rawFromAgentId.trim());
      if (idResult.isFailure) {
        return Result.fail(`Invalid fromAgentId: ${idResult.error}`);
      }
      from = idResult.value;
    }

    const findResult = await this.deviceRepository.findByAgent(from);
    if (findResult.isFailure) {
      return Result.fail(findResult.error);
    }
    return Result.ok({ devices: findResult.value, failed: [] });
  }
}
