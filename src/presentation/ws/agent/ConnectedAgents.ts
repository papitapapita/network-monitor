import { ILogger } from 'application/shared/interfaces';
import type {
  AgentEnforceOutcome,
  AgentEnforceRequest,
  AgentPingOutcome,
  AgentProbeFailure,
  AgentProbeOutcome,
  AgentRadioRequest,
  IAgentEnforceChannel,
  IAgentProbeChannel
} from 'application/probe-agents/interfaces';
import type { RouterConnection } from 'application/service-enforcement/interfaces';
import type { WirelessCollectionResult } from 'application/wireless-monitoring/interfaces';
import type {
  AgentConfigFetchRequest,
  FetchedConfig
} from 'application/device-backups/interfaces';
import { BackupFormat } from 'domain/device-backups/enums';
import { ProbeResultMessage } from 'agent/protocol';
import {
  AgentSession,
  EnforceRequest,
  ProbeRequest
} from './AgentSession';
import {
  fromPingReadingWire,
  fromWirelessReadingWire,
  measuredAt
} from './probeWire';

export interface ProbeTimeouts {
  // Pings are asked for by hand only, at up to 3 attempts (MON-022), and
  // must give up before the 30 s HTTP proxy in front of the API does.
  pingMs: number;
  // A manual radio read (WLS-029) sits behind the same proxy. A login and a
  // status read take a few seconds on a healthy radio.
  wirelessMs: number;
  // A router login plus one queue command; a cut run sends them in a row.
  enforceMs?: number;
  // A login and one download, over SSH or HTTP. Mostly asked for by the
  // nightly run, which no proxy times, and a large router's export takes
  // some seconds.
  backupMs?: number;
}

export const DEFAULT_PROBE_TIMEOUTS: ProbeTimeouts = {
  pingMs: 25_000,
  wirelessMs: 25_000,
  enforceMs: 20_000,
  backupMs: 45_000
};

const DEFAULT_ENFORCE_MS = 20_000;
const DEFAULT_BACKUP_MS = 45_000;

// The agents connected right now, one session each (AGT-045), and the way
// the rest of the backend asks one of them to measure a device (AGT-103).
// Built before the gateway that fills it, so the use cases that probe
// through an agent need not wait for the WebSocket server.
export class ConnectedAgents
  implements IAgentProbeChannel, IAgentEnforceChannel
{
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

  async fetchConfig(
    agentId: string,
    request: AgentConfigFetchRequest
  ): Promise<AgentProbeOutcome<FetchedConfig>> {
    const { credentials } = request;
    const answer = await this.probe(
      agentId,
      {
        type: 'probe',
        kind: 'backup',
        ip: request.ipAddress,
        vendor: request.vendorSlug,
        deviceKind: request.kind,
        login: {
          username: credentials.username,
          password: credentials.password,
          httpPort: credentials.httpPort,
          sshPort: credentials.sshPort
        }
      },
      this.probeTimeouts.backupMs ?? DEFAULT_BACKUP_MS
    );
    if (!answer.ok) return answer;
    if (answer.result.kind !== 'backup') return wrongKind();
    return {
      ok: true,
      reading: {
        format: BackupFormat[answer.result.config.format],
        content: answer.result.config.content
      },
      measuredAt: answer.measuredAt
    };
  }

  async enforce(
    agentId: string,
    router: RouterConnection,
    request: AgentEnforceRequest
  ): Promise<AgentEnforceOutcome> {
    const session = this.sessions.get(agentId);
    if (!session) {
      return fail('AGENT_OFFLINE', 'The agent is not connected');
    }
    if (!session.canEnforce) {
      return fail(
        'PROBE_UNSUPPORTED',
        'The agent must be updated to apply suspensions'
      );
    }
    const timeoutMs =
      this.probeTimeouts.enforceMs ?? DEFAULT_ENFORCE_MS;
    const answer = await session.enforce(
      {
        type: 'enforce',
        router: {
          host: router.host,
          port: router.port,
          username: router.username,
          password: router.password
        },
        ...request
      } as EnforceRequest,
      timeoutMs
    );
    switch (answer.kind) {
      case 'closed':
        return fail('AGENT_OFFLINE', 'The agent disconnected');
      case 'timeout':
        this.logger.warn('Agent enforce request timed out', {
          agentId,
          action: request.action,
          timeoutMs
        });
        return fail('TIMEOUT', 'The agent did not answer in time');
    }
    const { result } = answer;
    if ('error' in result) return fail('AGENT_ERROR', result.error);
    return { ok: true, queues: result.queues };
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
    if (
      request.kind === 'backup'
        ? !session.canBackUp
        : !session.canProbe
    ) {
      return fail(
        'PROBE_UNSUPPORTED',
        request.kind === 'backup'
          ? 'The agent must be updated to take backups'
          : 'The agent must be updated to answer this request'
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
