import { Result } from 'domain/shared/core';
import { DeviceId } from 'domain/shared/ids';
import { Device } from 'domain/device-inventory/aggregates';
import { IDeviceRepository } from 'domain/device-inventory/repository';
import { UpstreamLinkPolicy } from 'domain/device-inventory/services';

// Loads what UpstreamLinkPolicy needs to judge a link — the upstream device
// and the chain above it — so every path that sets one applies the same rules.
export class UpstreamAssignment {
  constructor(private readonly deviceRepository: IDeviceRepository) {}

  async resolve(
    device: Device,
    rawUpstreamId: string
  ): Promise<Result<DeviceId>> {
    const idResult = DeviceId.parse(rawUpstreamId.trim());
    if (idResult.isFailure) {
      return Result.fail(
        `Invalid upstreamDeviceId: ${idResult.error}`
      );
    }
    return this.check(device, idResult.value);
  }

  async check(
    device: Device,
    upstreamId: DeviceId
  ): Promise<Result<DeviceId>> {
    if (upstreamId.equals(device.id)) {
      return Result.fail(
        'Cannot make a device its own upstream device'
      );
    }

    const upstreamResult =
      await this.deviceRepository.findById(upstreamId);
    if (upstreamResult.isFailure) {
      return Result.fail(
        `Failed to load the upstream device: ${upstreamResult.error}`
      );
    }
    if (upstreamResult.value === null) {
      return Result.fail(
        `Upstream device not found: ${upstreamId.toString()}`
      );
    }

    const chainResult =
      await this.deviceRepository.findUpstreamChain(upstreamId);
    if (chainResult.isFailure) {
      return Result.fail(chainResult.error);
    }

    const policyResult = UpstreamLinkPolicy.check(
      device,
      upstreamResult.value,
      chainResult.value
    );
    if (policyResult.isFailure) {
      return Result.fail(policyResult.error);
    }
    return Result.ok(upstreamId);
  }
}
