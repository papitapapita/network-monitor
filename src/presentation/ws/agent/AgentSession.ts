import WebSocket from 'ws';
import { ILogger } from 'application/shared/interfaces';
import {
  AcceptAgentResultsUseCase,
  BuildAgentConfigSnapshotUseCase,
  GetAgentUseCase,
  RecordAgentContactUseCase
} from 'application/probe-agents/use-cases';
import { GetSubscriptionStatusUseCase } from 'application/shared/use-cases/GetSubscriptionStatusUseCase';
import { AgentResultDTO } from 'application/probe-agents/dtos';
import {
  AgentMessage,
  BackendMessage,
  CloseCode,
  PingResultWire,
  ResultsMessage
} from 'agent/protocol';
import { parseAgentMessage } from './agentMessageSchema';

export interface AgentSessionUseCases {
  recordContact: RecordAgentContactUseCase;
  buildConfig: BuildAgentConfigSnapshotUseCase;
  acceptResults: AcceptAgentResultsUseCase;
  getAgent: GetAgentUseCase;
  subscriptionStatus: GetSubscriptionStatusUseCase;
}

export interface AgentSessionConfig {
  minProtocolVersion: number;
  heartbeatIntervalMs: number;
  helloTimeoutMs: number;
  configRefreshMs: number;
  pingIntervalMs: number;
}

// One connected agent. Messages are handled strictly one at a time, so a
// results batch never overtakes the hello that preceded it and the database
// sees at most one write burst per agent.
export class AgentSession {
  private greeted = false;
  private closed = false;
  private configVersion: string | null = null;
  private alive = true;
  private queue: Promise<void> = Promise.resolve();
  private readonly timers: ReturnType<typeof setTimeout>[] = [];

  constructor(
    private readonly socket: WebSocket,
    readonly agentId: string,
    private readonly agentName: string,
    private readonly useCases: AgentSessionUseCases,
    private readonly config: AgentSessionConfig,
    private readonly logger: ILogger,
    private readonly onClosed: (session: AgentSession) => void
  ) {
    socket.on('message', (data) => {
      const raw = data.toString();
      // Stamped on arrival, not when the queue gets to it: a result's age is
      // what decides whether it is live (R9).
      const receivedAt = new Date();
      this.enqueue(() => this.handle(raw, receivedAt));
    });
    socket.on('pong', () => {
      this.alive = true;
    });
    socket.on('close', () => this.dispose());
    socket.on('error', (error) =>
      this.logger.warn('Agent socket error', {
        agentId,
        error: error.message
      })
    );

    this.addTimer(
      setTimeout(() => {
        if (!this.greeted) {
          this.close(CloseCode.HELLO_TIMEOUT, 'No hello received');
        }
      }, config.helloTimeoutMs)
    );
    // Transport-level liveness: a socket that stops answering pings is
    // gone even if TCP has not noticed yet.
    this.addTimer(
      setInterval(() => {
        if (!this.alive) {
          socket.terminate();
          return;
        }
        this.alive = false;
        socket.ping();
      }, config.pingIntervalMs)
    );
  }

  // Timers stop as soon as the session decides to close, not when the close
  // handshake completes: otherwise a refresh can still reach the database
  // after shutdown has released it.
  close(code: number, reason: string): void {
    this.closed = true;
    this.stopTimers();
    this.socket.close(code, reason);
  }

  // A failed step is logged and the queue carries on, so one bad message
  // cannot stall every message after it.
  private enqueue(step: () => Promise<void> | void): void {
    this.queue = this.queue
      .then(() => (this.closed ? undefined : step()))
      .catch((error) =>
        this.logger.error(
          'Agent session step failed',
          error instanceof Error ? error : new Error(String(error)),
          { agentId: this.agentId }
        )
      );
  }

  private async handle(raw: string, receivedAt: Date): Promise<void> {
    const message = parseAgentMessage(raw);
    if (message === null) {
      this.close(CloseCode.PROTOCOL_ERROR, 'Malformed message');
      return;
    }
    if (!this.greeted && message.type !== 'hello') {
      this.close(CloseCode.PROTOCOL_ERROR, 'Expected hello first');
      return;
    }

    switch (message.type) {
      case 'hello':
        return this.onHello(message, receivedAt);
      case 'heartbeat':
        return this.recordContact(
          message.agentVersion,
          message.sentAt,
          receivedAt
        );
      case 'config.ack':
        return this.onConfigAck(message.version);
      case 'results':
        return this.onResults(message, receivedAt);
    }
  }

  private async onHello(
    message: Extract<AgentMessage, { type: 'hello' }>,
    receivedAt: Date
  ): Promise<void> {
    if (this.greeted) {
      this.close(CloseCode.PROTOCOL_ERROR, 'Duplicate hello');
      return;
    }
    // R18: refuse before anything is recorded, so an outdated agent never
    // counts as having reported in.
    if (message.protocolVersion < this.config.minProtocolVersion) {
      this.logger.warn('Agent protocol too old', {
        agentId: this.agentId,
        protocolVersion: message.protocolVersion,
        agentVersion: message.agentVersion
      });
      this.close(
        CloseCode.UPDATE_REQUIRED,
        `Protocol ${message.protocolVersion} is no longer supported; update the agent`
      );
      return;
    }

    // R17: an install past its grace period accepts nothing. Refused before
    // contact is recorded, so the agent reads as silent, not as reporting.
    if (await this.subscriptionExpired()) {
      this.close(
        CloseCode.SUBSCRIPTION_EXPIRED,
        'Subscription expired; results are not accepted'
      );
      return;
    }

    this.greeted = true;
    await this.recordContact(
      message.agentVersion,
      message.sentAt,
      receivedAt
    );
    this.send({
      type: 'welcome',
      agentName: this.agentName,
      heartbeatIntervalMs: this.config.heartbeatIntervalMs
    });
    await this.pushConfig();
    this.addTimer(
      setInterval(
        () => this.enqueue(() => this.refresh()),
        this.config.configRefreshMs
      )
    );
  }

  private async recordContact(
    agentVersion: string,
    sentAt: number,
    receivedAt: Date
  ): Promise<void> {
    const result = await this.useCases.recordContact.execute({
      agentId: this.agentId,
      agentVersion,
      sentAt,
      receivedAt
    });
    if (result.isFailure) {
      this.logger.warn('Agent contact not recorded', {
        agentId: this.agentId,
        error: result.error
      });
    }
  }

  // Re-checks that the agent may still be connected (R3: a revoked agent is
  // cut off; R17: so is every agent once the subscription expires) and pushes
  // its configuration if anything changed (R14).
  private async refresh(): Promise<void> {
    if (await this.subscriptionExpired()) {
      this.close(
        CloseCode.SUBSCRIPTION_EXPIRED,
        'Subscription expired; results are not accepted'
      );
      return;
    }
    const agent = await this.useCases.getAgent.execute({
      id: this.agentId
    });
    if (agent.isSuccess && agent.value.status !== 'ACTIVE') {
      this.close(CloseCode.REVOKED, 'Agent revoked');
      return;
    }
    await this.pushConfig();
  }

  // A failure to read the status never cuts off a paying customer.
  private async subscriptionExpired(): Promise<boolean> {
    const status = await this.useCases.subscriptionStatus.execute();
    if (status.isFailure) {
      this.logger.warn('Subscription status unavailable', {
        agentId: this.agentId,
        error: status.error
      });
      return false;
    }
    return status.value.readOnly;
  }

  private async pushConfig(): Promise<void> {
    const snapshot = await this.useCases.buildConfig.execute({
      agentId: this.agentId
    });
    if (snapshot.isFailure) {
      this.logger.error(
        'Could not build agent configuration',
        new Error(snapshot.error),
        { agentId: this.agentId }
      );
      return;
    }
    if (snapshot.value.version === this.configVersion) return;

    this.configVersion = snapshot.value.version;
    this.send({
      type: 'config',
      version: snapshot.value.version,
      devices: snapshot.value.devices.map((d) => ({
        d: d.index,
        ip: d.ipAddress,
        intervalSeconds: d.intervalSeconds,
        failuresBeforeDown: d.failuresBeforeDown
      }))
    });
  }

  private onConfigAck(version: string): void {
    if (version !== this.configVersion) {
      this.logger.warn('Agent acknowledged a stale configuration', {
        agentId: this.agentId,
        acknowledged: version,
        current: this.configVersion
      });
    }
  }

  private async onResults(
    message: ResultsMessage,
    receivedAt: Date
  ): Promise<void> {
    const result = await this.useCases.acceptResults.execute({
      agentId: this.agentId,
      results: message.results.map(toResultDTO),
      receivedAt
    });
    if (result.isFailure) {
      // Nothing acknowledged: the agent keeps the batch and resends it.
      this.logger.error(
        'Agent results batch not accepted',
        new Error(result.error),
        { agentId: this.agentId, batchId: message.batchId }
      );
      return;
    }
    this.send({
      type: 'results.ack',
      batchId: message.batchId,
      ids: result.value.acknowledged
    });
  }

  private send(message: BackendMessage): void {
    if (this.socket.readyState === WebSocket.OPEN) {
      this.socket.send(JSON.stringify(message));
    }
  }

  // A step that was already running when the session closed (a hello still
  // building its first config, say) must not start timers that nothing
  // will ever clear.
  private addTimer(timer: ReturnType<typeof setTimeout>): void {
    if (this.closed) {
      clearInterval(timer);
      return;
    }
    this.timers.push(timer);
  }

  private stopTimers(): void {
    for (const timer of this.timers) clearInterval(timer);
    this.timers.length = 0;
  }

  private dispose(): void {
    this.closed = true;
    this.stopTimers();
    this.onClosed(this);
  }
}

function toResultDTO(wire: PingResultWire): AgentResultDTO {
  const base = {
    id: wire.id,
    deviceIndex: wire.d,
    measuredAt: new Date(wire.at)
  };
  if ('probeError' in wire) {
    return {
      ...base,
      outcome: {
        kind: 'probe-unavailable',
        error: wire.probeError,
        attempts: wire.attempts
      }
    };
  }
  return {
    ...base,
    outcome: {
      kind: 'measured',
      isReachable: wire.reachable,
      latencyMs: wire.reachable ? wire.latencyMs : null,
      attempts: wire.attempts
    }
  };
}
