import { PollingInterval, FailureThreshold } from '../value-objects/';
import { IPAddress } from 'domain/shared/value-objects';
import { DeviceId } from 'domain/shared/ids';

export interface PollingConfigurationProps {
  readonly deviceId: DeviceId;
  ipAddress: IPAddress | null;
  interval: PollingInterval;
  failuresBeforeDown: FailureThreshold;
  enabled: boolean;
  lastPolledAt?: Date | null;
}
