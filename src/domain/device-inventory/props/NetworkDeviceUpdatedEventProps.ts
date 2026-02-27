import { NetworkDeviceId } from '..';

export interface NetworkDeviceUpdatedEventProps {
  readonly aggregateId: NetworkDeviceId;
  readonly deviceName: string;
  readonly changedFields: string[];
  readonly previousValues: Record<string, unknown>;
  readonly newValues: Record<string, unknown>;
  readonly dateTimeOccurred: Date;
}
