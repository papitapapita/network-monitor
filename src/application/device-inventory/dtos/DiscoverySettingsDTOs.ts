export interface DiscoverySegmentDTO {
  cidr: string;
  agentId: string | null;
}

export interface UpdateDiscoverySettingsRequestDTO {
  enabled: boolean;
  intervalHours: number;
  segments: DiscoverySegmentDTO[];
}

export interface DiscoverySettingsDTO {
  enabled: boolean;
  intervalHours: number;
  segments: DiscoverySegmentDTO[];
  lastRunAt: string | null;
}

export type ScheduledSegmentOutcomeDTO = DiscoverySegmentDTO &
  (
    | { responsiveCount: number; newCount: number; error: null }
    | { responsiveCount: null; newCount: null; error: string }
  );

// DEV-217: one MikroTik's neighbour table, read on the scheduled run.
export type ScheduledRouterOutcomeDTO = {
  deviceId: string;
  name: string;
} & (
  | { neighborCount: number; newCount: number; error: null }
  | { neighborCount: null; newCount: null; error: string }
);

// DEV-218: what one MikroTik's ARP table and DHCP leases showed.
export type ScheduledArpOutcomeDTO = {
  deviceId: string;
  name: string;
} & (
  | { addressCount: number; newCount: number; error: null }
  | { addressCount: null; newCount: null; error: string }
);

export interface RunScheduledDiscoveryResultDTO {
  ran: boolean;
  segments: ScheduledSegmentOutcomeDTO[];
  routers: ScheduledRouterOutcomeDTO[];
  arp: ScheduledArpOutcomeDTO[];
}
