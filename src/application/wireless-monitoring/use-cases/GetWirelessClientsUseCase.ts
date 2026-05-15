import { Result } from 'domain/shared/core';
import { DeviceId } from 'domain/shared';
import { IWirelessSnapshotRepository } from 'domain/wireless-monitoring';
import { UseCase } from 'application/shared/core';
import { ILogger } from 'application/shared/interfaces';
import { GetWirelessClientsRequestDTO } from '../dtos/GetWirelessClientsRequestDTO';
import { WirelessClientListResponseDTO } from '../dtos/WirelessClientListResponseDTO';
import { WirelessClientDTO } from '../dtos/WirelessClientDTO';

export class GetWirelessClientsUseCase extends UseCase<
  GetWirelessClientsRequestDTO,
  WirelessClientListResponseDTO
> {
  constructor(
    private readonly snapshotRepo: IWirelessSnapshotRepository,
    logger: ILogger
  ) {
    super(logger, 'GetWirelessClientsUseCase');
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
  ): Promise<Result<WirelessClientListResponseDTO>> {
    const deviceIdResult = DeviceId.parse(request.deviceId);
    if (deviceIdResult.isFailure) {
      return this.fail(`Invalid device ID: ${deviceIdResult.error}`);
    }
    const deviceId = deviceIdResult.value;

    const snapshotResult = await this.snapshotRepo.findLatestByDevice(deviceId);
    if (snapshotResult.isFailure) {
      return this.fail(`Failed to load wireless snapshot: ${snapshotResult.error}`);
    }
    const snapshot = snapshotResult.value;
    if (!snapshot) {
      return this.fail('No wireless data found for device');
    }

    if (snapshot.deviceType === 'CPE') {
      return this.fail('NOT_AP: This device is a CPE and does not have a client list');
    }

    const clients: WirelessClientDTO[] = snapshot.clients.map(c => ({
      macAddress: c.macAddress,
      signalRxDbm: c.signalRxDbm,
      signalTxDbm: c.signalTxDbm,
      snrDb: c.snrDb,
      txRateMbps: c.txRateMbps,
      rxRateMbps: c.rxRateMbps,
      throughputTxBps: c.throughputTxBps,
      throughputRxBps: c.throughputRxBps,
      ccqPercent: c.ccqPercent,
      uptimeSeconds: c.uptimeSeconds,
      ipAddress: c.ipAddress,
    }));

    return this.ok({
      deviceId: request.deviceId,
      collectedAt: snapshot.collectedAt.toISOString(),
      clients,
    });
  }
}
