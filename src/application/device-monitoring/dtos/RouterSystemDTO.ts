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
}

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
}
