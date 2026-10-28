import { DeviceId } from 'domain/shared/ids';
import { PortSpeed } from '../value-objects/PortSpeed';

export interface PortExpectedSpeedProps {
  deviceId: DeviceId;
  portName: string;
  expected: PortSpeed;
  // MON-149: a port with no link counts as short in the scheduled check
  alertOnNoLink: boolean;
  slowChecks: number;
  alertedAt: Date | null;
}
