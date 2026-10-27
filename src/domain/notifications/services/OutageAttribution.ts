import { AlertId } from 'domain/shared/ids';
import { Alert } from '../aggregates';

export interface UpstreamState {
  deviceId: string;
  // False also for a device whose state is unknown or not measured: the walk
  // goes past it rather than blaming it (NOT-240).
  down: boolean;
}

export type OutageDecision =
  | { kind: 'ALERT_SELF' }
  | { kind: 'WAIT' }
  | { kind: 'ATTACH_TO'; causeId: AlertId };

export class OutageAttribution {
  // The highest DOWN device above this one is the real fault (NOT-241): with
  // a switch and the AP below it both down, the switch is the root.
  static rootCause(
    upstreamNearestFirst: UpstreamState[]
  ): string | null {
    let root: string | null = null;
    for (const upstream of upstreamNearestFirst) {
      if (upstream.down) root = upstream.deviceId;
    }
    return root;
  }

  // The root's alert opens the moment it goes down (NOT-097); until then the
  // child waits, so detection order cannot produce a stray page (NOT-242).
  static decide(
    rootDeviceId: string | null,
    rootAlert: Alert | null
  ): OutageDecision {
    if (rootDeviceId === null) return { kind: 'ALERT_SELF' };
    if (rootAlert === null || !rootAlert.isOpen)
      return { kind: 'WAIT' };
    return { kind: 'ATTACH_TO', causeId: rootAlert.id };
  }

  // A device still down once its upstream is back gets its own alert delay,
  // counted from the upstream's recovery, before it is judged a fault of its
  // own (NOT-245) — a CPE takes a minute to re-associate after its AP boots.
  static stillHeld(
    cause: Alert | null,
    now: Date,
    alertDelayMs: number
  ): boolean {
    if (cause === null) return false;
    if (cause.resolvedAt === null) return true;
    return now.getTime() - cause.resolvedAt.getTime() < alertDelayMs;
  }
}
