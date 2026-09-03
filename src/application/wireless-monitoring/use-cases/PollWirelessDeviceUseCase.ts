import { Result } from 'domain/shared/core';
import { DeviceId, AlertSeverity } from 'domain/shared';
import {
  IWirelessDeviceConfigRepository,
  IWirelessSnapshotRepository,
  IWirelessAlertRecordRepository,
  WirelessAlertRecord,
  WirelessMetrics,
  WirelessClientEntry,
  WirelessAlert,
  WirelessSnapshot,
  IWirelessAlertEvaluator,
  EvaluationContext
} from 'domain/wireless-monitoring';
import { UseCase } from 'application/shared/core';
import {
  ILogger,
  IAlertPublisher,
  QUIET_HOURS_SUPPRESSED
} from 'application/shared/interfaces';
import {
  IUbiquitiHttpCollector,
  HttpCredentials,
  IDeviceCredentialsRepository,
  IDeviceRepository,
  IWirelessPollOrchestrator
} from '../interfaces';
import {
  PollWirelessDeviceRequestDTO,
  PollWirelessDeviceResponseDTO
} from '../dtos';

export class PollWirelessDeviceUseCase
  extends UseCase<
    PollWirelessDeviceRequestDTO,
    PollWirelessDeviceResponseDTO
  >
  implements IWirelessPollOrchestrator
{
  private readonly activePolls = new Set<string>();

  constructor(
    private readonly wirelessDeviceConfigRepo: IWirelessDeviceConfigRepository,
    private readonly snapshotRepo: IWirelessSnapshotRepository,
    private readonly alertRecordRepo: IWirelessAlertRecordRepository,
    private readonly credentialsRepo: IDeviceCredentialsRepository,
    private readonly httpCollector: IUbiquitiHttpCollector,
    private readonly alertEvaluator: IWirelessAlertEvaluator,
    private readonly deviceRepo: IDeviceRepository,
    private readonly alertPublisher: IAlertPublisher | null,
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
    const deviceIdStr = deviceId.toString();
    const now = new Date();

    if (this.activePolls.has(deviceIdStr)) {
      return this.ok({
        deviceId: request.deviceId,
        collectedAt: now.toISOString(),
        metricsCollected: false,
        alertsTriggered: 0,
        alertsCleared: 0,
        collectionMethod: 'http_api',
        skipped: true
      });
    }

    this.activePolls.add(deviceIdStr);
    try {
      return await this.poll(deviceId, now, request);
    } finally {
      this.activePolls.delete(deviceIdStr);
    }
  }

  private async poll(
    deviceId: DeviceId,
    now: Date,
    request: PollWirelessDeviceRequestDTO
  ): Promise<Result<PollWirelessDeviceResponseDTO>> {
    // Asked of the device itself rather than of the config's `enabled` flag,
    // which only reflects what an event handler managed to write. forceExecution
    // does not override it: a deleted or retired radio is not something a manual
    // poll should reach either.
    const ineligibleReason =
      await this.deviceRepo.findWirelessIneligibilityReason(deviceId);
    if (ineligibleReason.isFailure) {
      return this.fail(
        `Failed to check device eligibility: ${ineligibleReason.error}`
      );
    }
    if (ineligibleReason.value !== null) {
      if (request.forceExecution) {
        return this.fail(
          `Cannot poll device — ${ineligibleReason.value}`
        );
      }
      return this.ok({
        deviceId: request.deviceId,
        collectedAt: now.toISOString(),
        metricsCollected: false,
        alertsTriggered: 0,
        alertsCleared: 0,
        collectionMethod: 'http_api',
        skipped: true
      });
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

    if (!config.enabled && !request.forceExecution) {
      return this.ok({
        deviceId: request.deviceId,
        collectedAt: now.toISOString(),
        metricsCollected: false,
        alertsTriggered: 0,
        alertsCleared: 0,
        collectionMethod: 'http_api',
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

    const httpCreds: HttpCredentials = {
      username: credentials.httpUsername ?? '',
      password: credentials.httpPassword ?? '',
      port: credentials.httpPort
    };

    this.logger.info('[PollWirelessDeviceUseCase] polling device', {
      ip: ipAddress,
      port: httpCreds.port,
      username: httpCreds.username,
      hasPassword: !!httpCreds.password
    });

    const httpResult = await this.httpCollector.collect(
      ipAddress,
      httpCreds,
      config.deviceType
    );

    if (httpResult.isFailure) {
      this.logger.warn('HTTP collector failed', {
        ip: ipAddress,
        port: httpCreds.port,
        error: httpResult.error
      });
      return this.fail(
        `Failed to collect metrics: ${httpResult.error}`
      );
    }

    const http = httpResult.value;

    const snrDb =
      http.signalRxDbm !== null && http.noiseFloorDbm !== null
        ? http.signalRxDbm - http.noiseFloorDbm
        : null;

    const activeAlertsResult =
      await this.alertRecordRepo.findAllActiveByDevice(deviceId);
    const activeAlertsList = activeAlertsResult.isSuccess
      ? activeAlertsResult.value
      : [];
    const activeAlertsMap = new Map<string, WirelessAlertRecord>(
      activeAlertsList.map((a) => [`${a.metric}:${a.severity}`, a])
    );

    const latestSnapshotResult =
      await this.snapshotRepo.findLatestByDevice(deviceId);
    const previousMetrics = latestSnapshotResult.isSuccess
      ? (latestSnapshotResult.value?.metrics ?? null)
      : null;

    const ctx: EvaluationContext = {
      deviceName: http.deviceName ?? 'Equipo desconocido',
      deviceModel: http.deviceModel,
      linkCapacityKbps: config.linkCapacityKbps,
      clientsProvisionedLimit: config.clientsProvisionedLimit,
      previousMetrics,
      collectedAt: now
    };

    let remoteApDeviceId = null;
    if (http.remoteApMac) {
      const apLookup = await this.deviceRepo.findIdByMacAddress(
        http.remoteApMac
      );
      if (apLookup.isSuccess) remoteApDeviceId = apLookup.value;
    }

    const metricsResult = WirelessMetrics.create({
      signalRxDbm: http.signalRxDbm,
      signalTxDbm: http.signalTxDbm,
      noiseFloorDbm: http.noiseFloorDbm,
      snrDb,
      ccqPercent: http.ccqPercent,
      frequencyMhz: http.frequencyMhz,
      channelWidthMhz: http.channelWidthMhz,
      throughputTxBps: http.throughputTxBps,
      throughputRxBps: http.throughputRxBps,
      throughputTxPps: null,
      throughputRxPps: null,
      lanStatus: http.lanStatus,
      lanSpeedMbps: http.lanSpeedMbps,
      lanDuplex: null,
      uptimeSeconds: http.uptimeSeconds,
      cpuLoadPercent: http.cpuLoadPercent,
      memoryUsedPercent: http.memoryUsedPercent,
      clientsConnected: http.clientsConnected,
      firmwareVersion: http.firmwareVersion,
      deviceName: http.deviceName,
      remoteApMac: http.remoteApMac,
      remoteApName: http.remoteApName,
      remoteApIp: http.remoteApIp,
      distanceM: http.distanceM,
      latencyMs: http.latencyMs,
      capacityTxKbps: http.capacityTxKbps,
      capacityRxKbps: http.capacityRxKbps,
      deviceTimeEpoch: http.deviceTimeEpoch,
      macAddress: http.macAddress,
      deviceModel: http.deviceModel,
      ssid: http.essid
    });
    if (metricsResult.isFailure) {
      return this.fail(
        `Invalid metrics data from collector: ${metricsResult.error}`
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
        await this.alertRecordRepo.findActiveByDeviceMetricAndSeverity(
          deviceId,
          decision.metric,
          decision.severity
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

    await this.deliverPendingAlertNotifications(deviceId, now);

    const clients: WirelessClientEntry[] =
      config.deviceType === 'ACCESS_POINT'
        ? http.clients
            .map((c) =>
              WirelessClientEntry.create({
                macAddress: c.macAddress,
                ipAddress: c.ipAddress,
                signalRxDbm: c.signalRxDbm,
                noiseFloorDbm: c.noiseFloorDbm,
                distanceM: c.distanceM,
                uptimeSeconds: c.uptimeSeconds,
                txLatencyMs: c.txLatencyMs,
                dlLinkScore: c.dlLinkScore,
                ulLinkScore: c.ulLinkScore,
                dlCapacityKbps: c.dlCapacityKbps,
                ulCapacityKbps: c.ulCapacityKbps,
                dlCinr: c.dlCinr,
                ulCinr: c.ulCinr,
                txBytesTotal: c.txBytesTotal,
                rxBytesTotal: c.rxBytesTotal,
                txPps: c.txPps,
                rxPps: c.rxPps,
                remoteHostname: c.remoteHostname,
                remotePlatform: c.remotePlatform,
                remoteVersion: c.remoteVersion,
                remoteCpuLoad: c.remoteCpuLoad,
                remoteTotalRam: c.remoteTotalRam,
                remoteFreeRam: c.remoteFreeRam,
                remoteSignal: c.remoteSignal,
                remoteNoiseFloor: c.remoteNoiseFloor,
                remoteTxPower: c.remoteTxPower,
                remoteTxThroughputKbps: c.remoteTxThroughputKbps,
                remoteRxThroughputKbps: c.remoteRxThroughputKbps,
                remoteIpAddresses: c.remoteIpAddresses,
                dlAirtimePercent: c.dlAirtimePercent,
                ulAirtimePercent: c.ulAirtimePercent
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
      collectionMethod: 'http_api',
      metrics,
      clients,
      alerts: embeddedAlerts,
      remoteApDeviceId
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
      await this.wirelessDeviceConfigRepo.save(config);
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
      collectionMethod: 'http_api'
    });
  }

  // Retries alerts opened on earlier cycles whose delivery failed, so an
  // outage of the notification channel does not silently drop an alert.
  private async deliverPendingAlertNotifications(
    deviceId: DeviceId,
    now: Date
  ): Promise<void> {
    if (!this.alertPublisher) return;

    const pendingResult =
      await this.alertRecordRepo.findActiveUnnotifiedByDevice(
        deviceId
      );
    if (pendingResult.isFailure) {
      this.logger.error(
        'Failed to load alerts pending notification',
        undefined,
        { deviceId: deviceId.toString(), error: pendingResult.error }
      );
      return;
    }

    for (const record of pendingResult.value) {
      const sendResult = await this.alertPublisher.publish({
        deviceId: deviceId.toString(),
        severity:
          record.severity === 'CRITICAL'
            ? AlertSeverity.CRITICAL
            : AlertSeverity.WARNING,
        source: 'Enlace inalámbrico',
        subject: record.metric,
        detail: record.message,
        occurredAt: record.triggeredAt,
        resolved: false
      });

      if (sendResult.isFailure) {
        if (sendResult.error !== QUIET_HOURS_SUPPRESSED) {
          this.logger.error(
            `Alert notification failed, will retry next cycle`,
            undefined,
            { metric: record.metric, error: sendResult.error }
          );
        }
        continue;
      }

      const markResult = record.markNotified(now);
      if (markResult.isFailure) continue;

      const saveResult = await this.alertRecordRepo.save(record);
      if (saveResult.isFailure) {
        this.logger.error(
          'Failed to persist alert notification timestamp',
          undefined,
          { metric: record.metric, error: saveResult.error }
        );
      }
    }
  }
}
