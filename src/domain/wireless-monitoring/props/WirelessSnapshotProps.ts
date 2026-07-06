import { DeviceId } from 'domain/shared/ids';
import {
  WirelessMetrics,
  WirelessClientEntry,
  WirelessAlert
} from '../value-objects';

export interface WirelessSnapshotProps {
  deviceId: DeviceId;
  deviceType: 'STATION' | 'ACCESS_POINT';
  collectedAt: Date;
  collectionMethod: 'snmp' | 'http_api' | 'mixed';
  metrics: WirelessMetrics;
  clients: WirelessClientEntry[];
  alerts: WirelessAlert[];
  remoteApDeviceId: DeviceId | null;
}
