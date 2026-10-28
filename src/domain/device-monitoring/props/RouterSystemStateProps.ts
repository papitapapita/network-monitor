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

export interface RouterSystemStateProps {
  readonly deviceId: DeviceId;
  // the last reading that came through, kept when a later read fails
  reading: RouterSystemReadingProps | null;
  readAt: Date | null;
  lastError: string | null;
  attemptedAt: Date;
}
