import { Result } from 'domain/shared/core';

// One row per wireless STATION, from its latest reading. apDeviceId is null
// when it was never read or the AP it reports is not in inventory.
export interface ReportedApRow {
  stationId: string;
  apDeviceId: string | null;
  matchedBy: 'MAC' | 'IP' | null;
  observedAt: Date | null;
}

export interface PoweringSwitchRow {
  deviceId: string;
  switchDeviceId: string;
  port: string;
}

export interface UnreadSwitchRow {
  deviceId: string;
  name: string;
  reason: string;
}

export interface PoweringSwitchesRead {
  links: PoweringSwitchRow[];
  unreadSwitches: UnreadSwitchRow[];
}

// Where each device is seen connected, as other contexts observe it: the AP a
// station's radio reports (wireless monitoring) and the switch port that
// powers an antenna (power control). Read-only, for upstream suggestions.
export interface IReportedApQuery {
  findReportedAps(): Promise<Result<ReportedApRow[]>>;
}

export interface IPoweringSwitchQuery {
  // Reads the switches live; null reads every site that has one.
  findPoweringSwitches(
    locationId: string | null
  ): Promise<Result<PoweringSwitchesRead>>;
}
