import { Result } from 'domain/shared/core';
import { DeviceId } from 'domain/shared/ids';
import { MACAddress } from 'domain/shared/value-objects';
import {
  IWirelessDeviceConfigRepository,
  IWirelessSnapshotRepository,
  WirelessDeviceConfig,
  WirelessSnapshot
} from 'domain/wireless-monitoring';
import { UseCase } from 'application/shared/core';
import { ILogger } from 'application/shared/interfaces';
import {
  DeviceHardware,
  IDeviceHardwareLookup,
  IDeviceRepository
} from '../interfaces';
import {
  matchReportedModel,
  normalizeModelName,
  resolveReportedAp
} from '../services';
import {
  DeviceIdentitySuggestionAction,
  DeviceIdentitySuggestionDTO,
  DeviceIdentitySuggestionsResponseDTO,
  GetWirelessClientsRequestDTO,
  SwapCandidateDTO
} from '../dtos';

function normalizeMac(mac: string): string {
  const result = MACAddress.create(mac);
  return result.isSuccess ? result.value.value : mac.toUpperCase();
}

export class GetDeviceIdentitySuggestionsUseCase extends UseCase<
  GetWirelessClientsRequestDTO,
  DeviceIdentitySuggestionsResponseDTO
> {
  constructor(
    private readonly snapshotRepo: IWirelessSnapshotRepository,
    private readonly configRepo: IWirelessDeviceConfigRepository,
    private readonly deviceRepo: IDeviceRepository,
    private readonly hardwareLookup: IDeviceHardwareLookup,
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

    const infoResult =
      await this.deviceRepo.findBasicInfoById(deviceId);
    if (infoResult.isFailure) {
      return this.fail(infoResult.error);
    }
    const info = infoResult.value;
    if (!info) {
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
        info.name.trim().toLowerCase()
    ) {
      suggestions.push({
        field: 'name',
        currentValue: info.name,
        suggestedValue: polledName.trim(),
        currentLabel: null,
        suggestedLabel: null,
        actions: ['UPDATE'],
        swapWith: null
      });
    }

    const hardwareResult =
      await this.hardwareLookup.findHardware(deviceId);
    if (hardwareResult.isFailure) {
      return this.fail(hardwareResult.error);
    }
    const hardware = hardwareResult.value;

    let swapWith: SwapCandidateDTO | null = null;
    const polledMac = snapshot.metrics.macAddress;
    if (polledMac) {
      const normalizedPolledMac = normalizeMac(polledMac);
      const normalizedCurrentMac = info.macAddress
        ? normalizeMac(info.macAddress)
        : null;
      if (normalizedPolledMac !== normalizedCurrentMac) {
        swapWith = await this.findSwapCandidate(
          deviceId,
          normalizedPolledMac
        );
        suggestions.push({
          field: 'macAddress',
          currentValue: info.macAddress,
          suggestedValue: normalizedPolledMac,
          currentLabel: null,
          suggestedLabel: null,
          actions: swapWith
            ? ['SWAP']
            : this.macActions(normalizedCurrentMac, hardware),
          swapWith
        });
      }
    }

    const polledModel = snapshot.metrics.deviceModel?.trim();
    if (polledModel && hardware) {
      const modelSuggestion = await this.suggestModel(
        polledModel,
        hardware,
        swapWith
      );
      if (modelSuggestion.isFailure) {
        return this.fail(modelSuggestion.error);
      }
      if (modelSuggestion.value) {
        suggestions.push(modelSuggestion.value);
      }
    }

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

  // A unit in service that reports a different MAC is most likely a swapped
  // box, but could be a typo when the MAC was entered — so both are offered,
  // replacement first.
  private macActions(
    currentMac: string | null,
    hardware: DeviceHardware | null
  ): DeviceIdentitySuggestionAction[] {
    if (currentMac === null || !hardware || hardware.inInventory) {
      return ['UPDATE'];
    }
    return ['REPLACE', 'UPDATE'];
  }

  // The radio's MAC is on another inventory record: the two units traded
  // places, which swap-hardware handles and replace would refuse (the MAC is
  // taken).
  private async findSwapCandidate(
    deviceId: DeviceId,
    polledMac: string
  ): Promise<SwapCandidateDTO | null> {
    const ownerResult =
      await this.deviceRepo.findIdByMacAddress(polledMac);
    if (ownerResult.isFailure) {
      this.logger.warn('Device lookup by MAC failed', {
        deviceId: deviceId.toString(),
        error: ownerResult.error
      });
      return null;
    }
    const owner = ownerResult.value;
    if (!owner || owner.equals(deviceId)) return null;

    const ownerInfo = await this.deviceRepo.findBasicInfoById(owner);
    if (ownerInfo.isFailure || !ownerInfo.value) return null;

    return { deviceId: owner.toString(), name: ownerInfo.value.name };
  }

  private async suggestModel(
    polledModel: string,
    hardware: DeviceHardware,
    swapWith: SwapCandidateDTO | null
  ): Promise<Result<DeviceIdentitySuggestionDTO | null>> {
    if (
      normalizeModelName(polledModel) ===
      normalizeModelName(hardware.modelName)
    ) {
      return Result.ok(null);
    }

    const catalogResult =
      await this.hardwareLookup.findCatalogModels();
    if (catalogResult.isFailure) {
      return Result.fail(catalogResult.error);
    }
    const match = matchReportedModel(
      polledModel,
      catalogResult.value,
      hardware.vendorId
    );

    return Result.ok({
      field: 'deviceModel',
      currentValue: hardware.deviceModelId,
      suggestedValue: match?.id ?? null,
      currentLabel: hardware.modelName,
      suggestedLabel: match?.model ?? polledModel,
      actions: swapWith
        ? ['SWAP']
        : hardware.inInventory
          ? ['UPDATE']
          : ['REPLACE'],
      swapWith
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
