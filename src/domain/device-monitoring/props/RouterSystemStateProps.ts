import { DeviceId } from 'domain/shared/ids';

// What a MikroTik says about itself (MON-160). Every field is null when the
// router did not say: a CHR has no RouterBOARD, many boards no sensors.
export interface RouterSystemReadingProps {
  identity: string | null;
  model: string | null;
  serialNumber: string | null;
  macAddress: string | null;
  boardName: string | null;
  routerOsVersion: string | null;
  currentFirmware: string | null;
  upgradeFirmware: string | null;
  uptimeSeconds: number | null;
  cpuLoadPercent: number | null;
  freeMemoryBytes: number | null;
  totalMemoryBytes: number | null;
  freeHddBytes: number | null;
  totalHddBytes: number | null;
  voltage: number | null;
  temperatureC: number | null;
}

// MON-173: what can be wrong with a router's health.
export const ROUTER_HEALTH_ISSUES = [
  'CPU',
  'MEMORY',
  'DISK',
  'TEMPERATURE',
  'VOLTAGE'
] as const;
export type RouterHealthIssue = (typeof ROUTER_HEALTH_ISSUES)[number];

export interface RouterSystemStateProps {
  readonly deviceId: DeviceId;
  // the last reading that came through, kept when a later read fails
  reading: RouterSystemReadingProps | null;
  readAt: Date | null;
  lastError: string | null;
  attemptedAt: Date;
  // MON-173: scheduled checks in a row with the CPU above its limit, and the
  // problems an alert is open for
  highCpuChecks: number;
  healthIssues: RouterHealthIssue[];
}
