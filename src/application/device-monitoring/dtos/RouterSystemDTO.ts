// MON-160: what a MikroTik said about itself. Byte counts are bytes; null
// is "the router did not say".
export interface RouterSystemReadingDTO {
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

export interface RouterSystemDTO {
  deviceId: string;
  // the name in the app; the router's own name is system.identity
  name: string;
  ipAddress: string | null;
  // false: never read, `reason` says why (MON-145)
  readable: boolean;
  reason: string | null;
  // the last good reading and when it was taken; null until one came through
  system: RouterSystemReadingDTO | null;
  readAt: string | null;
  // the last attempt, and its error when it failed
  attemptedAt: string | null;
  lastError: string | null;
  // MON-175: when the router last started, from the last good reading
  bootedAt: string | null;
  // MON-175: the health problems an alert is open for
  healthIssues: RouterHealthIssueDTO[];
}

export type RouterHealthIssueDTO =
  | 'CPU'
  | 'MEMORY'
  | 'DISK'
  | 'TEMPERATURE'
  | 'VOLTAGE';

export interface RouterSystemsResponseDTO {
  routers: RouterSystemDTO[];
}

export interface GetRouterSystemRequestDTO {
  deviceId: string;
}

export interface RouterSystemResponseDTO {
  router: RouterSystemDTO;
}

export interface CheckRouterSystemsRequestDTO {
  now: Date;
}

export interface RouterSystemCheckSkipDTO {
  deviceId: string;
  name: string;
  why: string;
}

export interface CheckRouterSystemsResultDTO {
  routersRead: number;
  // routers that cannot be read at all (no address, no login, no agent)
  skipped: RouterSystemCheckSkipDTO[];
  // routers that were tried and did not answer
  failed: RouterSystemCheckSkipDTO[];
  // MON-170, MON-174: what the check found and raised
  rebooted: number;
  healthRaised: number;
  healthRecovered: number;
}

export interface RouterHealthThresholdsDTO {
  cpuPercent: number;
  minFreeMemoryPercent: number;
  minFreeDiskPercent: number;
  maxTemperatureC: number;
  // null: no voltage alert
  minVoltage: number | null;
}

export type UpdateRouterHealthThresholdsRequestDTO =
  RouterHealthThresholdsDTO;

export interface RouterHealthThresholdsResponseDTO {
  thresholds: RouterHealthThresholdsDTO;
  defaults: RouterHealthThresholdsDTO;
}

export type RouterAuditFindingCodeDTO =
  | 'FIRMWARE_BEHIND'
  | 'PLAINTEXT_SERVICE'
  | 'UNRESTRICTED_SERVICE'
  | 'ADMIN_USER'
  | 'DISCOVERY_ON_ALL_INTERFACES';

export type RouterAuditPartDTO = 'SERVICES' | 'USERS' | 'DISCOVERY';

export interface RouterAuditFindingDTO {
  code: RouterAuditFindingCodeDTO;
  // the IP service a service finding is about; null for the others
  service: string | null;
  port: number | null;
}

// MON-186: one MikroTik's versions and what is worth fixing on it, judged
// from its last good reading (`readAt`; null when never read).
export interface RouterAuditDTO {
  deviceId: string;
  name: string;
  ipAddress: string | null;
  readable: boolean;
  reason: string | null;
  readAt: string | null;
  lastError: string | null;
  routerOsVersion: string | null;
  currentFirmware: string | null;
  upgradeFirmware: string | null;
  findings: RouterAuditFindingDTO[];
  // what the router did not let the app read, so was not checked
  unchecked: RouterAuditPartDTO[];
}

export interface RouterAuditResponseDTO {
  routers: RouterAuditDTO[];
}
