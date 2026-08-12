import { MACAddress } from 'domain/shared/value-objects';
import { DeviceId, DeviceModelId } from 'domain/shared/ids';
import { Result } from 'domain/shared/core';
import { Device } from 'domain/device-inventory/aggregates';
import {
  IDeviceModelRepository,
  IDeviceRepository
} from 'domain/device-inventory/repository';
import {
  DeviceName,
  DeviceStatus,
  SerialNumber
} from 'domain/device-inventory/value-objects';
import { IContractedServiceRepository } from 'domain/customers/repository';
import { IWirelessDeviceConfigRepository } from 'domain/wireless-monitoring/repository';
import { UseCase } from 'application/shared/core';
import { ILogger } from 'application/shared/interfaces';
import { parseIso8601Date } from 'application/shared/utils';
import { IDeviceCredentialsRepository } from '../interfaces';
import {
  ReplaceDeviceRequestDTO,
  ReplaceDeviceResponseDTO
} from '../dtos';
import { DeviceMapper } from '../mappers';

// A physically different box takes over an existing unit's job.
//
// This cannot be an update to the existing row. A Device is one physical unit
// and every metric — pingResults, wirelessSnapshots, alertEvents — hangs off
// its id, so editing deviceModelId in place would retroactively re-attribute
// months of readings to hardware that never produced them. DEV-063 refuses
// that outright, which is precisely why this operation exists instead.
//
// It is an orchestrator rather than something an operator can do by hand
// because three links have to move together: the IP, the credentials, and the
// customer's contracted service. Miss the last one and the billing link
// detaches with no error.
export class ReplaceDeviceUseCase extends UseCase<
  ReplaceDeviceRequestDTO,
  ReplaceDeviceResponseDTO
> {
  constructor(
    private readonly deviceRepository: IDeviceRepository,
    private readonly deviceModelRepository: IDeviceModelRepository,
    private readonly deviceCredentialsRepository: IDeviceCredentialsRepository,
    private readonly contractedServiceRepository: IContractedServiceRepository,
    private readonly wirelessConfigRepository: IWirelessDeviceConfigRepository,
    logger: ILogger
  ) {
    super(logger, 'ReplaceDeviceUseCase');
  }

  protected async beforeExecute(
    request: ReplaceDeviceRequestDTO
  ): Promise<Result<void> | null> {
    if (!request.id || request.id.trim().length === 0) {
      return Result.fail('Device ID is required');
    }

    if (
      !request.deviceModelId ||
      request.deviceModelId.trim().length === 0
    ) {
      return Result.fail('deviceModelId is required');
    }

    if (
      !request.retiredStatus ||
      request.retiredStatus.trim().length === 0
    ) {
      return Result.fail('retiredStatus is required');
    }

    const statusResult = DeviceStatus.create(request.retiredStatus);
    if (statusResult.isFailure) {
      return Result.fail(statusResult.error);
    }

    if (!statusResult.value.isRetired()) {
      return Result.fail(
        `Cannot retire a replaced device as ${statusResult.value.toString()} — must be one of: ${DeviceStatus.retiredStatuses().join(', ')}`
      );
    }

    // The replacement is a different physical box, and a box out of service is
    // only identifiable by what is printed on it (DEV-053). Requiring one here
    // rather than letting Device.create fail keeps the message about the
    // replacement rather than about an aggregate invariant.
    if (!request.serialNumber && !request.macAddress) {
      return Result.fail(
        'The replacement device must have at least a serial number or MAC address'
      );
    }

    return null;
  }

  protected async executeImpl(
    request: ReplaceDeviceRequestDTO
  ): Promise<Result<ReplaceDeviceResponseDTO>> {
    const now = new Date();

    const oldDeviceResult = await this.loadOldDevice(request.id);
    if (oldDeviceResult.isFailure) {
      return this.fail<ReplaceDeviceResponseDTO>(
        oldDeviceResult.error
      );
    }
    const oldDevice = oldDeviceResult.value;

    const newModelResult = await this.loadNewModel(
      request.deviceModelId
    );
    if (newModelResult.isFailure) {
      return this.fail<ReplaceDeviceResponseDTO>(
        newModelResult.error
      );
    }
    const { newModelId, newModelIsWireless } = newModelResult.value;

    const buildResult = this.buildReplacementFields(request);
    if (buildResult.isFailure) {
      return this.fail<ReplaceDeviceResponseDTO>(buildResult.error);
    }
    const fields = buildResult.value;

    // Read everything that has to move before anything changes, so a failure
    // partway through cannot lose a link we no longer know how to find.
    const credentialsResult =
      await this.deviceCredentialsRepository.findByDeviceId(
        oldDevice.id
      );
    if (credentialsResult.isFailure) {
      return this.fail<ReplaceDeviceResponseDTO>(
        credentialsResult.error!
      );
    }

    const contractResult =
      await this.contractedServiceRepository.findByDeviceId(
        oldDevice.id
      );
    if (contractResult.isFailure) {
      return this.fail<ReplaceDeviceResponseDTO>(
        contractResult.error!
      );
    }

    const wirelessConfigResult =
      await this.wirelessConfigRepository.findByDeviceId(
        oldDevice.id
      );
    if (wirelessConfigResult.isFailure) {
      return this.fail<ReplaceDeviceResponseDTO>(
        wirelessConfigResult.error!
      );
    }

    const releasedIpAddress = oldDevice.ipAddress;

    // Retire first. The old unit gives up its IP here, which is what lets the
    // new row claim it — both are live, so the partial unique index on
    // ip_address would reject the pair otherwise.
    const retireResult = oldDevice.markReplaced(
      DeviceStatus.create(request.retiredStatus).value,
      now
    );
    if (retireResult.isFailure) {
      return this.fail<ReplaceDeviceResponseDTO>(
        retireResult.error
      );
    }

    const saveOldResult =
      await this.deviceRepository.save(oldDevice);
    if (saveOldResult.isFailure) {
      return this.fail<ReplaceDeviceResponseDTO>(
        saveOldResult.error!
      );
    }

    const newDeviceResult = Device.create({
      deviceModelId: newModelId,
      // Inherited: the replacement stands in the same place, serves the same
      // customer, and plays the same role as the unit it succeeds.
      locationId: oldDevice.locationId,
      category: oldDevice.category,
      ownerType: oldDevice.ownerType,
      // Keyed off the inherited IP, not the retired unit's status — by this
      // point markReplaced has already rewritten that to retiredStatus. A
      // replacement that took over an address is being commissioned; one that
      // did not is a box waiting to be installed.
      status: releasedIpAddress
        ? DeviceStatus.createCommissioning()
        : DeviceStatus.createInventory(),
      name: fields.name ?? oldDevice.name,
      serialNumber: fields.serialNumber,
      macAddress: fields.macAddress,
      ipAddress: releasedIpAddress,
      description: fields.description ?? oldDevice.description,
      installedDate: fields.installedDate ?? now,
      replacesDeviceId: oldDevice.id,
      replacedAt: now
    });

    if (newDeviceResult.isFailure) {
      return this.fail<ReplaceDeviceResponseDTO>(
        newDeviceResult.error
      );
    }

    const saveNewResult = await this.deviceRepository.save(
      newDeviceResult.value
    );
    if (saveNewResult.isFailure) {
      return this.fail<ReplaceDeviceResponseDTO>(
        saveNewResult.error!
      );
    }

    const newDevice = saveNewResult.value;

    let credentialsTransferred = false;
    if (credentialsResult.value !== null) {
      const writeResult =
        await this.deviceCredentialsRepository.save(
          newDevice.id,
          credentialsResult.value
        );
      if (writeResult.isFailure) {
        return this.fail<ReplaceDeviceResponseDTO>(
          `Replacement created but credentials could not be transferred: ${writeResult.error}`
        );
      }

      // Only after the copy lands. The old row's credentials are the sole
      // remaining source until then.
      await this.deviceCredentialsRepository.delete(oldDevice.id);
      credentialsTransferred = true;
    }

    let contractedServiceTransferred = false;
    if (contractResult.value !== null) {
      const contract = contractResult.value;
      const assignResult = contract.assignDevice(newDevice.id);
      if (assignResult.isFailure) {
        return this.fail<ReplaceDeviceResponseDTO>(
          `Replacement created but the contracted service could not be re-pointed: ${assignResult.error}`
        );
      }

      const saveContractResult =
        await this.contractedServiceRepository.save(contract);
      if (saveContractResult.isFailure) {
        return this.fail<ReplaceDeviceResponseDTO>(
          `Replacement created but the contracted service could not be re-pointed: ${saveContractResult.error}`
        );
      }
      contractedServiceTransferred = true;
    }

    // The old unit's wireless config is not copied. If the replacement has no
    // radio the config has to go, and DEV-027 no longer cascades deletions for
    // us — it refuses instead — so the removal is explicit and reported.
    let wirelessConfigRemoved = false;
    if (wirelessConfigResult.value !== null && !newModelIsWireless) {
      const removeResult =
        await this.wirelessConfigRepository.delete(oldDevice.id);
      if (removeResult.isFailure) {
        this.logger.error(
          '[ReplaceDeviceUseCase] Failed to remove the wireless config of the retired device',
          undefined,
          {
            deviceId: oldDevice.id.toString(),
            error: removeResult.error
          }
        );
      } else {
        wirelessConfigRemoved = true;
      }
    }

    return this.ok({
      // The retired aggregate was loaded before its successor existed, so its
      // back-reference is still empty in memory. Filling it here is a
      // derivation, not a guess: the successor's replacesDeviceId is what
      // defines this value, and we just wrote it. Without this the response
      // reports null for a link the very next read returns.
      retiredDevice: {
        ...DeviceMapper.toDTO(oldDevice),
        replacedByDeviceId: newDevice.id.toString()
      },
      newDevice: DeviceMapper.toDTO(newDevice),
      wirelessConfigRemoved,
      credentialsTransferred,
      contractedServiceTransferred
    });
  }

  private async loadOldDevice(
    rawId: string
  ): Promise<Result<Device>> {
    const deviceIdResult = DeviceId.parse(rawId.trim());
    if (deviceIdResult.isFailure) {
      return Result.fail<Device>(
        `Invalid device ID: ${deviceIdResult.error}`
      );
    }

    const findResult = await this.deviceRepository.findById(
      deviceIdResult.value
    );
    if (findResult.isFailure) {
      return Result.fail<Device>(findResult.error!);
    }

    if (findResult.value === null) {
      return Result.fail<Device>(`Device not found: ${rawId}`);
    }

    return Result.ok<Device>(findResult.value);
  }

  private async loadNewModel(rawId: string): Promise<
    Result<{
      newModelId: DeviceModelId;
      newModelIsWireless: boolean;
    }>
  > {
    const modelIdResult = DeviceModelId.parse(rawId.trim());
    if (modelIdResult.isFailure) {
      return Result.fail(
        `Invalid device model ID: ${modelIdResult.error}`
      );
    }

    const modelResult = await this.deviceModelRepository.findById(
      modelIdResult.value
    );
    if (modelResult.isFailure) {
      return Result.fail(modelResult.error!);
    }

    if (modelResult.value === null) {
      return Result.fail(`Device model not found: ${rawId}`);
    }

    return Result.ok({
      newModelId: modelIdResult.value,
      newModelIsWireless: modelResult.value.isWireless
    });
  }

  private buildReplacementFields(
    request: ReplaceDeviceRequestDTO
  ): Result<{
    name: DeviceName | null;
    serialNumber: SerialNumber | null;
    macAddress: MACAddress | null;
    description: string | null;
    installedDate: Date | null;
  }> {
    let name: DeviceName | null = null;
    if (request.name) {
      const nameResult = DeviceName.create(request.name);
      if (nameResult.isFailure) {
        return Result.fail(nameResult.error);
      }
      name = nameResult.value;
    }

    let serialNumber: SerialNumber | null = null;
    if (request.serialNumber) {
      const serialResult = SerialNumber.create(request.serialNumber);
      if (serialResult.isFailure) {
        return Result.fail(serialResult.error);
      }
      serialNumber = serialResult.value;
    }

    let macAddress: MACAddress | null = null;
    if (request.macAddress) {
      const macResult = MACAddress.create(request.macAddress);
      if (macResult.isFailure) {
        return Result.fail(macResult.error);
      }
      macAddress = macResult.value;
    }

    let installedDate: Date | null = null;
    if (request.installedDate) {
      installedDate = parseIso8601Date(request.installedDate);
      if (installedDate === null) {
        return Result.fail(
          `Invalid installedDate: "${request.installedDate}". Must be ISO 8601.`
        );
      }
    }

    return Result.ok({
      name,
      serialNumber,
      macAddress,
      description: request.description ?? null,
      installedDate
    });
  }
}
