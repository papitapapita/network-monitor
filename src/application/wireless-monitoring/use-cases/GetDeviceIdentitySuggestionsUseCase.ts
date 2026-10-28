import { Result } from 'domain/shared/core';
import { DeviceId } from 'domain/shared/ids';
import {
  IWirelessDeviceConfigRepository,
  IWirelessSnapshotRepository,
  WirelessDeviceConfig,
  WirelessSnapshot
} from 'domain/wireless-monitoring';
import { UseCase } from 'application/shared/core';
import { ILogger } from 'application/shared/interfaces';
import {
  IDeviceHardwareQuery,
  IDeviceRepository
} from '../interfaces';
import {
  HardwareChangeAssessor,
  resolveReportedAp
} from '../services';
import {
  DeviceIdentitySuggestionDTO,
  DeviceIdentitySuggestionsResponseDTO,
  GetWirelessClientsRequestDTO
} from '../dtos';

export class GetDeviceIdentitySuggestionsUseCase extends UseCase<
  GetWirelessClientsRequestDTO,
  DeviceIdentitySuggestionsResponseDTO
> {
  constructor(
    private readonly snapshotRepo: IWirelessSnapshotRepository,
    private readonly configRepo: IWirelessDeviceConfigRepository,
    private readonly deviceRepo: IDeviceRepository,
    private readonly hardwareQuery: IDeviceHardwareQuery,
    private readonly hardwareAssessor: HardwareChangeAssessor,
    logger: ILogger
  ) {
    super(logger, 'GetDeviceIdentitySuggestionsUseCase');
  }

  protected async beforeExecute(
    request: GetWirelessClientsRequestDTO
  ): Promise<Result<void> | null> {
    if (!request.deviceId?.trim()) {
      return Result.fail('Device ID is required');
    }
    return null;
  }

  protected async executeImpl(
    request: GetWirelessClientsRequestDTO
  ): Promise<Result<DeviceIdentitySuggestionsResponseDTO>> {
    const deviceIdResult = DeviceId.parse(request.deviceId);
    if (deviceIdResult.isFailure) {
      return this.fail(`Invalid device ID: ${deviceIdResult.error}`);
    }
    const deviceId = deviceIdResult.value;

    const hardwareLookup =
      await this.hardwareQuery.findHardware(deviceId);
    if (hardwareLookup.isFailure) {
      return this.fail(hardwareLookup.error);
    }
    const hardware = hardwareLookup.value;
    if (!hardware) {
      return this.fail('Device not found');
    }

    const snapshotResult =
      await this.snapshotRepo.findLatestByDevice(deviceId);
    if (snapshotResult.isFailure) {
      return this.fail(
        `Failed to load wireless snapshot: ${snapshotResult.error}`
      );
    }
    const snapshot = snapshotResult.value;

    if (!snapshot) {
      return this.ok({
        deviceId: deviceId.toString(),
        polled: false,
        collectedAt: null,
        suggestions: []
      });
    }

    const suggestions: DeviceIdentitySuggestionDTO[] = [];

    const polledName = snapshot.metrics.deviceName;
    if (
      polledName &&
      polledName.trim().toLowerCase() !==
        hardware.name.trim().toLowerCase()
    ) {
      suggestions.push({
        field: 'name',
        currentValue: hardware.name,
        suggestedValue: polledName.trim(),
        currentLabel: null,
        suggestedLabel: null,
        actions: ['UPDATE'],
        swapWith: null
      });
    }

    const hardwareResult = await this.hardwareAssessor.assess([
      {
        hardware,
        macAddress: snapshot.metrics.macAddress,
        deviceModel: snapshot.metrics.deviceModel
      }
    ]);
    if (hardwareResult.isFailure) {
      return this.fail(hardwareResult.error);
    }
    suggestions.push(
      ...(hardwareResult.value.get(hardware.deviceId) ?? [])
    );

    const configResult =
      await this.configRepo.findByDeviceId(deviceId);
    if (configResult.isFailure) {
      return this.fail(configResult.error);
    }
    const config = configResult.value;
    if (config?.deviceType === 'STATION') {
      const parentAp = await this.suggestParentAp(config, snapshot);
      if (parentAp) suggestions.push(parentAp);
    }

    return this.ok({
      deviceId: deviceId.toString(),
      polled: true,
      collectedAt: snapshot.collectedAt.toISOString(),
      suggestions
    });
  }

  // The poll already declares the AP on an exact MAC match; this covers what
  // it leaves to the operator: drift from a declared AP, and an AP found only
  // by IP, which can repeat across sites and so is never applied unattended.
  private async suggestParentAp(
    config: WirelessDeviceConfig,
    snapshot: WirelessSnapshot
  ): Promise<DeviceIdentitySuggestionDTO | null> {
    const reportedResult = await resolveReportedAp(
      this.deviceRepo,
      snapshot.remoteApDeviceId,
      snapshot.metrics.remoteApIp
    );
    if (reportedResult.isFailure) {
      this.logger.warn('AP lookup by IP failed', {
        deviceId: config.deviceId.toString(),
        error: reportedResult.error
      });
      return null;
    }
    const reported = reportedResult.value;
    if (!reported || reported.equals(config.deviceId)) return null;

    const declaredResult = await this.deviceRepo.findUpstreamId(
      config.deviceId
    );
    if (declaredResult.isFailure) {
      this.logger.warn('Declared AP unavailable', {
        deviceId: config.deviceId.toString(),
        error: declaredResult.error
      });
      return null;
    }
    const declared = declaredResult.value;
    if (declared?.equals(reported)) return null;

    const reportedInfo =
      await this.deviceRepo.findBasicInfoById(reported);
    if (reportedInfo.isFailure || !reportedInfo.value) return null;

    let currentLabel: string | null = null;
    if (declared) {
      const declaredInfo =
        await this.deviceRepo.findBasicInfoById(declared);
      currentLabel = declaredInfo.isSuccess
        ? (declaredInfo.value?.name ?? null)
        : null;
    }

    return {
      field: 'upstreamDeviceId',
      currentValue: declared?.toString() ?? null,
      suggestedValue: reported.toString(),
      currentLabel,
      suggestedLabel: reportedInfo.value.name,
      actions: ['UPDATE'],
      swapWith: null
    };
  }
}
