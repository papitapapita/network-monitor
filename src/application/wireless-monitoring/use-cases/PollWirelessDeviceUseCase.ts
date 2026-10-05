import { Result } from 'domain/shared/core';
import { DeviceId, AlertSeverity } from 'domain/shared';
import {
  IWirelessDeviceConfigRepository,
  IWirelessSnapshotRepository,
  IWirelessAlertRecordRepository,
  WirelessAlertRecord,
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
  isSuppressedPublish
} from 'application/shared/interfaces';
import {
  IWirelessCollectorResolver,
  IDeviceVendorLookup,
  IDeviceCredentialsRepository,
  IDeviceRepository,
  IWirelessPollOrchestrator,
  IContractedCapacityProvider,
  IDeviceReach,
  OUT_OF_SERVER_REACH,
  IAgentRadioReader,
  NoAgentRadioReader,
  AgentReadRefusal,
  WirelessCollectionResult
} from '../interfaces';
import {
  PollWirelessDeviceRequestDTO,
  PollWirelessDeviceResponseDTO
} from '../dtos';
import { CollectedMetricsMapper } from '../mappers';

// Shared with the controller, which picks the status from them (WLS-029).
export const AGENT_READ_FAILURES: Record<AgentReadRefusal, string> = {
  AGENT_OFFLINE: 'its on-site agent is not connected',
  PROBE_UNSUPPORTED:
    'its on-site agent must be updated to read it on demand',
  TIMEOUT: 'its on-site agent did not answer in time',
  AGENT_ERROR: 'its on-site agent could not read it'
};

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
    private readonly collectors: IWirelessCollectorResolver,
    private readonly vendorLookup: IDeviceVendorLookup,
    private readonly alertEvaluator: IWirelessAlertEvaluator,
    private readonly deviceRepo: IDeviceRepository,
    private readonly deviceReach: IDeviceReach,
    private readonly contractedCapacity: IContractedCapacityProvider,
    private readonly alertPublisher: IAlertPublisher | null,
    logger: ILogger,
    private readonly agentReader: IAgentRadioReader = NoAgentRadioReader
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
      return this.ok(this.skipped(request, now));
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
    // The scheduler already leaves such devices out (WLS-029); this refuses
    // the manual poll.
    const readerResult = await this.deviceReach.readerFor(deviceId);
    if (readerResult.isFailure) {
      return this.fail(
        `Failed to check device reach: ${readerResult.error}`
      );
    }
    const reader = readerResult.value;
    const refusal =
      ineligibleReason.value ??
      (reader.by === 'none' ? OUT_OF_SERVER_REACH : null);
    if (refusal !== null) {
      if (request.forceExecution) {
        return this.fail(`Cannot poll device — ${refusal}`);
      }
      return this.ok(this.skipped(request, now));
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
      return this.ok(this.skipped(request, now));
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

    this.logger.info('[PollWirelessDeviceUseCase] polling device', {
      ip: ipAddress,
      vendor: vendorSlug,
      method: collector.method,
      by: reader.by
    });

    let collected: WirelessCollectionResult;
    // The rest of the cycle is timed by the reading, which an agent may have
    // taken some seconds after this poll started.
    let collectedAt = now;
    if (reader.by === 'agent') {
      const answer = await this.agentReader.read(reader.agentId, {
        ipAddress,
        vendor: vendorSlug,
        deviceType: config.deviceType,
        credentials
      });
      if (answer.kind === 'refused') {
        // The schedule waits for the agent to come back (or be updated)
        // instead of counting each cycle as a failed poll.
        if (
          !request.forceExecution &&
          (answer.reason === 'AGENT_OFFLINE' ||
            answer.reason === 'PROBE_UNSUPPORTED')
        ) {
          return this.ok(this.skipped(request, now));
        }
        this.logger.warn('Agent could not read the radio', {
          ip: ipAddress,
          vendor: vendorSlug,
          reason: answer.reason,
          error: answer.error
        });
        const reason = AGENT_READ_FAILURES[answer.reason];
        return this.fail(
          `Cannot poll device — ${
            answer.reason === 'AGENT_ERROR'
              ? `${reason}: ${answer.error}`
              : reason
          }`
        );
      }
      collected = answer.reading;
      collectedAt = answer.measuredAt;
    } else {
      const collectResult = await collector.collect(
        ipAddress,
        credentials,
        config.deviceType
      );

      if (collectResult.isFailure) {
        this.logger.warn('Wireless collector failed', {
          ip: ipAddress,
          vendor: vendorSlug,
          method: collector.method,
          error: collectResult.error
        });
        return this.fail(
          `Failed to collect metrics: ${collectResult.error}`
        );
      }
      collected = collectResult.value;
    }

    // Auto-calibrate this device's LAN-speed baseline off its first
    // reported speed, so WLS-089 can warn on degradation from whatever
    // this specific port normally negotiates at, not a fixed value.
    if (collected.lanSpeedMbps !== null) {
      config.captureLanSpeedBaselineIfUnset(collected.lanSpeedMbps);
    }

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

    // A failed lookup degrades to the manual value rather than failing the
    // poll: metrics and every other rule still matter without the plan.
    const contractedResult =
      await this.contractedCapacity.findKbpsByDeviceId(deviceId);
    if (contractedResult.isFailure) {
      this.logger.warn(
        'Contracted capacity unavailable for wireless poll',
        {
          deviceId: deviceId.toString(),
          error: contractedResult.error
        }
      );
    }
    const linkCapacity = config.resolveLinkCapacity(
      contractedResult.isSuccess ? contractedResult.value : null
    );

    const ctx: EvaluationContext = {
      deviceName: collected.deviceName ?? 'Equipo desconocido',
      deviceModel: collected.deviceModel,
      linkCapacityKbps: linkCapacity?.kbps ?? null,
      clientsProvisionedLimit: config.clientsProvisionedLimit,
      provisionedLanSpeedMbps: config.provisionedLanSpeedMbps,
      previousMetrics,
      collectedAt
    };

    let remoteApDeviceId = null;
    if (collected.remoteApMac) {
      const apLookup = await this.deviceRepo.findIdByMacAddress(
        collected.remoteApMac
      );
      if (apLookup.isSuccess) remoteApDeviceId = apLookup.value;
    }

    const metricsResult = CollectedMetricsMapper.toMetrics(collected);
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
        const clearResult = findResult.value.clear(
          collectedAt,
          decision.message
        );
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

    await this.deliverPendingAlertNotifications(
      deviceId,
      collectedAt
    );

    const clients: WirelessClientEntry[] =
      config.deviceType === 'ACCESS_POINT'
        ? collected.clients
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
        triggeredAt: collectedAt
      })
    );

    const snapshot = WirelessSnapshot.create({
      deviceId,
      deviceType: config.deviceType,
      collectedAt,
      collectionMethod: collector.method,
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

    config.markPolled(collectedAt);
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
      collectedAt: collectedAt.toISOString(),
      metricsCollected: true,
      alertsTriggered: openDecisions.length,
      alertsCleared: clearDecisions.length,
      collectionMethod: collector.method
    });
  }

  private skipped(
    request: PollWirelessDeviceRequestDTO,
    now: Date
  ): PollWirelessDeviceResponseDTO {
    return {
      deviceId: request.deviceId,
      collectedAt: now.toISOString(),
      metricsCollected: false,
      alertsTriggered: 0,
      alertsCleared: 0,
      collectionMethod: 'http_api',
      skipped: true
    };
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
        summary: record.message,
        detail: null,
        occurredAt: record.triggeredAt,
        resolved: false,
        type: `wireless:${record.metric}:${record.severity}`
      });

      if (sendResult.isFailure) {
        if (!isSuppressedPublish(sendResult.error)) {
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
