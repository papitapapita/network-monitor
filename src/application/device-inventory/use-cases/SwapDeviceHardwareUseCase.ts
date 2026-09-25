import { Result } from 'domain/shared/core';
import { DeviceId } from 'domain/shared/ids';
import { Device } from 'domain/device-inventory/aggregates';
import {
  IDeviceHardwareSwapRepository,
  IDeviceModelRepository,
  IDeviceRepository
} from 'domain/device-inventory/repository';
import { IWirelessDeviceConfigRepository } from 'domain/wireless-monitoring/repository';
import { UseCase } from 'application/shared/core';
import { ILogger } from 'application/shared/interfaces';
import {
  SwapDeviceHardwareRequestDTO,
  SwapDeviceHardwareResponseDTO
} from '../dtos';
import { DeviceMapper } from '../mappers';

// Two working units physically traded places, so each record's model, serial
// and MAC must follow the box it now sits behind. Everything tied to the site
// — IP, location, credentials, contract, wireless config, history — stays put.
//
// The one thing a swap can break outside the aggregates is a wireless config:
// it needs a radio, and a record that holds one cannot be handed a model that
// has none. That check spans two repositories, so it lives here.
export class SwapDeviceHardwareUseCase extends UseCase<
  SwapDeviceHardwareRequestDTO,
  SwapDeviceHardwareResponseDTO
> {
  constructor(
    private readonly deviceRepository: IDeviceRepository,
    private readonly hardwareSwapRepository: IDeviceHardwareSwapRepository,
    private readonly deviceModelRepository: IDeviceModelRepository,
    private readonly wirelessConfigRepository: IWirelessDeviceConfigRepository,
    logger: ILogger
  ) {
    super(logger, 'SwapDeviceHardwareUseCase');
  }

  protected async beforeExecute(
    request: SwapDeviceHardwareRequestDTO
  ): Promise<Result<void> | null> {
    if (!request.id || request.id.trim().length === 0) {
      return Result.fail('Device ID is required');
    }

    if (
      !request.otherDeviceId ||
      request.otherDeviceId.trim().length === 0
    ) {
      return Result.fail('otherDeviceId is required');
    }

    return null;
  }

  protected async executeImpl(
    request: SwapDeviceHardwareRequestDTO
  ): Promise<Result<SwapDeviceHardwareResponseDTO>> {
    const firstResult = await this.loadDevice(request.id);
    if (firstResult.isFailure) {
      return this.fail<SwapDeviceHardwareResponseDTO>(
        firstResult.error
      );
    }

    const secondResult = await this.loadDevice(request.otherDeviceId);
    if (secondResult.isFailure) {
      return this.fail<SwapDeviceHardwareResponseDTO>(
        secondResult.error
      );
    }

    const first = firstResult.value;
    const second = secondResult.value;

    const radioResult = await this.checkRadioSurvives(first, second);
    if (radioResult.isFailure) {
      return this.fail<SwapDeviceHardwareResponseDTO>(
        radioResult.error
      );
    }

    const swapResult = first.swapHardwareWith(second);
    if (swapResult.isFailure) {
      return this.fail<SwapDeviceHardwareResponseDTO>(
        swapResult.error
      );
    }

    const saveResult =
      await this.hardwareSwapRepository.saveHardwareSwap(first, second);
    if (saveResult.isFailure) {
      return this.fail<SwapDeviceHardwareResponseDTO>(
        saveResult.error!
      );
    }

    return this.ok({
      device: DeviceMapper.toDTO(first),
      otherDevice: DeviceMapper.toDTO(second)
    });
  }

  private async loadDevice(rawId: string): Promise<Result<Device>> {
    const idResult = DeviceId.parse(rawId.trim());
    if (idResult.isFailure) {
      return Result.fail<Device>(
        `Invalid device ID: ${idResult.error}`
      );
    }

    const findResult = await this.deviceRepository.findById(
      idResult.value
    );
    if (findResult.isFailure) {
      return Result.fail<Device>(findResult.error!);
    }

    if (findResult.value === null) {
      return Result.fail<Device>(`Device not found: ${rawId}`);
    }

    return Result.ok<Device>(findResult.value);
  }

  private async checkRadioSurvives(
    first: Device,
    second: Device
  ): Promise<Result<void>> {
    if (first.deviceModelId.equals(second.deviceModelId)) {
      return Result.ok<void>();
    }

    for (const [device, incoming] of [
      [first, second],
      [second, first]
    ]) {
      const configResult =
        await this.wirelessConfigRepository.findByDeviceId(device.id);
      if (configResult.isFailure) {
        return Result.fail<void>(configResult.error!);
      }

      if (configResult.value === null) {
        continue;
      }

      const modelResult = await this.deviceModelRepository.findById(
        incoming.deviceModelId
      );
      if (modelResult.isFailure) {
        return Result.fail<void>(modelResult.error!);
      }

      if (modelResult.value !== null && !modelResult.value.isWireless) {
        return Result.fail<void>(
          `Cannot swap hardware: "${device.name.value}" has a wireless configuration and would receive a model with no radio`
        );
      }
    }

    return Result.ok<void>();
  }
}
