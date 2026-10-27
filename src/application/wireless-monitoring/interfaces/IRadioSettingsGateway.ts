import { Result } from 'domain/shared/core';
import { DeviceId } from 'domain/shared/ids';
import type { AgentReadRefusal } from './IAgentRadioReader';

// The radio's own login: HTTP for reading its configuration, SSH for
// changing it (WLS-224).
export interface RadioLogin {
  username: string;
  password: string;
  httpPort: number;
  sshPort: number;
}

export interface IRadioLoginSource {
  // null when the device has no credentials, or no HTTP login among them.
  findByDeviceId(
    deviceId: DeviceId
  ): Promise<Result<RadioLogin | null>>;
}

export type RadioReach =
  | { by: 'server' }
  | { by: 'agent'; agentId: string };

export interface RadioTarget {
  ipAddress: string;
  vendor: string;
  deviceType: 'STATION' | 'ACCESS_POINT';
  login: RadioLogin;
}

// WPA_PSK: a shared key, returned. OTHER: WPA Enterprise or anything else
// with no key to show. OPEN: no security at all (WLS-221).
export type WirelessSecurityKind = 'WPA_PSK' | 'OPEN' | 'OTHER';

export interface WirelessSecurityReading {
  // What the radio's configuration says it is, which may differ from the
  // role the device was registered with.
  role: 'ACCESS_POINT' | 'STATION';
  ssid: string | null;
  security: WirelessSecurityKind;
  key: string | null;
}

// RADIO: this server reached the radio, or tried to, and it failed.
// UNSUPPORTED_VENDOR: only AirOS radios for now (WLS-222). The rest are the
// agent's, as for a radio read (WLS-029).
export type RadioSettingsFailureReason =
  | AgentReadRefusal
  | 'RADIO'
  | 'UNSUPPORTED_VENDOR';

export type RadioSettingsAnswer<T> =
  | { ok: true; value: T }
  | { ok: false; reason: RadioSettingsFailureReason; error: string };

// Shared with the controller, which picks the status code from them.
export const RADIO_SETTINGS_FAILURES: Record<
  RadioSettingsFailureReason,
  string
> = {
  AGENT_OFFLINE: 'its on-site agent is not connected',
  PROBE_UNSUPPORTED: 'its on-site agent must be updated first',
  TIMEOUT: 'its on-site agent did not answer in time',
  AGENT_ERROR: 'its on-site agent could not reach the radio',
  RADIO: 'the radio did not accept the request',
  UNSUPPORTED_VENDOR: "this vendor's radios are not supported yet"
};

// Reads and changes a radio's own settings, from this server or through the
// agent the radio sits behind (WLS-225).
export interface IRadioSettingsGateway {
  readWirelessSecurity(
    reach: RadioReach,
    target: RadioTarget
  ): Promise<RadioSettingsAnswer<WirelessSecurityReading>>;

  setHostname(
    reach: RadioReach,
    target: RadioTarget,
    hostname: string
  ): Promise<RadioSettingsAnswer<void>>;
}

// The same two operations through the agent a radio sits behind. The
// configuration comes back as the radio sent it.
export interface IAgentRadioSettings {
  fetchConfig(
    agentId: string,
    target: RadioTarget
  ): Promise<RadioSettingsAnswer<string>>;

  setHostname(
    agentId: string,
    target: RadioTarget,
    hostname: string
  ): Promise<RadioSettingsAnswer<void>>;
}

// Changes the name one vendor's radio gives itself, on this server or on an
// agent (AGT-120).
export interface IRadioHostnameWriter {
  setHostname(
    ipAddress: string,
    login: RadioLogin,
    hostname: string
  ): Promise<Result<void>>;
}

export interface IRadioHostnameWriterResolver {
  // null: renaming this vendor's radios is not supported.
  forVendor(vendor: string): IRadioHostnameWriter | null;
}
