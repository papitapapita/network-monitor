import { Result } from 'domain/shared/core';
import { DeviceId } from 'domain/shared/ids';
import { MACAddress } from 'domain/shared/value-objects';
import {
  IWirelessDeviceConfigRepository,
  IWirelessSnapshotRepository
} from 'domain/wireless-monitoring';
import { UseCase } from 'application/shared/core';
import { ILogger } from 'application/shared/interfaces';
import { IDeviceRepository } from '../interfaces';
import {
  ExpectedApClientDTO,
  GetWirelessClientsRequestDTO,
  WirelessClientDTO,
  WirelessExpectedClientsResponseDTO
} from '../dtos';
import { WirelessSnapshotMapper } from '../mappers';

function normalizeMac(mac: string): string {
  const result = MACAddress.create(mac);
  return result.isSuccess ? result.value.value : mac.toUpperCase();
}

export class GetApExpectedClientsUseCase extends UseCase<
  GetWirelessClientsRequestDTO,
  WirelessExpectedClientsResponseDTO
> {
  constructor(
    private readonly configRepo: IWirelessDeviceConfigRepository,
    private readonly snapshotRepo: IWirelessSnapshotRepository,
    private readonly deviceRepo: IDeviceRepository,
    logger: ILogger
  ) {
    super(logger, 'GetApExpectedClientsUseCase');
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
  ): Promise<Result<WirelessExpectedClientsResponseDTO>> {
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
    if (!config) {
      return this.fail(
        'No wireless polling configuration found for device'
      );
    }
    if (config.deviceType !== 'ACCESS_POINT') {
      return this.fail(
        'NOT_AP: This device is a CPE and has no expected-client roster'
      );
    }

    const expectedConfigsResult =
      await this.configRepo.findByParentApDeviceId(deviceId);
    if (expectedConfigsResult.isFailure) {
      return this.fail(expectedConfigsResult.error);
    }
    const expectedConfigs = expectedConfigsResult.value;

    const snapshotResult =
      await this.snapshotRepo.findLatestByDevice(deviceId);
    if (snapshotResult.isFailure) {
      return this.fail(
        `Failed to load wireless snapshot: ${snapshotResult.error}`
      );
    }
    const snapshot = snapshotResult.value;

    const liveByMac = new Map<string, WirelessClientDTO>();
    if (snapshot) {
      for (const client of snapshot.clients) {
        liveByMac.set(
          normalizeMac(client.macAddress),
          WirelessSnapshotMapper.toClientDTO(client)
        );
      }
    }

    const expected: ExpectedApClientDTO[] = [];
    for (const stationConfig of expectedConfigs) {
      const infoResult = await this.deviceRepo.findBasicInfoById(
        stationConfig.deviceId
      );
      const info = infoResult.isSuccess ? infoResult.value : null;
      const mac = info?.macAddress
        ? normalizeMac(info.macAddress)
        : null;
      const client = mac ? (liveByMac.get(mac) ?? null) : null;

      if (mac && client) {
        liveByMac.delete(mac);
      }

      expected.push({
        deviceId: stationConfig.deviceId.toString(),
        deviceName: info?.name ?? 'Equipo desconocido',
        macAddress: info?.macAddress ?? null,
        connected: client !== null,
        client
      });
    }

    return this.ok({
      apDeviceId: deviceId.toString(),
      collectedAt: snapshot?.collectedAt.toISOString() ?? null,
      expected,
      missingCount: expected.filter((e) => !e.connected).length,
      unexpectedConnected: Array.from(liveByMac.values())
    });
  }
}
