import { Result } from 'domain/shared/core';
import { DeviceId } from 'domain/shared/ids';
import { IPAddress } from 'domain/shared/value-objects';
import { PollingInterval } from 'domain/wireless-monitoring/value-objects';
import { IWirelessDeviceConfigRepository } from 'domain/wireless-monitoring/repository';
import { UseCase } from 'application/shared/core';
import { ILogger } from 'application/shared/interfaces';
import { IDeviceRepository } from '../interfaces';
import {
  UpdateWirelessConfigRequestDTO,
  WirelessConfigResponseDTO
} from '../dtos';
import { WirelessDeviceConfigMapper } from '../mappers';

export class UpdateWirelessConfigUseCase extends UseCase<
  UpdateWirelessConfigRequestDTO,
  WirelessConfigResponseDTO
> {
  constructor(
    private readonly configRepo: IWirelessDeviceConfigRepository,
    private readonly deviceRepo: IDeviceRepository,
    logger: ILogger
  ) {
    super(logger, 'UpdateWirelessConfigUseCase');
  }

  protected async beforeExecute(
    request: UpdateWirelessConfigRequestDTO
  ): Promise<Result<void> | null> {
    if (!request.deviceId?.trim()) {
      return Result.fail('Device ID is required');
    }
    return null;
  }

  protected async executeImpl(
    request: UpdateWirelessConfigRequestDTO
  ): Promise<Result<WirelessConfigResponseDTO>> {
    const deviceIdResult = DeviceId.parse(request.deviceId);
    if (deviceIdResult.isFailure) {
      return this.fail(`Invalid device ID: ${deviceIdResult.error}`);
    }
    const deviceId = deviceIdResult.value;

    const configResult =
      await this.configRepo.findByDeviceId(deviceId);
    if (configResult.isFailure) {
      return this.fail(configResult.error);
    }
    const config = configResult.value;
    if (config === null) {
      return this.fail('Wireless config not found for device');
    }

    const updates =
      WirelessDeviceConfigMapper.extractUpdateData(request);

    if (updates.ipAddress !== undefined) {
      if (updates.ipAddress === null) {
        config.updateIpAddress(null);
      } else {
        const ipResult = IPAddress.create(updates.ipAddress);
        if (ipResult.isFailure) {
          return this.fail(`Invalid IP address: ${ipResult.error}`);
        }
        config.updateIpAddress(ipResult.value);
      }
    }

    // enable/disable use domain methods so the toggle event is raised
    if (updates.enabled === true) {
      // Only the enabling direction is guarded. Turning polling off is always
      // allowed, and every other field stays editable on a retired device —
      // correcting an IP on something in the workshop is harmless. Without
      // this, a form that PATCHes the whole config back would silently undo
      // the suspension a retirement had applied (DEV-089).
      const ineligibleReason =
        await this.deviceRepo.findWirelessIneligibilityReason(
          deviceId
        );
      if (ineligibleReason.isFailure) {
        return this.fail(
          `Failed to check device eligibility: ${ineligibleReason.error}`
        );
      }
      if (ineligibleReason.value !== null) {
        return this.fail(
          `Cannot enable wireless polling — ${ineligibleReason.value}`
        );
      }
      config.enable();
    } else if (updates.enabled === false) {
      config.disable();
    }

    if (updates.intervalSecs !== undefined) {
      const intervalResult = PollingInterval.create(
        updates.intervalSecs
      );
      if (intervalResult.isFailure) {
        return this.fail(
          `Invalid polling interval: ${intervalResult.error}`
        );
      }
      config.updatePollingInterval(intervalResult.value);
    }
    if (updates.linkCapacityKbps !== undefined) {
      const r = config.updateLinkCapacityKbps(
        updates.linkCapacityKbps
      );
      if (r.isFailure) return this.fail(r.error);
    }
    if (updates.clientsProvisionedLimit !== undefined) {
      const r = config.updateClientsProvisionedLimit(
        updates.clientsProvisionedLimit
      );
      if (r.isFailure) return this.fail(r.error);
    }
    if (updates.provisionedLanSpeedMbps !== undefined) {
      const r = config.updateProvisionedLanSpeedMbps(
        updates.provisionedLanSpeedMbps
      );
      if (r.isFailure) return this.fail(r.error);
    }
    if (updates.parentApDeviceId !== undefined) {
      if (updates.parentApDeviceId === null) {
        const r = config.updateParentApDeviceId(null);
        if (r.isFailure) return this.fail(r.error);
      } else {
        const parentApDeviceIdResult = DeviceId.parse(
          updates.parentApDeviceId
        );
        if (parentApDeviceIdResult.isFailure) {
          return this.fail(
            `Invalid parent AP device ID: ${parentApDeviceIdResult.error}`
          );
        }
        const r = config.updateParentApDeviceId(
          parentApDeviceIdResult.value
        );
        if (r.isFailure) return this.fail(r.error);
      }
    }
    const saveResult = await this.configRepo.save(config);
    if (saveResult.isFailure) {
      return this.fail(saveResult.error);
    }

    return this.ok(
      WirelessDeviceConfigMapper.toDTO(saveResult.value)
    );
  }
}
