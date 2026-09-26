import { Result } from 'domain/shared/core';
import {
  IWirelessAlertEvaluator,
  ILinkDiagnosisAnalyzer
} from 'domain/wireless-monitoring';
import {
  IEventStreamHub,
  ILogger
} from 'application/shared/interfaces';
import { IPingService } from 'application/device-monitoring/interfaces';
import {
  ILinkDiagnosisRunner,
  LinkDiagnosisStart,
  LinkDiagnosisTarget,
  TOO_MANY_DIAGNOSES
} from 'application/wireless-monitoring/interfaces';
import {
  LinkDiagnosisDTO,
  PingHop
} from 'application/wireless-monitoring/dtos';
import { LinkDiagnosisSession } from 'application/wireless-monitoring/services';
import {
  diagnosisDeviceChannel,
  DIAGNOSIS_PING_EVENT,
  DIAGNOSIS_RADIO_EVENT,
  DIAGNOSIS_REPORT_EVENT,
  DIAGNOSIS_END_EVENT
} from 'application/wireless-monitoring/channels';

export interface LinkDiagnosisRunnerConfig {
  maxSessions?: number;
  pingIntervalMs?: number;
  // the AirOS UI itself refreshes status about this often; faster starts to
  // load the radio's embedded web server
  radioIntervalMs?: number;
  pingTimeoutMs?: number;
  // how long a finished session stays readable for GET and late viewers
  retentionMs?: number;
}

type Probe = PingHop | 'RADIO';

interface ActiveSession {
  session: LinkDiagnosisSession;
  target: LinkDiagnosisTarget;
  timers: ReturnType<typeof setInterval>[];
  endTimer: ReturnType<typeof setTimeout>;
  // a probe that outlives its interval is skipped, not stacked
  inFlight: Set<Probe>;
}

export class LinkDiagnosisRunner implements ILinkDiagnosisRunner {
  private readonly maxSessions: number;
  private readonly pingIntervalMs: number;
  private readonly radioIntervalMs: number;
  private readonly pingTimeoutMs: number;
  private readonly retentionMs: number;

  private readonly running = new Map<string, ActiveSession>();
  private readonly finished = new Map<string, LinkDiagnosisSession>();

  constructor(
    private readonly hub: IEventStreamHub,
    private readonly pingService: IPingService,
    private readonly evaluator: IWirelessAlertEvaluator,
    private readonly analyzer: ILinkDiagnosisAnalyzer,
    private readonly logger: ILogger,
    config: LinkDiagnosisRunnerConfig = {},
    private readonly clock: () => Date = () => new Date()
  ) {
    this.maxSessions = config.maxSessions ?? 5;
    this.pingIntervalMs = config.pingIntervalMs ?? 1000;
    this.radioIntervalMs = config.radioIntervalMs ?? 2000;
    this.pingTimeoutMs = config.pingTimeoutMs ?? 1000;
    this.retentionMs = config.retentionMs ?? 15 * 60_000;
  }

  startOrJoin(
    target: LinkDiagnosisTarget
  ): Result<LinkDiagnosisStart> {
    const now = this.clock();
    const existing = this.running.get(target.deviceId);
    if (existing) {
      return Result.ok({
        started: false,
        diagnosis: existing.session.toDTO(now, false)
      });
    }

    if (this.running.size >= this.maxSessions) {
      return Result.fail(TOO_MANY_DIAGNOSES);
    }

    const session = new LinkDiagnosisSession(
      target,
      now,
      this.evaluator,
      this.analyzer
    );
    const active: ActiveSession = {
      session,
      target,
      timers: [],
      endTimer: setTimeout(
        () => this.finish(target.deviceId, 'COMPLETED'),
        target.durationSeconds * 1000
      ),
      inFlight: new Set()
    };
    active.endTimer.unref?.();

    const tickTarget = (): void =>
      this.ping(active, 'TARGET', target.ipAddress);
    const tickRadio = (): void => this.readRadio(active);
    active.timers.push(setInterval(tickTarget, this.pingIntervalMs));
    active.timers.push(setInterval(tickRadio, this.radioIntervalMs));

    const parent = target.parent;
    if (parent) {
      const tickParent = (): void =>
        this.ping(active, 'PARENT', parent.ipAddress);
      active.timers.push(
        setInterval(tickParent, this.pingIntervalMs)
      );
      tickParent();
    }
    for (const timer of active.timers) timer.unref?.();

    this.finished.delete(target.deviceId);
    this.running.set(target.deviceId, active);
    tickTarget();
    tickRadio();

    this.logger.info('[LinkDiagnosisRunner] Diagnosis started', {
      deviceId: target.deviceId,
      ip: target.ipAddress,
      parentIp: parent?.ipAddress ?? null,
      durationSeconds: target.durationSeconds
    });

    return Result.ok({
      started: true,
      diagnosis: session.toDTO(now, false)
    });
  }

  find(deviceId: string): LinkDiagnosisDTO | null {
    const now = this.clock();
    this.evictExpired(now);

    const session =
      this.running.get(deviceId)?.session ??
      this.finished.get(deviceId);
    return session ? session.toDTO(now, true) : null;
  }

  stop(deviceId: string): LinkDiagnosisDTO | null {
    if (!this.running.has(deviceId)) return null;
    return this.finish(deviceId, 'STOPPED');
  }

  stopAll(): void {
    for (const deviceId of [...this.running.keys()]) {
      this.finish(deviceId, 'STOPPED');
    }
  }

  private ping(
    active: ActiveSession,
    hop: PingHop,
    ip: string
  ): void {
    if (active.inFlight.has(hop)) return;
    active.inFlight.add(hop);

    void this.pingService
      .ping(ip, this.pingTimeoutMs)
      .then((result) => {
        // a failure here is the ping tool itself breaking, not a lost
        // packet — counting it as loss would blame the link
        if (result.isFailure) {
          this.logger.warn(
            '[LinkDiagnosisRunner] Ping probe failed',
            {
              deviceId: active.target.deviceId,
              hop,
              error: result.error
            }
          );
          return;
        }
        const { isReachable, latencyMs } = result.value;
        if (isReachable && latencyMs === null) return;

        const sample = active.session.recordPing(
          hop,
          isReachable ? latencyMs : null,
          this.clock()
        );
        if (sample) {
          this.hub.publish(
            diagnosisDeviceChannel(active.target.deviceId),
            DIAGNOSIS_PING_EVENT,
            sample
          );
        }
      })
      .finally(() => active.inFlight.delete(hop));
  }

  private readRadio(active: ActiveSession): void {
    if (active.inFlight.has('RADIO')) return;
    active.inFlight.add('RADIO');

    const { target, session } = active;
    void target.collector
      .collect(
        target.ipAddress,
        target.credentials,
        target.deviceType
      )
      .then((result) => {
        const now = this.clock();
        const sample = result.isSuccess
          ? session.recordRadio(result.value, now)
          : session.recordRadioFailure(result.error, now);
        if (!sample) return;

        const channel = diagnosisDeviceChannel(target.deviceId);
        this.hub.publish(channel, DIAGNOSIS_RADIO_EVENT, sample);
        this.hub.publish(
          channel,
          DIAGNOSIS_REPORT_EVENT,
          session.report(now)
        );
      })
      .catch((error: unknown) => {
        this.logger.error(
          '[LinkDiagnosisRunner] Radio read threw',
          error instanceof Error ? error : new Error(String(error)),
          { deviceId: target.deviceId }
        );
      })
      .finally(() => active.inFlight.delete('RADIO'));
  }

  private finish(
    deviceId: string,
    status: 'COMPLETED' | 'STOPPED'
  ): LinkDiagnosisDTO | null {
    const active = this.running.get(deviceId);
    if (!active) return null;

    for (const timer of active.timers) clearInterval(timer);
    clearTimeout(active.endTimer);
    this.running.delete(deviceId);

    const now = this.clock();
    active.session.finish(status, now);
    this.finished.set(deviceId, active.session);

    const dto = active.session.toDTO(now, false);
    this.hub.publish(
      diagnosisDeviceChannel(deviceId),
      DIAGNOSIS_END_EVENT,
      dto
    );

    this.logger.info('[LinkDiagnosisRunner] Diagnosis ended', {
      deviceId,
      status,
      verdict: dto.report.verdict,
      faultLocation: dto.report.faultLocation
    });
    return dto;
  }

  private evictExpired(now: Date): void {
    for (const [deviceId, session] of this.finished) {
      const endedAt = session.endTime?.getTime() ?? now.getTime();
      if (now.getTime() - endedAt > this.retentionMs) {
        this.finished.delete(deviceId);
      }
    }
  }
}
