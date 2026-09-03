import { DeviceId } from 'domain/shared/ids';
import { ReachabilityStatus } from '../value-objects/ReachabilityStatus';

export interface DeviceStateProps {
  readonly deviceId: DeviceId;
  status: ReachabilityStatus;
  lastSeen: Date | null;
  lastLatencyMs: number | null;
  consecutiveFailures: number;
  lastCheckedAt: Date | null;
  downSince: Date | null;
  updatedAt: Date;
}
