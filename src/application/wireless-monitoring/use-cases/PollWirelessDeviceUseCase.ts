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
  EvaluationContext,
  IAlertThresholdsRepository,
  AlertDecision,
  WirelessDeviceConfig,
  evaluateParentApDrift,
  PARENT_AP_MISMATCH_METRIC,
  PARENT_AP_MISMATCH_POLLS,
  ParentApNames,
  ConfirmationSample,
  needsConfirmation,
  confirmAlertDecisions
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
  WirelessCollectionResult,
  WirelessReader,
  IWirelessCollector,
  DecryptedCredentials
} from '../interfaces';
import {
  PollWirelessDeviceRequestDTO,
  PollWirelessDeviceResponseDTO
} from '../dtos';
import { CollectedMetricsMapper } from '../mappers';
import {
  resolveAlertThresholds,
  resolveReportedAp
} from '../services';

// Shared with the controller, which picks the status from them (WLS-029).
export const AGENT_READ_FAILURES: Record<AgentReadRefusal, string> = {
  AGENT_OFFLINE: 'its on-site agent is not connected',
  PROBE_UNSUPPORTED:
    'its on-site agent must be updated to read it on demand',
  TIMEOUT: 'its on-site agent did not answer in time',
  AGENT_ERROR: 'its on-site agent could not read it'
};

export interface AlertConfirmationConfig {
  samples: number;
  intervalMs: number;
  // how long a rejected alert waits before the radio is re-read for it
  cooldownMs: number;
}

// About half a minute of readings: long enough to outlast a burst or a
// fade, short enough that a real fault still alerts promptly (WLS-203).
export const DEFAULT_ALERT_CONFIRMATION: AlertConfirmationConfig = {
  samples: 5,
  intervalMs: 4000,
  cooldownMs: 10 * 60_000
};

interface RadioTarget {
  reader: WirelessReader;
  collector: IWirelessCollector;
  ipAddress: string;
  vendorSlug: string;
  deviceType: 'STATION' | 'ACCESS_POINT';
  credentials: DecryptedCredentials;
}

type RadioRead =
  | { kind: 'read'; collected: WirelessCollectionResult; at: Date }
  | { kind: 'skipped' }
  | { kind: 'failed'; error: string };

export class PollWirelessDeviceUseCase
  extends UseCase<
    PollWirelessDeviceRequestDTO,
    PollWirelessDeviceResponseDTO
  >
  implements IWirelessPollOrchestrator
{
  private readonly activePolls = new Set<string>();
  private readonly confirmationCooldowns = new Map<string, number>();

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
    private readonly alertThresholdsRepo: IAlertThresholdsRepository,
    private readonly alertPublisher: IAlertPublisher | null,
    logger: ILogger,
    private readonly agentReader: IAgentRadioReader = NoAgentRadioReader,
    private readonly confirmation: AlertConfirmationConfig = DEFAULT_ALERT_CONFIRMATION
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

    const radio: RadioTarget = {
      reader,
      collector,
      ipAddress,
      vendorSlug,
      deviceType: config.deviceType,
      credentials
    };
    const read = await this.readRadio(
      radio,
      request.forceExecution ?? false,
      now
    );
    if (read.kind === 'skipped') {
      return this.ok(this.skipped(request, now));
    }
    if (read.kind === 'failed') return this.fail(read.error);
    const collected = read.collected;
    // The rest of the cycle is timed by the reading, which an agent may have
    // taken some seconds after this poll started.
    const collectedAt = read.at;

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

    const thresholdsResult = await resolveAlertThresholds(
      this.alertThresholdsRepo,
      deviceId
    );
    if (thresholdsResult.isFailure) {
      return this.fail(
        `Failed to load alert thresholds: ${thresholdsResult.error}`
      );
    }

    const ctx: EvaluationContext = {
      deviceName: collected.deviceName ?? 'Equipo desconocido',
      deviceModel: collected.deviceModel,
      linkCapacityKbps: linkCapacity?.kbps ?? null,
      clientsProvisionedLimit: config.clientsProvisionedLimit,
      provisionedLanSpeedMbps: config.provisionedLanSpeedMbps,
      previousMetrics,
      collectedAt,
      thresholds: thresholdsResult.value
    };

    let remoteApDeviceId = null;
    if (collected.remoteApMac) {
      const apLookup = await this.deviceRepo.findIdByMacAddress(
        collected.remoteApMac
      );
      if (apLookup.isSuccess) remoteApDeviceId = apLookup.value;
    }
    const declaredResult = await this.declaredUpstream(
      config,
      remoteApDeviceId
    );

    const metricsResult = CollectedMetricsMapper.toMetrics(collected);
    if (metricsResult.isFailure) {
      return this.fail(
        `Invalid metrics data from collector: ${metricsResult.error}`
      );
    }
    const metrics = metricsResult.value;

    // Unknown is not "none": judging drift against a failed read would
    // reset the streak and clear a real alert, so the poll skips it instead.
    if (declaredResult.isFailure) {
      this.logger.warn('Declared AP unavailable for wireless poll', {
        deviceId: deviceId.toString(),
        error: declaredResult.error
      });
    }
    const driftDecision = declaredResult.isSuccess
      ? await this.evaluateParentApDrift(
          config,
          declaredResult.value,
          remoteApDeviceId,
          collected.remoteApIp,
          activeAlertsMap,
          ctx.deviceName
        )
      : null;
    const evaluated = this.alertEvaluator.evaluate(
      metrics,
      activeAlertsMap,
      ctx
    );
    const decisions = [
      ...(await this.confirmAlerts(
        evaluated,
        radio,
        activeAlertsMap,
        ctx,
        deviceId,
        now
      )),
      ...(driftDecision ? [driftDecision] : [])
    ];

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

  private async readRadio(
    radio: RadioTarget,
    forceExecution: boolean,
    now: Date
  ): Promise<RadioRead> {
    const { reader, collector, ipAddress, vendorSlug } = radio;
    if (reader.by === 'agent') {
      const answer = await this.agentReader.read(reader.agentId, {
        ipAddress,
        vendor: vendorSlug,
        deviceType: radio.deviceType,
        credentials: radio.credentials
      });
      if (answer.kind === 'refused') {
        // The schedule waits for the agent to come back (or be updated)
        // instead of counting each cycle as a failed poll.
        if (
          !forceExecution &&
          (answer.reason === 'AGENT_OFFLINE' ||
            answer.reason === 'PROBE_UNSUPPORTED')
        ) {
          return { kind: 'skipped' };
        }
        this.logger.warn('Agent could not read the radio', {
          ip: ipAddress,
          vendor: vendorSlug,
          reason: answer.reason,
          error: answer.error
        });
        const reason = AGENT_READ_FAILURES[answer.reason];
        return {
          kind: 'failed',
          error: `Cannot poll device — ${
            answer.reason === 'AGENT_ERROR'
              ? `${reason}: ${answer.error}`
              : reason
          }`
        };
      }
      return {
        kind: 'read',
        collected: answer.reading,
        at: answer.measuredAt
      };
    }

    const collectResult = await collector.collect(
      ipAddress,
      radio.credentials,
      radio.deviceType
    );
    if (collectResult.isFailure) {
      this.logger.warn('Wireless collector failed', {
        ip: ipAddress,
        vendor: vendorSlug,
        method: collector.method,
        error: collectResult.error
      });
      return {
        kind: 'failed',
        error: `Failed to collect metrics: ${collectResult.error}`
      };
    }
    return { kind: 'read', collected: collectResult.value, at: now };
  }

  // Holds back the alerts a single reading misjudges until a short run of
  // fresh readings agrees with it (WLS-203).
  private async confirmAlerts(
    decisions: AlertDecision[],
    radio: RadioTarget,
    activeAlerts: Map<string, WirelessAlertRecord>,
    ctx: EvaluationContext,
    deviceId: DeviceId,
    now: Date
  ): Promise<AlertDecision[]> {
    if (!ctx.thresholds.confirmBeforeAlerting) return decisions;
    const candidates = decisions.filter(needsConfirmation);
    if (candidates.length === 0) return decisions;

    const nowMs = now.getTime();
    const cooldownKey = (d: AlertDecision): string =>
      `${deviceId.toString()}:${d.metric}:${d.severity}`;
    const toCheck = candidates.filter((d) => {
      const until = this.confirmationCooldowns.get(cooldownKey(d));
      if (until === undefined) return true;
      if (until > nowMs) return false;
      this.confirmationCooldowns.delete(cooldownKey(d));
      return true;
    });

    const confirmed = new Set<AlertDecision>();
    if (toCheck.length > 0) {
      const samples = await this.takeConfirmationSamples(
        radio,
        activeAlerts,
        ctx
      );
      const outcome = confirmAlertDecisions(toCheck, samples);
      for (const d of outcome.confirmed) confirmed.add(d);
      for (const d of outcome.rejected) {
        this.confirmationCooldowns.set(
          cooldownKey(d),
          nowMs + this.confirmation.cooldownMs
        );
      }
      if (outcome.rejected.length > 0) {
        this.logger.info(
          'Alert not confirmed by re-reading the radio',
          {
            deviceId: deviceId.toString(),
            alerts: outcome.rejected.map(
              (d) => `${d.metric}:${d.severity}`
            ),
            samples: samples.length
          }
        );
      }
    }

    return decisions.filter(
      (d) => !needsConfirmation(d) || confirmed.has(d)
    );
  }

  private async takeConfirmationSamples(
    radio: RadioTarget,
    activeAlerts: Map<string, WirelessAlertRecord>,
    ctx: EvaluationContext
  ): Promise<ConfirmationSample[]> {
    const samples: ConfirmationSample[] = [];
    for (let i = 0; i < this.confirmation.samples; i++) {
      await new Promise((resolve) =>
        setTimeout(resolve, this.confirmation.intervalMs)
      );
      const read = await this.readRadio(radio, true, new Date());
      if (read.kind !== 'read') continue;
      const metrics = CollectedMetricsMapper.toMetrics(
        read.collected
      );
      if (metrics.isFailure) continue;
      samples.push({
        metrics: metrics.value,
        decisions: this.alertEvaluator.evaluate(
          metrics.value,
          activeAlerts,
          { ...ctx, collectedAt: read.at }
        )
      });
    }
    return samples;
  }

  // An exact MAC match is certain enough to declare the AP unattended;
  // weaker matches only surface as identity suggestions.
  private async declaredUpstream(
    config: WirelessDeviceConfig,
    macMatch: DeviceId | null
  ): Promise<Result<DeviceId | null>> {
    if (config.deviceType !== 'STATION') return Result.ok(null);

    const upstreamResult = await this.deviceRepo.findUpstreamId(
      config.deviceId
    );
    if (upstreamResult.isFailure) {
      return Result.fail(
        `Failed to read the declared AP: ${upstreamResult.error}`
      );
    }
    if (upstreamResult.value !== null || macMatch === null) {
      return Result.ok(upstreamResult.value);
    }

    const declareResult =
      await this.deviceRepo.declareUpstreamIfUnset(
        config.deviceId,
        macMatch
      );
    if (declareResult.isFailure) {
      this.logger.warn('Could not declare the reported AP', {
        deviceId: config.deviceId.toString(),
        error: declareResult.error
      });
      return Result.ok(null);
    }
    return Result.ok(declareResult.value ? macMatch : null);
  }

  private async evaluateParentApDrift(
    config: WirelessDeviceConfig,
    declared: DeviceId | null,
    macMatch: DeviceId | null,
    remoteApIp: string | null,
    activeAlerts: Map<string, WirelessAlertRecord>,
    deviceName: string
  ): Promise<AlertDecision | null> {
    if (config.deviceType !== 'STATION') return null;

    let reported: DeviceId | null = null;
    if (declared) {
      const reportedResult = await resolveReportedAp(
        this.deviceRepo,
        macMatch,
        remoteApIp
      );
      if (reportedResult.isFailure) {
        this.logger.warn('AP lookup by IP failed', {
          deviceId: config.deviceId.toString(),
          error: reportedResult.error
        });
      } else {
        reported = reportedResult.value;
        config.recordReportedParentAp(reported, declared);
      }
    }

    const alertActive = activeAlerts.has(
      `${PARENT_AP_MISMATCH_METRIC}:WARNING`
    );
    const apNames =
      !alertActive &&
      declared &&
      reported &&
      config.parentApMismatchPolls >= PARENT_AP_MISMATCH_POLLS
        ? await this.parentApNames(declared, reported)
        : null;
    return evaluateParentApDrift(
      config,
      declared,
      alertActive,
      deviceName,
      apNames
    );
  }

  private async parentApNames(
    declared: DeviceId,
    reported: DeviceId
  ): Promise<ParentApNames | null> {
    const [declaredInfo, reportedInfo] = await Promise.all([
      this.deviceRepo.findBasicInfoById(declared),
      this.deviceRepo.findBasicInfoById(reported)
    ]);
    if (
      declaredInfo.isFailure ||
      !declaredInfo.value ||
      reportedInfo.isFailure ||
      !reportedInfo.value
    ) {
      return null;
    }
    return {
      declared: declaredInfo.value.name,
      reported: reportedInfo.value.name
    };
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
