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
  // MON-198: FCS + alignment errors and link-downs as read now, cumulative
  // since the counters were last reset; null when the router did not say
  rxErrors: number | null;
  linkDowns: number | null;
  // what the last scheduled check added; null when it could not tell
  errorsAdded: number | null;
  linkDownsAdded: number | null;
  // null on a port with no fibre module
  sfp: SfpReadingDTO | null;
  // the alerts the scheduled check has open on this port
  issues: PortIssueDTO[];
}

export type PortIssueDTO = 'ERRORS' | 'FLAPPING' | 'SFP_RX_LOW';

export interface SfpReadingDTO {
  rxPowerDbm: number | null;
  txPowerDbm: number | null;
  temperatureC: number | null;
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
  // MON-192: every router is read, with or without an expected speed
  routersChecked: number;
  // routers that could not be read this time
  skipped: PortSpeedCheckSkipDTO[];
  raised: number;
  recovered: number;
  // MON-193..MON-195: port alerts opened and closed
  portIssuesRaised: number;
  portIssuesRecovered: number;
}
