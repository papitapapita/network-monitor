import { IncomingMessage, Server } from 'http';
import { Duplex } from 'stream';
import { WebSocketServer } from 'ws';
import { ILogger } from 'application/shared/interfaces';
import { AuthenticateAgentUseCase } from 'application/probe-agents/use-cases';
import { AGENT_WS_PATH, CloseCode } from 'agent/protocol';
import {
  AgentSession,
  AgentSessionConfig,
  AgentSessionUseCases
} from './AgentSession';
import { ConnectedAgents } from './ConnectedAgents';

export const DEFAULT_AGENT_SESSION_CONFIG: AgentSessionConfig = {
  minProtocolVersion: 1,
  heartbeatIntervalMs: 30_000,
  helloTimeoutMs: 10_000,
  configRefreshMs: 60_000,
  pingIntervalMs: 30_000
};

// The agents' one connection to the backend (ADR 0002). Outside /api: an
// agent authenticates with its own token at the HTTP upgrade, never a
// user's JWT, and the token is all that identifies it (R4).
export class AgentGateway {
  private readonly wss = new WebSocketServer({
    noServer: true,
    perMessageDeflate: true,
    maxPayload: 4 * 1024 * 1024
  });
  constructor(
    private readonly authenticate: AuthenticateAgentUseCase,
    private readonly useCases: AgentSessionUseCases,
    private readonly agents: ConnectedAgents,
    private readonly logger: ILogger,
    private readonly config: AgentSessionConfig = DEFAULT_AGENT_SESSION_CONFIG
  ) {}

  attach(server: Server): void {
    server.on('upgrade', (request, socket, head) => {
      void this.onUpgrade(request, socket, head);
    });
  }

  closeAll(): void {
    this.agents.closeAll(1001, 'Server shutting down');
    this.wss.close();
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
      this.agents
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
          if (this.agents.remove(closed)) {
            this.logger.info('Agent disconnected', { agentId });
          }
        }
      );
      this.agents.add(session);
      this.logger.info('Agent connected', { agentId, agentName });
    });
  }
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
