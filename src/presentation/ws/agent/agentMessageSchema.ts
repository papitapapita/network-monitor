import { z } from 'zod';
import {
  AGENT_CAPABILITIES,
  AGENT_PLATFORMS,
  AgentMessage
} from 'agent/protocol';

const epochMs = z.number().int().nonnegative();
const version = z.string().trim().min(1).max(32);

const pingResult = z.union([
  z.object({
    id: z.string().min(1).max(64),
    d: z.number().int().nonnegative(),
    at: epochMs,
    reachable: z.boolean(),
    latencyMs: z.number().nonnegative().nullable(),
    attempts: z.number().int().positive()
  }),
  z.object({
    id: z.string().min(1).max(64),
    d: z.number().int().nonnegative(),
    at: epochMs,
    probeError: z.string().max(500),
    attempts: z.number().int().positive()
  })
]);

const requestId = z.string().min(1).max(64);
const num = z.number().finite().nullable();
const text = z.string().max(255).nullable();
// Byte counters travel as decimal strings: JSON has no 64-bit integers.
const counter = z
  .string()
  .regex(/^\d{1,20}$/)
  .nullable();

const wirelessClient = z.object({
  macAddress: z.string().max(64),
  ipAddress: text,
  signalRxDbm: num,
  noiseFloorDbm: num,
  distanceM: num,
  uptimeSeconds: num,
  txLatencyMs: num,
  dlLinkScore: num,
  ulLinkScore: num,
  dlCapacityKbps: num,
  ulCapacityKbps: num,
  dlCinr: num,
  ulCinr: num,
  txBytesTotal: counter,
  rxBytesTotal: counter,
  txPps: num,
  rxPps: num,
  remoteHostname: text,
  remotePlatform: text,
  remoteVersion: text,
  remoteCpuLoad: num,
  remoteTotalRam: num,
  remoteFreeRam: num,
  remoteSignal: num,
  remoteNoiseFloor: num,
  remoteTxPower: num,
  remoteTxThroughputKbps: num,
  remoteRxThroughputKbps: num,
  remoteIpAddresses: z.array(z.string().max(64)).max(64),
  dlAirtimePercent: num,
  ulAirtimePercent: num
});

const wirelessReading = z.object({
  deviceName: text,
  firmwareVersion: text,
  uptimeSeconds: num,
  deviceTimeEpoch: num,
  cpuLoadPercent: num,
  memoryUsedPercent: num,
  essid: text,
  mode: z
    .enum(['ap-ptmp', 'sta-ptmp', 'ap-ptp', 'sta-ptp'])
    .nullable(),
  frequencyMhz: num,
  channelWidthMhz: num,
  noiseFloorDbm: num,
  throughputTxBps: num,
  throughputRxBps: num,
  wirelessTxBytes: counter,
  wirelessRxBytes: counter,
  distanceM: num,
  clientsConnected: num,
  ccqPercent: num,
  signalRxDbm: num,
  signalTxDbm: num,
  latencyMs: num,
  remoteApMac: text,
  remoteApName: text,
  remoteApIp: text,
  capacityTxKbps: num,
  capacityRxKbps: num,
  lanStatus: z.enum(['UP', 'DOWN']).nullable(),
  lanSpeedMbps: num,
  macAddress: text,
  deviceModel: text,
  clients: z.array(wirelessClient).max(1000)
});

const pingReading = z.union([
  z.object({
    reachable: z.boolean(),
    latencyMs: z.number().nonnegative().nullable(),
    attempts: z.number().int().positive()
  }),
  z.object({
    probeError: z.string().max(500),
    attempts: z.number().int().positive()
  })
]);

// Three shapes under one type, so it is its own union inside the
// discriminated one.
const probeResult = z.union([
  z.object({
    type: z.literal('probe.result'),
    requestId,
    kind: z.literal('ping'),
    at: epochMs,
    reading: pingReading
  }),
  z.object({
    type: z.literal('probe.result'),
    requestId,
    kind: z.literal('wireless'),
    at: epochMs,
    reading: wirelessReading
  }),
  z.object({
    type: z.literal('probe.result'),
    requestId,
    error: z.string().max(500)
  })
]);

const agentMessage = z.discriminatedUnion('type', [
  z.object({
    type: z.literal('hello'),
    // Any version passes here, however old, so the session can answer it
    // with "update required" (R18) instead of a bare protocol error.
    protocolVersion: z.number().int().nonnegative(),
    agentVersion: version,
    // A platform this backend does not know is dropped, not refused: the
    // agent still connects, it is just offered no release (AGT-082).
    platform: z
      .string()
      .optional()
      .transform((p) => AGENT_PLATFORMS.find((known) => known === p)),
    // Likewise a capability this backend does not know (AGT-100).
    capabilities: z
      .array(z.string().max(32))
      .max(32)
      .optional()
      .transform((names) =>
        AGENT_CAPABILITIES.filter((known) => names?.includes(known))
      ),
    sentAt: epochMs
  }),
  z.object({
    type: z.literal('heartbeat'),
    agentVersion: version,
    sentAt: epochMs
  }),
  z.object({
    type: z.literal('config.ack'),
    version: z.string().min(1).max(64)
  }),
  z.object({
    type: z.literal('update.result'),
    version,
    outcome: z.enum(['installed', 'rolled-back', 'rejected']),
    reason: z.string().trim().min(1).max(500).optional()
  }),
  z.object({
    type: z.literal('results'),
    batchId: z.string().min(1).max(64),
    results: z.array(pingResult).max(5000)
  })
]);

export function parseAgentMessage(raw: string): AgentMessage | null {
  let json: unknown;
  try {
    json = JSON.parse(raw);
  } catch {
    return null;
  }
  const parsed = z.union([agentMessage, probeResult]).safeParse(json);
  return parsed.success ? (parsed.data as AgentMessage) : null;
}
