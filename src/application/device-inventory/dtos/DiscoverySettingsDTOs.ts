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

export interface RunScheduledDiscoveryResultDTO {
  ran: boolean;
  segments: ScheduledSegmentOutcomeDTO[];
}
