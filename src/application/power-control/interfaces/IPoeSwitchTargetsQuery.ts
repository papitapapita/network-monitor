import { Result } from 'domain/shared/core';
import { InventoryDevice } from 'domain/power-control';
import {
  PoeSwitchFirmware,
  PoeSwitchLogin
} from './IPoeSwitchReader';

// Who reads the switch (PWR-013). On site this server does; off site, the
// agent the switch sits behind, which cannot read PoE ports yet.
export type PoeSwitchReach =
  | { by: 'server' }
  | { by: 'agent'; agentId: string }
  | { by: 'none' };

// A PoE switch as inventory and its stored credentials (decrypted) describe
// it; whether it can be read is decided by resolvePoeSwitchTarget.
export interface PoeSwitchCandidate {
  deviceId: string;
  deviceName: string;
  ipAddress: string | null;
  firmware: PoeSwitchFirmware;
  reach: PoeSwitchReach;
  login: PoeSwitchLogin | null;
}

export interface PoeSite {
  locationId: string;
  locationName: string;
}

export interface PoePoweredDevice {
  deviceId: string;
  deviceName: string;
  ipAddress: string | null;
  locationId: string | null;
}

export interface IPoeSwitchTargetsQuery {
  // null when the location does not exist.
  findSite(locationId: string): Promise<Result<PoeSite | null>>;
  // The locations holding at least one PoE switch in service (PWR-010).
  listSwitchSites(): Promise<Result<string[]>>;
  // PWR-010: the PoE switches in service at the site, by name.
  listSwitchesAtSite(
    locationId: string
  ): Promise<Result<PoeSwitchCandidate[]>>;
  // null when the device does not exist or was deleted.
  findDevice(
    deviceId: string
  ): Promise<Result<PoePoweredDevice | null>>;
  // The non-deleted devices holding any of these addresses (PWR-031).
  findDevicesByIps(ips: string[]): Promise<Result<InventoryDevice[]>>;
}
