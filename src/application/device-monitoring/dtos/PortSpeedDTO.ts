export type PortSpeedVerdict =
  | 'OK'
  | 'SLOW'
  | 'NO_LINK'
  | 'UNKNOWN'
  | 'NO_EXPECTATION'
  | 'PORT_MISSING';

export interface RouterPortDTO {
  name: string;
  comment: string | null;
  // null on a PORT_MISSING row: the router has no enabled port by that name
  linked: boolean | null;
  rateMbps: number | null;
  fullDuplex: boolean | null;
  expectedMbps: number | null;
  // MON-149: false without an expected speed
  alertOnNoLink: boolean;
  verdict: PortSpeedVerdict;
}

export interface RouterPortSpeedsDTO {
  deviceId: string;
  name: string;
  identity: string | null;
  ipAddress: string | null;
  // false: not read at all, and `reason` says why
  readable: boolean;
  reason: string | null;
  // set when the router was tried and did not answer
  error: string | null;
  ports: RouterPortDTO[];
}

export interface PortSpeedsResponseDTO {
  checkedAt: string;
  routers: RouterPortSpeedsDTO[];
}

export interface GetRouterPortSpeedsRequestDTO {
  deviceId: string;
}

export interface RouterPortSpeedsResponseDTO {
  checkedAt: string;
  router: RouterPortSpeedsDTO;
}

export interface SetPortExpectedSpeedRequestDTO {
  deviceId: string;
  portName: string;
  // null clears it
  expectedMbps: number | null;
  // omitted keeps what the port had; a new one starts off
  alertOnNoLink?: boolean;
}

export interface PortExpectedSpeedDTO {
  deviceId: string;
  portName: string;
  expectedMbps: number | null;
  alertOnNoLink: boolean;
}

export interface AcceptCurrentPortSpeedsRequestDTO {
  deviceId: string;
}

export interface CheckPortSpeedsRequestDTO {
  now: Date;
}

export interface PortSpeedCheckSkipDTO {
  deviceId: string;
  name: string;
  why: string;
}

export interface CheckPortSpeedsResultDTO {
  // routers with at least one expected speed that were read
  routersChecked: number;
  // routers with an expected speed that could not be read this time
  skipped: PortSpeedCheckSkipDTO[];
  raised: number;
  recovered: number;
}
