import { DeviceId } from 'domain/shared/ids';
import { PortSpeed } from '../value-objects/PortSpeed';

export interface PortExpectedSpeedProps {
  deviceId: DeviceId;
  portName: string;
  expected: PortSpeed;
  slowChecks: number;
  alertedAt: Date | null;
}
