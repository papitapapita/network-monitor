import { DeviceId } from 'domain/shared';

export interface DeviceStateProps {
  readonly deviceId: DeviceId;
  isOnline: boolean;
  lastSeen: Date | null;
  lastLatencyMs: number | null;
  consecutiveFailures: number;
  lastCheckedAt: Date | null;
  updatedAt: Date;
}
