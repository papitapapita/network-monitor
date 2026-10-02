import { IncomingMessage, Server } from 'http';
import { Duplex } from 'stream';
import { WebSocketServer } from 'ws';
import { ILogger } from 'application/shared/interfaces';
import { AuthenticateAgentUseCase } from 'application/probe-agents/use-cases';
import type {
  AgentPingOutcome,
  AgentProbeFailure,
  AgentProbeOutcome,
  AgentRadioRequest,
  IAgentProbeChannel
} from 'application/probe-agents/interfaces';
import type { WirelessCollectionResult } from 'application/wireless-monitoring/interfaces';
import {
  AGENT_WS_PATH,
  CloseCode,
  ProbeResultMessage
} from 'agent/protocol';
import {
  AgentSession,
  AgentSessionConfig,
  AgentSessionUseCases,
  ProbeRequest
} from './AgentSession';
import {
  fromPingReadingWire,
  fromWirelessReadingWire,
  measuredAt
} from './probeWire';

export const DEFAULT_AGENT_SESSION_CONFIG: AgentSessionConfig = {
  minProtocolVersion: 1,
  heartbeatIntervalMs: 30_000,
  helloTimeoutMs: 10_000,
  configRefreshMs: 60_000,
  pingIntervalMs: 30_000
};

export interface ProbeTimeouts {
  // Up to 10 attempts, each with its own timeout and a pause between.
  pingMs: number;
  // A radio login plus its status reads, at up to 10 s each.
  wirelessMs: number;
}

export const DEFAULT_PROBE_TIMEOUTS: ProbeTimeouts = {
  pingMs: 60_000,
  wirelessMs: 45_000
};

// The agents' one connection to the backend (ADR 0002). Outside /api: an
// agent authenticates with its own token at the HTTP upgrade, never a
// user's JWT, and the token is all that identifies it (R4).
export class AgentGateway implements IAgentProbeChannel {
  private readonly wss = new WebSocketServer({
    noServer: true,
    perMessageDeflate: true,
    maxPayload: 4 * 1024 * 1024
  });
  private readonly sessions = new Map<string, AgentSession>();

  constructor(
    private readonly authenticate: AuthenticateAgentUseCase,
    private readonly useCases: AgentSessionUseCases,
    private readonly logger: ILogger,
    private readonly config: AgentSessionConfig = DEFAULT_AGENT_SESSION_CONFIG,
    private readonly probeTimeouts: ProbeTimeouts = DEFAULT_PROBE_TIMEOUTS
  ) {}

  attach(server: Server): void {
    server.on('upgrade', (request, socket, head) => {
      void this.onUpgrade(request, socket, head);
    });
  }

  isConnected(agentId: string): boolean {
    return this.sessions.has(agentId);
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

  closeAll(): void {
    for (const session of this.sessions.values()) {
      session.close(1001, 'Server shutting down');
    }
    this.wss.close();
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

  private async onUpgrade(
    request: IncomingMessage,
    socket: Duplex,
    head: Buffer
  ): Promise<void> {
    const path = new URL(request.url ?? '/', 'http://localhost')
      .pathname;
    if (path !== AGENT_WS_PATH) {
      reject(socket, 404, 'Not Found');
      return;
    }

    const token = bearerToken(request.headers.authorization);
    const auth = await this.authenticate.execute({
      token: token ?? ''
    });
    if (auth.isFailure) {
      reject(socket, 401, 'Unauthorized');
      return;
    }
    const { agentId, agentName } = auth.value;

    this.wss.handleUpgrade(request, socket, head, (ws) => {
      // One live connection per agent: a reconnect after a network blip can
      // arrive before the old socket times out, and the newest is the truth.
      this.sessions
        .get(agentId)
        ?.close(CloseCode.REPLACED, 'Replaced by a newer connection');

      const session = new AgentSession(
        ws,
        agentId,
        agentName,
        this.useCases,
        this.config,
        this.logger,
        (closed) => {
          if (this.sessions.get(agentId) === closed) {
            this.sessions.delete(agentId);
            this.logger.info('Agent disconnected', { agentId });
          }
        }
      );
      this.sessions.set(agentId, session);
      this.logger.info('Agent connected', { agentId, agentName });
    });
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

function bearerToken(header: string | undefined): string | null {
  const match = header?.match(/^Bearer\s+(.+)$/i);
  return match ? match[1].trim() : null;
}

function reject(socket: Duplex, status: number, text: string): void {
  socket.write(
    `HTTP/1.1 ${status} ${text}\r\nConnection: close\r\nContent-Length: 0\r\n\r\n`
  );
  socket.destroy();
}
