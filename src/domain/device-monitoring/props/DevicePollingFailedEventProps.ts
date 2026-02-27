import {
  PollingResultId,
  NetworkDeviceId,
  PollingStatus,
  IPAddress
} from '../../device-inventory';

export interface DevicePollingFailedEventProps {
  readonly aggregateId: PollingResultId;
  readonly networkDeviceId: NetworkDeviceId;
  readonly deviceName: string;
  readonly ipAddress: IPAddress;
  readonly status: PollingStatus; // FAILED or TIMEOUT
  readonly errorMessage: string;
  readonly attemptNumber: number;
  readonly wasOnline: boolean; // True if this is transition from online state
  readonly dateTimeOccurred: Date;
}
