import { ILogger } from 'application/shared/interfaces';
import type {
  AgentPingOutcome,
  AgentProbeFailure,
  AgentProbeOutcome,
  AgentRadioRequest,
  IAgentProbeChannel
} from 'application/probe-agents/interfaces';
import type { WirelessCollectionResult } from 'application/wireless-monitoring/interfaces';
import { ProbeResultMessage } from 'agent/protocol';
import { AgentSession, ProbeRequest } from './AgentSession';
import {
  fromPingReadingWire,
  fromWirelessReadingWire,
  measuredAt
} from './probeWire';

export interface ProbeTimeouts {
  // Pings are asked for by hand only, at up to 3 attempts (MON-022), and
  // must give up before the 30 s HTTP proxy in front of the API does.
  pingMs: number;
  // A radio login plus its status reads, at up to 10 s each.
  wirelessMs: number;
}

export const DEFAULT_PROBE_TIMEOUTS: ProbeTimeouts = {
  pingMs: 25_000,
  wirelessMs: 45_000
};

// The agents connected right now, one session each (AGT-045), and the way
// the rest of the backend asks one of them to measure a device (AGT-103).
// Built before the gateway that fills it, so the use cases that probe
// through an agent need not wait for the WebSocket server.
export class ConnectedAgents implements IAgentProbeChannel {
  private readonly sessions = new Map<string, AgentSession>();

  constructor(
    private readonly logger: ILogger,
    private readonly probeTimeouts: ProbeTimeouts = DEFAULT_PROBE_TIMEOUTS
  ) {}

  isConnected(agentId: string): boolean {
    return this.sessions.has(agentId);
  }

  get(agentId: string): AgentSession | undefined {
    return this.sessions.get(agentId);
  }

  add(session: AgentSession): void {
    this.sessions.set(session.agentId, session);
  }

  // False when a newer connection has already taken the agent's place.
  remove(session: AgentSession): boolean {
    if (this.sessions.get(session.agentId) !== session) return false;
    this.sessions.delete(session.agentId);
    return true;
  }

  closeAll(code: number, reason: string): void {
    for (const session of this.sessions.values()) {
      session.close(code, reason);
    }
  }

  async ping(
    agentId: string,
    ipAddress: string,
    attempts: number
  ): Promise<AgentProbeOutcome<AgentPingOutcome>> {
    const answer = await this.probe(
      agentId,
      { type: 'probe', kind: 'ping', ip: ipAddress, attempts },
      this.probeTimeouts.pingMs
    );
    if (!answer.ok) return answer;
    if (answer.result.kind !== 'ping') return wrongKind();
    return {
      ok: true,
      reading: fromPingReadingWire(answer.result.reading),
      measuredAt: answer.measuredAt
    };
  }

  async readRadio(
    agentId: string,
    request: AgentRadioRequest
  ): Promise<AgentProbeOutcome<WirelessCollectionResult>> {
    const answer = await this.probe(
      agentId,
      {
        type: 'probe',
        kind: 'wireless',
        ip: request.ipAddress,
        vendor: request.vendor,
        deviceType: request.deviceType,
        credentials: request.credentials
      },
      this.probeTimeouts.wirelessMs
    );
    if (!answer.ok) return answer;
    if (answer.result.kind !== 'wireless') return wrongKind();
    return {
      ok: true,
      reading: fromWirelessReadingWire(answer.result.reading),
      measuredAt: answer.measuredAt
    };
  }

  private async probe(
    agentId: string,
    request: ProbeRequest,
    timeoutMs: number
  ): Promise<
    | {
        ok: true;
        result: Exclude<ProbeResultMessage, { error: string }>;
        measuredAt: Date;
      }
    | AgentProbeFailure
  > {
    const session = this.sessions.get(agentId);
    if (!session) {
      return fail('AGENT_OFFLINE', 'The agent is not connected');
    }
    if (!session.canProbe) {
      return fail(
        'PROBE_UNSUPPORTED',
        'The agent must be updated to answer this request'
      );
    }
    const answer = await session.probe(request, timeoutMs);
    switch (answer.kind) {
      case 'closed':
        return fail('AGENT_OFFLINE', 'The agent disconnected');
      case 'timeout':
        this.logger.warn('Agent probe timed out', {
          agentId,
          kind: request.kind,
          timeoutMs
        });
        return fail('TIMEOUT', 'The agent did not answer in time');
    }
    const { result } = answer;
    if ('error' in result) return fail('AGENT_ERROR', result.error);
    return {
      ok: true,
      result,
      measuredAt: measuredAt(
        result.at,
        answer.sentAt,
        answer.receivedAt
      )
    };
  }
}

function fail(
  reason: AgentProbeFailure['reason'],
  error: string
): AgentProbeFailure {
  return { ok: false, reason, error };
}

function wrongKind(): AgentProbeFailure {
  return fail(
    'AGENT_ERROR',
    'The agent answered a different request'
  );
}
