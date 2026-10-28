import { Result } from 'domain/shared/core';
import { AlertSeverity } from 'domain/shared/enums';
import { DeviceId } from 'domain/shared/ids';
import {
  PortCheckOutcome,
  PortExpectedSpeed
} from 'domain/device-monitoring/entities';
import { IPortExpectedSpeedRepository } from 'domain/device-monitoring/repository';
import { PortSpeed } from 'domain/device-monitoring/value-objects';
import { UseCase } from 'application/shared/core';
import {
  IAlertPublisher,
  ILogger,
  isSuppressedPublish
} from 'application/shared/interfaces';
import {
  EthernetPortReading,
  IPortSpeedTargetsQuery,
  PortSpeedRouterCandidate
} from '../interfaces';
import { judgePort, RouterPortInspector } from '../services';
import {
  CheckPortSpeedsRequestDTO,
  CheckPortSpeedsResultDTO,
  PortSpeedCheckSkipDTO
} from '../dtos';

export const PORT_SPEED_SOURCE = 'Velocidad de puertos';
// A plain alert type, so it can be muted for the whole install (MON-148).
export const PORT_SPEED_LOW_ALERT_TYPE = 'port_speed_low';

interface PortChange {
  expected: PortExpectedSpeed;
  port: EthernetPortReading;
}

interface RouterOutcome {
  candidate: PortSpeedRouterCandidate;
  skipped: PortSpeedCheckSkipDTO | null;
  checked: PortExpectedSpeed[];
  raised: PortChange[];
  recovered: PortChange[];
}

// MON-147: the scheduled check. Only routers with an expected speed are read;
// a router that cannot be read leaves its ports' state as it was.
export class CheckPortSpeedsUseCase extends UseCase<
  CheckPortSpeedsRequestDTO,
  CheckPortSpeedsResultDTO
> {
  constructor(
    private readonly targets: IPortSpeedTargetsQuery,
    private readonly inspector: RouterPortInspector,
    private readonly repository: IPortExpectedSpeedRepository,
    private readonly alertPublisher: IAlertPublisher,
    logger: ILogger
  ) {
    super(logger, 'CheckPortSpeedsUseCase');
  }

  protected async executeImpl(
    request: CheckPortSpeedsRequestDTO
  ): Promise<Result<CheckPortSpeedsResultDTO>> {
    const candidates = await this.targets.listRouters();
    if (candidates.isFailure) return Result.fail(candidates.error);
    if (candidates.value.length === 0) return this.ok(empty());

    const expectations = await this.repository.listForDevices(
      candidates.value.map((c) => DeviceId.parse(c.deviceId).value)
    );
    if (expectations.isFailure) {
      return Result.fail(expectations.error);
    }
    const byDevice = groupByDevice(expectations.value);

    const outcomes = await Promise.all(
      candidates.value
        .filter((c) => byDevice.has(c.deviceId))
        .map((c) =>
          this.check(c, byDevice.get(c.deviceId)!, request.now)
        )
    );

    const saved = await this.repository.saveCheckState(
      outcomes.flatMap((o) => o.checked)
    );
    if (saved.isFailure) return Result.fail(saved.error);

    for (const outcome of outcomes) {
      await this.notify(outcome, request.now);
    }

    return this.ok({
      routersChecked: outcomes.filter((o) => o.skipped === null)
        .length,
      skipped: outcomes
        .map((o) => o.skipped)
        .filter((s): s is PortSpeedCheckSkipDTO => s !== null),
      raised: outcomes.reduce((n, o) => n + o.raised.length, 0),
      recovered: outcomes.reduce((n, o) => n + o.recovered.length, 0)
    });
  }

  private async check(
    candidate: PortSpeedRouterCandidate,
    expectations: PortExpectedSpeed[],
    now: Date
  ): Promise<RouterOutcome> {
    const outcome: RouterOutcome = {
      candidate,
      skipped: null,
      checked: [],
      raised: [],
      recovered: []
    };
    const read = await this.inspector.read(candidate);
    if (!('reading' in read)) {
      outcome.skipped = {
        deviceId: candidate.deviceId,
        name: candidate.deviceName,
        why: 'reason' in read ? read.reason : read.error
      };
      return outcome;
    }

    const ports = new Map(read.reading.ports.map((p) => [p.name, p]));
    for (const expected of expectations) {
      const port = ports.get(expected.portName);
      const change = expected.recordCheck(
        port ? toOutcome(port, expected) : 'UNJUDGED',
        now
      );
      outcome.checked.push(expected);
      if (change === 'RAISED')
        outcome.raised.push({ expected, port: port! });
      if (change === 'RECOVERED') {
        outcome.recovered.push({ expected, port: port! });
      }
    }
    return outcome;
  }

  // MON-148: one notice per router and check, however many ports changed.
  private async notify(
    outcome: RouterOutcome,
    at: Date
  ): Promise<void> {
    const router = outcome.candidate.deviceName;
    if (outcome.raised.length > 0) {
      await this.publish(outcome.candidate, at, false, {
        summary:
          outcome.raised.length === 1
            ? `El puerto ${portLabel(outcome.raised[0].port)} de "${router}" está a ${linkText(outcome.raised[0].port)}, debería estar a ${outcome.raised[0].expected.expected.toString()}`
            : `${outcome.raised.length} puertos de "${router}" están más lentos de lo que deberían`,
        detail:
          outcome.raised.length === 1
            ? null
            : outcome.raised
                .map(
                  (c) =>
                    `• ${portLabel(c.port)}: ${linkText(c.port)}, debería estar a ${c.expected.expected.toString()}`
                )
                .join('\n')
      });
    }
    if (outcome.recovered.length > 0) {
      await this.publish(outcome.candidate, at, true, {
        summary:
          outcome.recovered.length === 1
            ? `El puerto ${portLabel(outcome.recovered[0].port)} de "${router}" volvió a ${linkText(outcome.recovered[0].port)}`
            : `${outcome.recovered.length} puertos de "${router}" volvieron a su velocidad`,
        detail:
          outcome.recovered.length === 1
            ? null
            : outcome.recovered
                .map(
                  (c) => `• ${portLabel(c.port)}: ${linkText(c.port)}`
                )
                .join('\n')
      });
    }
  }

  private async publish(
    candidate: PortSpeedRouterCandidate,
    at: Date,
    resolved: boolean,
    message: { summary: string; detail: string | null }
  ): Promise<void> {
    try {
      const result = await this.alertPublisher.publish({
        deviceId: candidate.deviceId,
        severity: AlertSeverity.WARNING,
        source: PORT_SPEED_SOURCE,
        summary: message.summary,
        detail: message.detail,
        occurredAt: at,
        resolved,
        type: PORT_SPEED_LOW_ALERT_TYPE
      });
      if (result.isFailure && !isSuppressedPublish(result.error)) {
        this.logger.error('Port speed notice not sent', undefined, {
          deviceId: candidate.deviceId,
          error: result.error
        });
      }
    } catch (error) {
      this.logger.error(
        'Port speed notice failed',
        error instanceof Error ? error : new Error(String(error))
      );
    }
  }
}

function empty(): CheckPortSpeedsResultDTO {
  return { routersChecked: 0, skipped: [], raised: 0, recovered: 0 };
}

function groupByDevice(
  expectations: PortExpectedSpeed[]
): Map<string, PortExpectedSpeed[]> {
  const byDevice = new Map<string, PortExpectedSpeed[]>();
  for (const e of expectations) {
    const key = e.deviceId.toString();
    byDevice.set(key, [...(byDevice.get(key) ?? []), e]);
  }
  return byDevice;
}

function toOutcome(
  port: EthernetPortReading,
  expected: PortExpectedSpeed
): PortCheckOutcome {
  const verdict = judgePort(port, expected);
  if (verdict === 'OK') return 'MET';
  if (verdict === 'SLOW') return 'SHORT';
  return 'UNJUDGED';
}

function portLabel(port: EthernetPortReading): string {
  return port.comment ? `${port.name} (${port.comment})` : port.name;
}

function linkText(port: EthernetPortReading): string {
  const rate = PortSpeed.reconstitute({
    mbps: port.rateMbps ?? 0
  }).toString();
  return port.fullDuplex === false ? `${rate} en half duplex` : rate;
}
