import type { AgentPlatform } from './release';

// Wire protocol between an on-site agent and the backend (ADR 0002). Plain
// types and constants, plus the pairing key's encoding: imported by both
// sides, so nothing here may depend on the backend's layers.

export const PROTOCOL_VERSION = 1;

export const AGENT_WS_PATH = '/agent/v1/ws';

export const AGENT_ENROLL_PATH = '/agent/v1/enroll';

// Where an agent downloads a release binary, with its token (AGT-083):
// `${AGENT_UPDATES_PATH}/<file>`.
export const AGENT_UPDATES_PATH = '/agent/v1/updates';

// 4000–4999 is the range RFC 6455 leaves to applications.
export const CloseCode = {
  // Another connection authenticated as the same agent; the newest wins.
  REPLACED: 4000,
  // Revoked while connected. The agent must stop and not retry.
  REVOKED: 4001,
  // R18 — the agent's protocol is older than the backend accepts.
  UPDATE_REQUIRED: 4002,
  // R17 — subscription expired; the agent idles and retries hourly.
  SUBSCRIPTION_EXPIRED: 4003,
  // A message that is not valid JSON or not a known shape.
  PROTOCOL_ERROR: 4004,
  // No hello within the allowed time after connecting.
  HELLO_TIMEOUT: 4005
} as const;

// What an agent can do beyond its scheduled pings (AGT-100). The backend
// sends a probe request only to an agent that named `probe` in its hello, so
// an older agent never receives one.
export type AgentCapability = 'probe';

export const AGENT_CAPABILITIES: readonly AgentCapability[] = [
  'probe'
];

// ── Agent → backend ───────────────────────────────────────────────────────

export interface HelloMessage {
  type: 'hello';
  protocolVersion: number;
  agentVersion: string;
  // Which release binary fits this agent (AGT-082). Absent from agents
  // older than self-update, which are offered none.
  platform?: AgentPlatform;
  // Absent from agents that answer no probe requests.
  capabilities?: AgentCapability[];
  // Agent's clock, epoch milliseconds.
  sentAt: number;
}

export interface HeartbeatMessage {
  type: 'heartbeat';
  agentVersion: string;
  sentAt: number;
}

export interface ConfigAckMessage {
  type: 'config.ack';
  version: string;
}

// One poll cycle of one device. `d` is the device's index from the config
// snapshot (R19), `at` the agent-clock time the cycle started.
export type PingResultWire =
  | {
      id: string;
      d: number;
      at: number;
      reachable: boolean;
      latencyMs: number | null;
      attempts: number;
    }
  | {
      id: string;
      d: number;
      at: number;
      // The probe itself could not run; says nothing about the device.
      probeError: string;
      attempts: number;
    };

export interface ResultsMessage {
  type: 'results';
  batchId: string;
  results: PingResultWire[];
}

// How the agent's last attempt to update itself ended (AGT-084). Sent after
// every welcome, from `update.json`; the backend ignores a repeat.
export interface UpdateResultMessage {
  type: 'update.result';
  version: string;
  outcome: 'installed' | 'rolled-back' | 'rejected';
  // Why it failed; absent once installed.
  reason?: string;
}

export type PingReadingWire =
  | { reachable: boolean; latencyMs: number | null; attempts: number }
  // The probe itself could not run; says nothing about the device.
  | { probeError: string; attempts: number };

// A radio's reading as the backend's collectors return it, with the byte
// counters, which JSON cannot carry as numbers, in decimal strings.
export interface WirelessClientWire {
  macAddress: string;
  ipAddress: string | null;
  signalRxDbm: number | null;
  noiseFloorDbm: number | null;
  distanceM: number | null;
  uptimeSeconds: number | null;
  txLatencyMs: number | null;
  dlLinkScore: number | null;
  ulLinkScore: number | null;
  dlCapacityKbps: number | null;
  ulCapacityKbps: number | null;
  dlCinr: number | null;
  ulCinr: number | null;
  txBytesTotal: string | null;
  rxBytesTotal: string | null;
  txPps: number | null;
  rxPps: number | null;
  remoteHostname: string | null;
  remotePlatform: string | null;
  remoteVersion: string | null;
  remoteCpuLoad: number | null;
  remoteTotalRam: number | null;
  remoteFreeRam: number | null;
  remoteSignal: number | null;
  remoteNoiseFloor: number | null;
  remoteTxPower: number | null;
  remoteTxThroughputKbps: number | null;
  remoteRxThroughputKbps: number | null;
  remoteIpAddresses: string[];
  dlAirtimePercent: number | null;
  ulAirtimePercent: number | null;
}

export interface WirelessReadingWire {
  deviceName: string | null;
  firmwareVersion: string | null;
  uptimeSeconds: number | null;
  deviceTimeEpoch: number | null;
  cpuLoadPercent: number | null;
  memoryUsedPercent: number | null;
  essid: string | null;
  mode: 'ap-ptmp' | 'sta-ptmp' | 'ap-ptp' | 'sta-ptp' | null;
  frequencyMhz: number | null;
  channelWidthMhz: number | null;
  noiseFloorDbm: number | null;
  throughputTxBps: number | null;
  throughputRxBps: number | null;
  wirelessTxBytes: string | null;
  wirelessRxBytes: string | null;
  distanceM: number | null;
  clientsConnected: number | null;
  ccqPercent: number | null;
  signalRxDbm: number | null;
  signalTxDbm: number | null;
  latencyMs: number | null;
  remoteApMac: string | null;
  remoteApName: string | null;
  remoteApIp: string | null;
  capacityTxKbps: number | null;
  capacityRxKbps: number | null;
  lanStatus: 'UP' | 'DOWN' | null;
  lanSpeedMbps: number | null;
  macAddress: string | null;
  deviceModel: string | null;
  clients: WirelessClientWire[];
}

// The answer to one probe request (AGT-101). `at` is the agent-clock time
// the measurement started; `error` means it could not be made at all.
export type ProbeResultMessage =
  | {
      type: 'probe.result';
      requestId: string;
      kind: 'ping';
      at: number;
      reading: PingReadingWire;
    }
  | {
      type: 'probe.result';
      requestId: string;
      kind: 'wireless';
      at: number;
      reading: WirelessReadingWire;
    }
  | { type: 'probe.result'; requestId: string; error: string };

export type AgentMessage =
  | HelloMessage
  | HeartbeatMessage
  | ConfigAckMessage
  | ResultsMessage
  | UpdateResultMessage
  | ProbeResultMessage;

// ── Backend → agent ───────────────────────────────────────────────────────

export interface WelcomeMessage {
  type: 'welcome';
  agentName: string;
  heartbeatIntervalMs: number;
}

export interface ConfigDeviceWire {
  // Stable for the life of the (agent, device) pair and never reused, so a
  // buffered result still names the right device after the config changed.
  d: number;
  ip: string;
  intervalSeconds: number;
  failuresBeforeDown: number;
}

export interface ConfigMessage {
  type: 'config';
  version: string;
  devices: ConfigDeviceWire[];
}

export interface ResultsAckMessage {
  type: 'results.ack';
  batchId: string;
  // Every result id the backend is done with — stored, or knowingly
  // dropped. The agent deletes these from its buffer.
  ids: string[];
}

// A newer release for this agent (AGT-082). The agent downloads `file` from
// AGENT_UPDATES_PATH and installs it only if the binary matches `sha256` and
// the vendor's key signed it (AGT-080).
export interface UpdateMessage {
  type: 'update';
  version: string;
  file: string;
  sha256: string;
  // The binary's size once unzipped.
  bytes: number;
  signature: string;
}

// The device's credentials, sent with each wireless probe request and held
// by the agent only until it answers (AGT-102).
export interface ProbeCredentialsWire {
  snmpVersion: 1 | 2 | 3;
  snmpCommunity: string | null;
  snmpV3AuthUser: string | null;
  snmpV3AuthProto: 'MD5' | 'SHA' | null;
  snmpV3AuthKey: string | null;
  snmpV3PrivProto: 'DES' | 'AES' | null;
  snmpV3PrivKey: string | null;
  httpUsername: string | null;
  httpPassword: string | null;
  snmpPort: number;
  httpPort: number;
}

// Measure one device now and answer with a probe.result of the same
// requestId (AGT-101). `attempts` is the device's failuresBeforeDown;
// `vendor` picks the collector the backend would have used.
export type ProbeRequestMessage =
  | {
      type: 'probe';
      requestId: string;
      kind: 'ping';
      ip: string;
      attempts: number;
    }
  | {
      type: 'probe';
      requestId: string;
      kind: 'wireless';
      ip: string;
      vendor: string;
      deviceType: 'STATION' | 'ACCESS_POINT';
      credentials: ProbeCredentialsWire;
    };

export type BackendMessage =
  | WelcomeMessage
  | ConfigMessage
  | ResultsAckMessage
  | UpdateMessage
  | ProbeRequestMessage;
