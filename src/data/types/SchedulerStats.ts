import { AccessPointStats } from '.';

export interface SchedulerStats {
  totalAccessPoints: number;
  activePollers: number;
  pausedPollers: number;
  disabledAPs: number;
  accessPointStats: AccessPointStats[];
}
