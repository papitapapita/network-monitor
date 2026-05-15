import { DeviceId } from 'domain/shared';
import { WirelessMetrics } from '../value-objects/WirelessMetrics';
import { WirelessClientEntry } from '../value-objects/WirelessClientEntry';
import { WirelessAlert } from '../value-objects/WirelessAlert';

export interface WirelessSnapshotProps {
  deviceId: DeviceId;
  deviceType: 'CPE' | 'ACCESS_POINT';
  collectedAt: Date;
  collectionMethod: 'snmp' | 'http_api' | 'mixed';
  metrics: WirelessMetrics;
  clients: WirelessClientEntry[];
  alerts: WirelessAlert[];
}
