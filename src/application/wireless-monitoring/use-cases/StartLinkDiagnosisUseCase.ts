import { Result } from 'domain/shared/core';
import { DeviceId } from 'domain/shared/ids';
import {
  IWirelessDeviceConfigRepository,
  IWirelessSnapshotRepository,
  WirelessDeviceConfig,
  DiagnosisDuration,
  DEFAULT_DIAGNOSIS_SECONDS
} from 'domain/wireless-monitoring';
import { UseCase } from 'application/shared/core';
import { ILogger } from 'application/shared/interfaces';
import {
  IContractedCapacityProvider,
  IDeviceCredentialsRepository,
  IDeviceRepository,
  IDeviceVendorLookup,
  ILinkDiagnosisRunner,
  IWirelessCollectorResolver,
  LinkDiagnosisTarget
} from '../interfaces';
import {
  StartLinkDiagnosisRequestDTO,
  StartLinkDiagnosisResponseDTO
} from '../dtos';

export class StartLinkDiagnosisUseCase extends UseCase<
  StartLinkDiagnosisRequestDTO,
  StartLinkDiagnosisResponseDTO
> {
  constructor(
    private readonly wirelessDeviceConfigRepo: IWirelessDeviceConfigRepository,
    private readonly snapshotRepo: IWirelessSnapshotRepository,
    private readonly credentialsRepo: IDeviceCredentialsRepository,
    private readonly collectors: IWirelessCollectorResolver,
    private readonly vendorLookup: IDeviceVendorLookup,
    private readonly deviceRepo: IDeviceRepository,
    private readonly contractedCapacity: IContractedCapacityProvider,
    private readonly runner: ILinkDiagnosisRunner,
    logger: ILogger
  ) {
    super(logger, 'StartLinkDiagnosisUseCase');
  }

  protected async beforeExecute(
    request: StartLinkDiagnosisRequestDTO
  ): Promise<Result<void> | null> {
    if (!request.deviceId?.trim()) {
      return Result.fail('Device ID is required');
    }
    return null;
  }

  protected async executeImpl(
    request: StartLinkDiagnosisRequestDTO
  ): Promise<Result<StartLinkDiagnosisResponseDTO>> {
    const deviceIdResult = DeviceId.parse(request.deviceId);
    if (deviceIdResult.isFailure) {
      return this.fail(`Invalid device ID: ${deviceIdResult.error}`);
    }
    const deviceId = deviceIdResult.value;

    const durationResult = DiagnosisDuration.create(
      request.durationSeconds ?? DEFAULT_DIAGNOSIS_SECONDS
    );
    if (durationResult.isFailure) {
      return this.fail(durationResult.error);
    }

    // a running session is joined as-is, so none of the lookups below are
    // needed to hand it back
    const running = this.runner.find(deviceId.toString());
    if (running && running.status === 'RUNNING') {
      return this.ok({ started: false, diagnosis: running });
    }

    const ineligibleReason =
      await this.deviceRepo.findWirelessIneligibilityReason(deviceId);
    if (ineligibleReason.isFailure) {
      return this.fail(
        `Failed to check device eligibility: ${ineligibleReason.error}`
      );
    }
    if (ineligibleReason.value !== null) {
      return this.fail(
        `Cannot diagnose device — ${ineligibleReason.value}`
      );
    }

    const configResult =
      await this.wirelessDeviceConfigRepo.findByDeviceId(deviceId);
    if (configResult.isFailure) {
      return this.fail(
        `Failed to load wireless polling config: ${configResult.error}`
      );
    }
    const config = configResult.value;
    if (!config) {
      return this.fail(
        'No wireless polling configuration found for device'
      );
    }
    if (!config.ipAddress) {
      return this.fail('Device has no IP address configured');
    }

    const credentialsResult =
      await this.credentialsRepo.findByDeviceId(deviceId);
    if (credentialsResult.isFailure) {
      return this.fail(
        `Failed to load credentials: ${credentialsResult.error}`
      );
    }
    const credentials = credentialsResult.value;
    if (!credentials) {
      return this.fail('Credentials not configured for device');
    }

    const vendorResult =
      await this.vendorLookup.findVendorSlug(deviceId);
    if (vendorResult.isFailure) {
      return this.fail(
        `Failed to look up device vendor: ${vendorResult.error}`
      );
    }
    const vendorSlug = vendorResult.value;
    if (!vendorSlug) {
      return this.fail(
        'Device has no vendor to choose a collector by'
      );
    }
    const collector = this.collectors.forVendor(vendorSlug);
    if (!collector) {
      return this.fail(
        `Wireless polling is not supported for vendor '${vendorSlug}'`
      );
    }

    const parent = await this.resolveParent(deviceId, config);

    // the plan is only a refinement of the capacity figure — a failed
    // lookup falls back to the manual value rather than blocking a diagnosis
    const contractedResult =
      await this.contractedCapacity.findKbpsByDeviceId(deviceId);
    const linkCapacity = config.resolveLinkCapacity(
      contractedResult.isSuccess ? contractedResult.value : null
    );

    const target: LinkDiagnosisTarget = {
      deviceId: deviceId.toString(),
      deviceType: config.deviceType,
      ipAddress: config.ipAddress.value,
      parent,
      collector,
      credentials,
      durationSeconds: durationResult.value.seconds,
      linkCapacityKbps: linkCapacity?.kbps ?? null,
      clientsProvisionedLimit: config.clientsProvisionedLimit,
      provisionedLanSpeedMbps: config.provisionedLanSpeedMbps
    };

    const startResult = this.runner.startOrJoin(target);
    if (startResult.isFailure) {
      return this.fail(startResult.error);
    }
    return this.ok(startResult.value);
  }

  // The declared parent AP wins; otherwise the AP the radio last reported
  // being associated with. An AP has no parent hop to compare against.
  private async resolveParent(
    deviceId: DeviceId,
    config: WirelessDeviceConfig
  ): Promise<LinkDiagnosisTarget['parent']> {
    if (config.deviceType !== 'STATION') return null;

    if (config.parentApDeviceId) {
      const parentConfig =
        await this.wirelessDeviceConfigRepo.findByDeviceId(
          config.parentApDeviceId
        );
      if (parentConfig.isSuccess && parentConfig.value?.ipAddress) {
        return {
          deviceId: config.parentApDeviceId.toString(),
          ipAddress: parentConfig.value.ipAddress.value
        };
      }
    }

    const snapshotResult =
      await this.snapshotRepo.findLatestByDevice(deviceId);
    const snapshot = snapshotResult.isSuccess
      ? snapshotResult.value
      : null;
    const remoteApIp = snapshot?.metrics.remoteApIp ?? null;
    if (!remoteApIp) return null;

    return {
      deviceId: snapshot!.remoteApDeviceId?.toString() ?? null,
      ipAddress: remoteApIp
    };
  }
}
