import { Result } from 'domain/shared/core';
import { DeviceId } from 'domain/shared';
import {
  IWirelessPollingConfigRepository,
  IWirelessSnapshotRepository,
  IWirelessAlertRecordRepository,
  WirelessAlertRecord,
  WirelessMetrics,
  WirelessClientEntry,
  WirelessAlert,
  WirelessSnapshot
} from 'domain/wireless-monitoring';
import { UseCase } from 'application/shared/core';
import { ILogger } from 'application/shared/interfaces';
import {
  ISNMPCollector,
  SNMPCredentials,
  IUbiquitiHttpCollector,
  HttpCredentials,
  IWirelessCounterStore,
  CounterSnapshot,
  IDeviceCredentialsRepository,
  IWirelessAlertEvaluator,
  IWirelessPollOrchestrator
} from '../interfaces';
import { EvaluationContext } from '../services/WirelessAlertEvaluator';
import { PollWirelessDeviceRequestDTO } from '../dtos/PollWirelessDeviceRequestDTO';
import { PollWirelessDeviceResponseDTO } from '../dtos/PollWirelessDeviceResponseDTO';

export class PollWirelessDeviceUseCase
  extends UseCase<
    PollWirelessDeviceRequestDTO,
    PollWirelessDeviceResponseDTO
  >
  implements IWirelessPollOrchestrator
{
  constructor(
    private readonly wirelessPollingConfigRepo: IWirelessPollingConfigRepository,
    private readonly snapshotRepo: IWirelessSnapshotRepository,
    private readonly alertRecordRepo: IWirelessAlertRecordRepository,
    private readonly credentialsRepo: IDeviceCredentialsRepository,
    private readonly snmpCollector: ISNMPCollector,
    private readonly httpCollector: IUbiquitiHttpCollector,
    private readonly counterStore: IWirelessCounterStore,
    private readonly alertEvaluator: IWirelessAlertEvaluator,
    logger: ILogger
  ) {
    super(logger, 'PollWirelessDeviceUseCase');
  }

  protected async beforeExecute(
    request: PollWirelessDeviceRequestDTO
  ): Promise<Result<void> | null> {
    if (!request.deviceId?.trim()) {
      return Result.fail('Device ID is required');
    }
    return null;
  }

  protected async executeImpl(
    request: PollWirelessDeviceRequestDTO
  ): Promise<Result<PollWirelessDeviceResponseDTO>> {
    const deviceIdResult = DeviceId.parse(request.deviceId);
    if (deviceIdResult.isFailure) {
      return this.fail(`Invalid device ID: ${deviceIdResult.error}`);
    }
    const deviceId = deviceIdResult.value;
    const now = new Date();

    const configResult =
      await this.wirelessPollingConfigRepo.findByDeviceId(deviceId);
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

    if (!config.enabled && !request.forceExecution) {
      return this.ok({
        deviceId: request.deviceId,
        collectedAt: now.toISOString(),
        metricsCollected: false,
        alertsTriggered: 0,
        alertsCleared: 0,
        collectionMethod: 'snmp',
        skipped: true
      });
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
      return this.fail('No credentials configured for device');
    }

    if (!config.ipAddress) {
      return this.fail(
        'Device has no IP address configured for polling'
      );
    }

    const ipAddress = config.ipAddress.value;

    const snmpCreds: SNMPCredentials = {
      version: credentials.snmpVersion,
      community: credentials.snmpCommunity ?? undefined,
      authUser: credentials.snmpV3AuthUser ?? undefined,
      authProtocol: credentials.snmpV3AuthProto ?? undefined,
      authKey: credentials.snmpV3AuthKey ?? undefined,
      privProtocol: credentials.snmpV3PrivProto ?? undefined,
      privKey: credentials.snmpV3PrivKey ?? undefined,
      port: credentials.snmpPort
    };

    const httpCreds: HttpCredentials = {
      username: credentials.httpUsername ?? '',
      password: credentials.httpPassword ?? '',
      port: credentials.httpPort
    };

    // Retry logic on transient SNMP failures is the responsibility of the
    // ISNMPCollector implementation (infrastructure layer), not the use case.
    const snmpResult = await this.snmpCollector.collect(
      ipAddress,
      snmpCreds
    );

    const httpResult = await this.httpCollector.collect(
      ipAddress,
      httpCreds
    );

    const isSnmpOk = snmpResult.isSuccess;
    const isHttpOk = httpResult.isSuccess;

    let collectionMethod: 'snmp' | 'http_api' | 'mixed';
    if (isSnmpOk && isHttpOk) {
      collectionMethod = 'mixed';
    } else if (isSnmpOk) {
      collectionMethod = 'snmp';
    } else if (isHttpOk) {
      collectionMethod = 'http_api';
    } else {
      return this.fail(
        'Failed to collect metrics: both SNMP and HTTP collectors failed'
      );
    }

    const snmp = isSnmpOk ? snmpResult.value : null;
    const http = isHttpOk ? httpResult.value : null;

    // firmwareVersion is extracted from sysDescr by the ISNMPCollector
    // implementation (infrastructure concern). The use case reads the typed field.
    const firmwareVersion = snmp?.firmwareVersion ?? null;

    const counterSnapshot: CounterSnapshot = {
      ifHCInOctets: snmp?.ifHCInOctets ?? null,
      ifHCOutOctets: snmp?.ifHCOutOctets ?? null,
      ifInUcastPkts: snmp?.ifInUcastPkts ?? null,
      ifOutUcastPkts: snmp?.ifOutUcastPkts ?? null,
      timestamp: now
    };

    const delta = this.counterStore.computeDelta(
      deviceId.toString(),
      counterSnapshot
    );
    this.counterStore.store(deviceId.toString(), counterSnapshot);

    const activeAlertsResult =
      await this.alertRecordRepo.findAllActiveByDevice(deviceId);
    const activeAlertsList = activeAlertsResult.isSuccess
      ? activeAlertsResult.value
      : [];
    const activeAlertsMap = new Map<string, WirelessAlertRecord>(
      activeAlertsList.map((a) => [`${a.metric}:${a.severity}`, a])
    );

    const ctx: EvaluationContext = {
      deviceName:
        snmp?.sysName ?? http?.deviceName ?? 'Equipo desconocido',
      linkCapacityBps: config.linkCapacityBps,
      clientsProvisionedLimit: config.clientsProvisionedLimit
    };

    const metricsResult = WirelessMetrics.create({
      signalRxDbm: snmp?.signalRxDbm ?? http?.signalRxDbm ?? null,
      signalTxDbm: snmp?.signalTxDbm ?? null,
      noiseFloorDbm:
        snmp?.noiseFloorDbm ?? http?.noiseFloorDbm ?? null,
      snrDb: snmp?.snrDb ?? null,
      ccqPercent: snmp?.ccqPercent ?? http?.ccqPercent ?? null,
      txRateMbps: snmp?.txRateMbps ?? http?.txRateMbps ?? null,
      rxRateMbps: snmp?.rxRateMbps ?? http?.rxRateMbps ?? null,
      frequencyMhz: snmp?.frequencyMhz ?? http?.frequencyMhz ?? null,
      channelWidthMhz: snmp?.channelWidthMhz ?? null,
      txPowerDbm: snmp?.txPowerDbm ?? http?.txPowerDbm ?? null,
      throughputTxBps: delta.throughputTxBps,
      throughputRxBps: delta.throughputRxBps,
      throughputTxPps: delta.throughputTxPps,
      throughputRxPps: delta.throughputRxPps,
      lanStatus: snmp?.lanStatus ?? http?.lanStatus ?? null,
      lanSpeedMbps: snmp?.lanSpeedMbps ?? http?.lanSpeedMbps ?? null,
      lanDuplex: snmp?.lanDuplex ?? null,
      uptimeSeconds:
        snmp?.uptimeSeconds ?? http?.uptimeSeconds ?? null,
      cpuLoadPercent: snmp?.cpuLoadPercent ?? null,
      memoryUsedPercent: snmp?.memoryUsedPercent ?? null,
      clientsConnected: snmp?.clientsConnected ?? null,
      clientsProvisioned: config.clientsProvisionedLimit,
      firmwareVersion:
        firmwareVersion ?? http?.firmwareVersion ?? null,
      deviceName: snmp?.sysName ?? http?.deviceName ?? null,
      remoteApMac: snmp?.remoteApMac ?? http?.remoteApMac ?? null,
      remoteApName: snmp?.remoteApName ?? http?.remoteApName ?? null,
      distanceM: snmp?.distanceM ?? http?.distanceM ?? null,
      latencyMs: snmp?.latencyMs ?? http?.latencyMs ?? null
    });
    if (metricsResult.isFailure) {
      return this.fail(
        `Invalid metrics data from collectors: ${metricsResult.error}`
      );
    }
    const metrics = metricsResult.value;

    const decisions = this.alertEvaluator.evaluate(
      metrics,
      activeAlertsMap,
      ctx
    );

    const openDecisions = decisions.filter(
      (d) => d.action === 'OPEN'
    );
    const clearDecisions = decisions.filter(
      (d) => d.action === 'CLEAR'
    );

    for (const decision of openDecisions) {
      const recordResult = WirelessAlertRecord.open(
        deviceId,
        decision.metric,
        decision.severity,
        decision.threshold,
        decision.currentValue,
        decision.message
      );
      if (recordResult.isSuccess) {
        const saveResult = await this.alertRecordRepo.save(
          recordResult.value
        );
        if (saveResult.isFailure) {
          this.logger.error(
            `Failed to save alert record for metric ${decision.metric}`,
            undefined,
            { metric: decision.metric, deviceId: deviceId.toString() }
          );
        }
      }
    }

    for (const decision of clearDecisions) {
      const findResult =
        await this.alertRecordRepo.findActiveByDeviceAndMetric(
          deviceId,
          decision.metric
        );
      if (findResult.isSuccess && findResult.value) {
        const clearResult = findResult.value.clear(now);
        if (clearResult.isSuccess) {
          const saveResult = await this.alertRecordRepo.save(
            findResult.value
          );
          if (saveResult.isFailure) {
            this.logger.error(
              `Failed to save cleared alert for metric ${decision.metric}`,
              undefined,
              {
                metric: decision.metric,
                deviceId: deviceId.toString()
              }
            );
          }
        }
      }
    }

    let httpClientsResult: Awaited<
      ReturnType<typeof this.httpCollector.collectClients>
    > | null = null;
    if (config.deviceType === 'ACCESS_POINT' && isHttpOk) {
      httpClientsResult = await this.httpCollector.collectClients(
        ipAddress,
        httpCreds
      );
    }

    const clients: WirelessClientEntry[] =
      config.deviceType === 'ACCESS_POINT' &&
      httpClientsResult !== null &&
      httpClientsResult.isSuccess
        ? httpClientsResult.value
            .map((c) =>
              WirelessClientEntry.create({
                macAddress: c.macAddress,
                signalRxDbm: c.signalRxDbm,
                signalTxDbm: c.signalTxDbm,
                snrDb: c.snrDb,
                txRateMbps: c.txRateMbps,
                rxRateMbps: c.rxRateMbps,
                throughputTxBps: null,
                throughputRxBps: null,
                ccqPercent: c.ccqPercent,
                uptimeSeconds: c.uptimeSeconds,
                ipAddress: c.ipAddress
              })
            )
            .filter((r) => r.isSuccess)
            .map((r) => r.value)
        : [];

    const embeddedAlerts: WirelessAlert[] = openDecisions.map((d) =>
      WirelessAlert.reconstitute({
        metric: d.metric,
        severity: d.severity,
        threshold: d.threshold,
        currentValue: d.currentValue,
        message: d.message,
        triggeredAt: now
      })
    );

    const snapshot = WirelessSnapshot.create({
      deviceId,
      deviceType: config.deviceType,
      collectedAt: now,
      collectionMethod,
      metrics,
      clients,
      alerts: embeddedAlerts
    });

    const snapshotSaveResult = await this.snapshotRepo.save(snapshot);
    if (snapshotSaveResult.isFailure) {
      this.logger.error(
        'Failed to save wireless snapshot',
        undefined,
        {
          deviceId: deviceId.toString(),
          error: snapshotSaveResult.error
        }
      );
    }

    config.markPolled(now);
    const configSaveResult =
      await this.wirelessPollingConfigRepo.save(config);
    if (configSaveResult.isFailure) {
      this.logger.error(
        'Failed to update polling config lastPolledAt',
        undefined,
        {
          deviceId: deviceId.toString(),
          error: configSaveResult.error
        }
      );
    }

    return this.ok({
      deviceId: request.deviceId,
      collectedAt: now.toISOString(),
      metricsCollected: true,
      alertsTriggered: openDecisions.length,
      alertsCleared: clearDecisions.length,
      collectionMethod
    });
  }
}
