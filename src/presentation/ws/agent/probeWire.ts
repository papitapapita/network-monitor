import type { WirelessCollectionResult } from 'application/wireless-monitoring/interfaces';
import type { AgentPingOutcome } from 'application/probe-agents/interfaces';
import type {
  PingReadingWire,
  WirelessReadingWire
} from 'agent/protocol';

export function fromPingReadingWire(
  wire: PingReadingWire
): AgentPingOutcome {
  if ('probeError' in wire) {
    return {
      kind: 'probe-unavailable',
      error: wire.probeError,
      attempts: wire.attempts
    };
  }
  return {
    kind: 'measured',
    isReachable: wire.reachable,
    latencyMs: wire.reachable ? wire.latencyMs : null,
    attempts: wire.attempts
  };
}

const counter = (value: string | null): bigint | null =>
  value === null ? null : BigInt(value);

export function fromWirelessReadingWire(
  wire: WirelessReadingWire
): WirelessCollectionResult {
  return {
    ...wire,
    wirelessTxBytes: counter(wire.wirelessTxBytes),
    wirelessRxBytes: counter(wire.wirelessRxBytes),
    clients: wire.clients.map((client) => ({
      ...client,
      txBytesTotal: counter(client.txBytesTotal),
      rxBytesTotal: counter(client.rxBytesTotal)
    }))
  };
}

// AGT-104: the agent's clock is trusted only between the moment the request
// left and the moment the answer arrived, both on the backend's clock.
export function measuredAt(
  agentAt: number,
  sentAt: Date,
  receivedAt: Date
): Date {
  return new Date(
    Math.min(
      Math.max(agentAt, sentAt.getTime()),
      receivedAt.getTime()
    )
  );
}
