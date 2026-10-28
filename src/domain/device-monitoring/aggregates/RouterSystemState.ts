import { AggregateRoot } from 'domain/shared/core';
import { DeviceId } from 'domain/shared/ids';
import {
  ROUTER_HEALTH_ISSUES,
  RouterHealthIssue,
  RouterSystemReadingProps,
  RouterSystemStateProps
} from '../props';
import { RouterHealthThresholds } from '../value-objects';

export const ROUTER_READ_ERROR_MAX_LENGTH = 500;
// MON-170: the server's clock and the router's uptime drift a little apart
// between reads; a boot time this much later is a reboot.
export const REBOOT_TOLERANCE_SECONDS = 60;
// MON-173
export const HIGH_CPU_CHECKS_BEFORE_ALERT = 2;
const TEMPERATURE_CLEAR_MARGIN_C = 3;
const FREE_SPACE_CLEAR_MARGIN_PERCENT = 2;
const VOLTAGE_CLEAR_MARGIN = 0.5;

export interface RouterReadingChange {
  // when the router started again; null when it did not restart
  rebootedAt: Date | null;
}

export interface RouterHealthChange {
  raised: RouterHealthIssue[];
  recovered: RouterHealthIssue[];
}

// PROBLEM opens an alert, HEALTHY closes one, UNSURE leaves things as they
// are (no value, or between the limit and its clear margin), OFF drops an
// open alert silently because its limit was removed.
type HealthVerdict = 'PROBLEM' | 'HEALTHY' | 'UNSURE' | 'OFF';

// MON-161: the latest thing a MikroTik said about itself, one per router. A
// failed read is recorded beside the last good reading rather than over it,
// so the hardware a router last reported stays known while it is unreachable.
export class RouterSystemState extends AggregateRoot<
  RouterSystemStateProps,
  DeviceId
> {
  private constructor(props: RouterSystemStateProps, id: DeviceId) {
    super(props, id);
  }

  get deviceId(): DeviceId {
    return this.props.deviceId;
  }
  get reading(): RouterSystemReadingProps | null {
    return this.props.reading;
  }
  get readAt(): Date | null {
    return this.props.readAt;
  }
  get lastError(): string | null {
    return this.props.lastError;
  }
  get attemptedAt(): Date {
    return this.props.attemptedAt;
  }
  get healthIssues(): RouterHealthIssue[] {
    return [...this.props.healthIssues];
  }
  get highCpuChecks(): number {
    return this.props.highCpuChecks;
  }

  // MON-170: when the router last started, as of the last good reading.
  get bootedAt(): Date | null {
    const uptime = this.props.reading?.uptimeSeconds;
    if (
      uptime === null ||
      uptime === undefined ||
      !this.props.readAt
    ) {
      return null;
    }
    return new Date(this.props.readAt.getTime() - uptime * 1000);
  }

  public static createInitial(
    deviceId: DeviceId,
    at: Date
  ): RouterSystemState {
    return new RouterSystemState(
      {
        deviceId,
        reading: null,
        readAt: null,
        lastError: null,
        attemptedAt: at,
        highCpuChecks: 0,
        healthIssues: []
      },
      deviceId
    );
  }

  // bypasses validation — for repository use only
  public static reconstitute(
    id: DeviceId,
    props: RouterSystemStateProps
  ): RouterSystemState {
    return new RouterSystemState(props, id);
  }

  // MON-170: a boot time later than the last reading's is a reboot, even
  // when the router has since been up longer than it was then (it was out of
  // reach for a while).
  public recordReading(
    reading: RouterSystemReadingProps,
    at: Date
  ): RouterReadingChange {
    const bootedBefore = this.bootedAt;
    this.props = {
      ...this.props,
      reading: { ...reading },
      readAt: at,
      lastError: null,
      attemptedAt: at
    };
    const bootedNow = this.bootedAt;
    const rebooted =
      bootedBefore !== null &&
      bootedNow !== null &&
      bootedNow.getTime() - bootedBefore.getTime() >
        REBOOT_TOLERANCE_SECONDS * 1000;
    return { rebootedAt: rebooted ? bootedNow : null };
  }

  public recordFailure(error: string, at: Date): void {
    this.props = {
      ...this.props,
      lastError: error.slice(0, ROUTER_READ_ERROR_MAX_LENGTH),
      attemptedAt: at
    };
  }

  // MON-173: judges the reading just taken. A failed read judges nothing: the
  // CPU streak ends and open alerts stay open.
  public recordHealthCheck(
    thresholds: RouterHealthThresholds
  ): RouterHealthChange {
    const change: RouterHealthChange = { raised: [], recovered: [] };
    const reading =
      this.props.lastError === null ? this.props.reading : null;
    if (reading === null) {
      this.props.highCpuChecks = 0;
      return change;
    }

    const cpu = reading.cpuLoadPercent;
    this.props.highCpuChecks =
      cpu !== null && cpu > thresholds.cpuPercent
        ? this.props.highCpuChecks + 1
        : 0;

    const open = new Set(this.props.healthIssues);
    for (const issue of ROUTER_HEALTH_ISSUES) {
      const verdict = this.judge(issue, reading, thresholds);
      if (verdict === 'OFF') {
        open.delete(issue);
      } else if (verdict === 'PROBLEM' && !open.has(issue)) {
        open.add(issue);
        change.raised.push(issue);
      } else if (verdict === 'HEALTHY' && open.has(issue)) {
        open.delete(issue);
        change.recovered.push(issue);
      }
    }
    this.props.healthIssues = ROUTER_HEALTH_ISSUES.filter((i) =>
      open.has(i)
    );
    return change;
  }

  private judge(
    issue: RouterHealthIssue,
    reading: RouterSystemReadingProps,
    t: RouterHealthThresholds
  ): HealthVerdict {
    const value = routerHealthValue(issue, reading);
    switch (issue) {
      case 'CPU':
        if (value === null) return 'UNSURE';
        if (
          this.props.highCpuChecks >= HIGH_CPU_CHECKS_BEFORE_ALERT
        ) {
          return 'PROBLEM';
        }
        return value <= t.cpuPercent ? 'HEALTHY' : 'UNSURE';
      case 'MEMORY':
        return atLeast(
          value,
          t.minFreeMemoryPercent,
          FREE_SPACE_CLEAR_MARGIN_PERCENT
        );
      case 'DISK':
        return atLeast(
          value,
          t.minFreeDiskPercent,
          FREE_SPACE_CLEAR_MARGIN_PERCENT
        );
      case 'TEMPERATURE':
        if (value === null) return 'UNSURE';
        if (value > t.maxTemperatureC) return 'PROBLEM';
        return value <= t.maxTemperatureC - TEMPERATURE_CLEAR_MARGIN_C
          ? 'HEALTHY'
          : 'UNSURE';
      case 'VOLTAGE':
        if (t.minVoltage === null) return 'OFF';
        return atLeast(value, t.minVoltage, VOLTAGE_CLEAR_MARGIN);
    }
  }
}

function atLeast(
  value: number | null,
  min: number,
  clearMargin: number
): HealthVerdict {
  if (value === null) return 'UNSURE';
  if (value < min) return 'PROBLEM';
  return value >= min + clearMargin ? 'HEALTHY' : 'UNSURE';
}

// The figure each issue is judged on: CPU %, free memory or disk as % of the
// total, °C, V. Null when the router did not say.
export function routerHealthValue(
  issue: RouterHealthIssue,
  reading: RouterSystemReadingProps
): number | null {
  switch (issue) {
    case 'CPU':
      return reading.cpuLoadPercent;
    case 'MEMORY':
      return freePercent(
        reading.freeMemoryBytes,
        reading.totalMemoryBytes
      );
    case 'DISK':
      return freePercent(reading.freeHddBytes, reading.totalHddBytes);
    case 'TEMPERATURE':
      return reading.temperatureC;
    case 'VOLTAGE':
      return reading.voltage;
  }
}

function freePercent(
  free: number | null,
  total: number | null
): number | null {
  if (free === null || total === null || total <= 0) return null;
  return Math.round((free / total) * 1000) / 10;
}
