import { DeviceId } from 'domain/shared/ids';

// MON-193..MON-195: what an open port alert is about.
export const PORT_ISSUES = [
  'ERRORS',
  'FLAPPING',
  'SFP_RX_LOW'
] as const;

export type PortIssue = (typeof PORT_ISSUES)[number];

// What one port's counters and fibre module said on a scheduled check
// (MON-190). Null when the router did not say.
export interface PortCounterReadingProps {
  name: string;
  rxErrors: number | null;
  linkDowns: number | null;
  sfpRxPowerDbm: number | null;
}

export interface PortCounterProps {
  portName: string;
  // the cumulative counters as last read, the baseline of the next check
  rxErrors: number | null;
  linkDowns: number | null;
  readAt: Date;
  // MON-191: what the last check added; null when it could not tell (first
  // read, a counter reset, no counter)
  errorsAdded: number | null;
  linkDownsAdded: number | null;
  // MON-193: checks in a row with errors added, and without
  errorChecks: number;
  quietChecks: number;
  issues: PortIssue[];
}

export interface RouterPortCountersProps {
  readonly deviceId: DeviceId;
  ports: PortCounterProps[];
}
