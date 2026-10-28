import { AggregateRoot } from 'domain/shared/core';
import { DeviceId } from 'domain/shared/ids';
import {
  PORT_ISSUES,
  PortCounterProps,
  PortCounterReadingProps,
  PortIssue,
  RouterPortCountersProps
} from '../props';
import { RouterHealthThresholds } from '../value-objects';

// MON-193
export const ERROR_CHECKS_BEFORE_ALERT = 2;
export const QUIET_CHECKS_BEFORE_RECOVERY = 2;
// MON-195
const SFP_CLEAR_MARGIN_DB = 1;

export interface PortIssueRef {
  portName: string;
  issue: PortIssue;
}

export interface PortHealthChange {
  raised: PortIssueRef[];
  recovered: PortIssueRef[];
}

// As in RouterSystemState: PROBLEM opens an alert, HEALTHY closes one, UNSURE
// leaves things as they are, OFF drops an open alert silently.
type PortVerdict = 'PROBLEM' | 'HEALTHY' | 'UNSURE' | 'OFF';

// MON-191: the last counters each of a MikroTik's ports reported on the
// scheduled check, one per router. The counters only ever grow, so a check
// judges what was added since the one before.
export class RouterPortCounters extends AggregateRoot<
  RouterPortCountersProps,
  DeviceId
> {
  private constructor(props: RouterPortCountersProps, id: DeviceId) {
    super(props, id);
  }

  get deviceId(): DeviceId {
    return this.props.deviceId;
  }
  get ports(): PortCounterProps[] {
    return this.props.ports.map(copyPort);
  }

  port(name: string): PortCounterProps | null {
    const port = this.props.ports.find((p) => p.portName === name);
    return port ? copyPort(port) : null;
  }

  public static createInitial(
    deviceId: DeviceId
  ): RouterPortCounters {
    return new RouterPortCounters({ deviceId, ports: [] }, deviceId);
  }

  // bypasses validation — for repository use only
  public static reconstitute(
    id: DeviceId,
    props: RouterPortCountersProps
  ): RouterPortCounters {
    return new RouterPortCounters(props, id);
  }

  // MON-191..MON-195. A port the router no longer lists is forgotten with
  // whatever alert it had open.
  public recordCheck(
    readings: PortCounterReadingProps[],
    thresholds: RouterHealthThresholds,
    at: Date
  ): PortHealthChange {
    const change: PortHealthChange = { raised: [], recovered: [] };
    const before = new Map(
      this.props.ports.map((p) => [p.portName, p])
    );

    this.props.ports = readings.map((reading) => {
      const previous = before.get(reading.name) ?? null;
      const errorsAdded = added(
        previous?.rxErrors ?? null,
        reading.rxErrors
      );
      const port: PortCounterProps = {
        portName: reading.name,
        rxErrors: reading.rxErrors,
        linkDowns: reading.linkDowns,
        readAt: at,
        errorsAdded,
        linkDownsAdded: added(
          previous?.linkDowns ?? null,
          reading.linkDowns
        ),
        errorChecks:
          errorsAdded !== null && errorsAdded > 0
            ? (previous?.errorChecks ?? 0) + 1
            : 0,
        quietChecks:
          errorsAdded === 0 ? (previous?.quietChecks ?? 0) + 1 : 0,
        issues: []
      };

      const open = new Set(previous?.issues ?? []);
      for (const issue of PORT_ISSUES) {
        const verdict = judge(issue, port, reading, thresholds);
        const ref = { portName: port.portName, issue };
        if (verdict === 'OFF') {
          open.delete(issue);
        } else if (verdict === 'PROBLEM' && !open.has(issue)) {
          open.add(issue);
          change.raised.push(ref);
        } else if (verdict === 'HEALTHY' && open.has(issue)) {
          open.delete(issue);
          change.recovered.push(ref);
        }
      }
      port.issues = PORT_ISSUES.filter((i) => open.has(i));
      return port;
    });
    return change;
  }
}

// MON-191: a counter lower than before was reset (a reboot, a counter
// cleared), so what was added cannot be told.
function added(
  before: number | null,
  now: number | null
): number | null {
  if (before === null || now === null || now < before) return null;
  return now - before;
}

function judge(
  issue: PortIssue,
  port: PortCounterProps,
  reading: PortCounterReadingProps,
  t: RouterHealthThresholds
): PortVerdict {
  switch (issue) {
    case 'ERRORS':
      if (port.errorChecks >= ERROR_CHECKS_BEFORE_ALERT) {
        return 'PROBLEM';
      }
      return port.quietChecks >= QUIET_CHECKS_BEFORE_RECOVERY
        ? 'HEALTHY'
        : 'UNSURE';
    case 'FLAPPING':
      if (port.linkDownsAdded === null) return 'UNSURE';
      if (port.linkDownsAdded >= t.flapLinkDowns) return 'PROBLEM';
      return port.linkDownsAdded === 0 ? 'HEALTHY' : 'UNSURE';
    case 'SFP_RX_LOW': {
      const min = t.minSfpRxPowerDbm;
      if (min === null) return 'OFF';
      const power = reading.sfpRxPowerDbm;
      if (power === null) return 'UNSURE';
      if (power < min) return 'PROBLEM';
      return power >= min + SFP_CLEAR_MARGIN_DB
        ? 'HEALTHY'
        : 'UNSURE';
    }
  }
}

function copyPort(port: PortCounterProps): PortCounterProps {
  return { ...port, issues: [...port.issues] };
}
