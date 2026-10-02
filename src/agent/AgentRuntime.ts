import type { ILogger } from 'application/shared/interfaces';
import { ConfigMessage } from 'agent/protocol';
import { ConfigStore } from './config/ConfigStore';
import {
  AgentCredentials,
  CredentialStore
} from './identity/CredentialStore';
import { EnrollOutcome } from './identity/enrollAgent';
import { PairingKeySource } from './identity/PairingKeySource';
import { PollScheduler } from './polling/PollScheduler';
import { ResultBuffer } from './results/ResultBuffer';
import { ProbeRunner } from './probes/ProbeRunner';
import { AgentUpdater } from './update/AgentUpdater';
import {
  BackendConnection,
  ConnectionCallbacks
} from './connection/BackendConnection';

export interface AgentRuntimeDeps {
  credentials: CredentialStore;
  pairingKey: PairingKeySource;
  enroll: (pairingKey: string) => Promise<EnrollOutcome>;
  config: ConfigStore;
  buffer: ResultBuffer;
  scheduler: PollScheduler;
  probes: ProbeRunner;
  connect: (
    credentials: AgentCredentials,
    callbacks: ConnectionCallbacks
  ) => BackendConnection;
  logger: ILogger;
  // Absent where the agent cannot replace its own binary (not packaged).
  updater?: AgentUpdater;
  pairingCheckMs?: number;
  enrollRetryMs?: number;
  subscriptionRetryMs?: number;
  pruneEveryMs?: number;
}

// Ties the pieces together: pair once, then poll and report for as long as
// the process runs. Polling does not wait for the backend — with the last
// saved configuration it runs, and buffers, through an outage.
export class AgentRuntime {
  private connection: BackendConnection | null = null;
  private waitTimer: ReturnType<typeof setTimeout> | null = null;
  private pruneTimer: ReturnType<typeof setInterval> | null = null;
  private stopping = false;
  private readonly pairingCheckMs: number;
  private readonly enrollRetryMs: number;
  private readonly subscriptionRetryMs: number;

  constructor(private readonly deps: AgentRuntimeDeps) {
    this.pairingCheckMs = deps.pairingCheckMs ?? 30_000;
    this.enrollRetryMs = deps.enrollRetryMs ?? 60_000;
    this.subscriptionRetryMs =
      deps.subscriptionRetryMs ?? 60 * 60 * 1000;
    deps.updater?.onReport((report) =>
      this.connection?.sendUpdateResult(report)
    );
  }

  async start(): Promise<void> {
    const { buffer, scheduler, logger } = this.deps;
    buffer.startPersisting();
    this.pruneTimer = setInterval(
      () => buffer.prune(),
      this.deps.pruneEveryMs ?? 60_000
    );

    const credentials = await this.deps.credentials.load();
    if (credentials === null) {
      logger.info('Not paired yet; waiting for a pairing key');
      await this.tryToPair();
      return;
    }

    const saved = await this.deps.config.load();
    if (saved) scheduler.applyConfig(saved.devices);
    scheduler.start();
    this.connectWith(credentials);
  }

  async stop(): Promise<void> {
    this.stopping = true;
    if (this.waitTimer) clearTimeout(this.waitTimer);
    if (this.pruneTimer) clearInterval(this.pruneTimer);
    this.deps.updater?.stop();
    this.deps.scheduler.stop();
    await this.connection?.stop();
    // A cycle mid-retry can take several seconds; a service stop must not.
    await Promise.race([
      this.deps.scheduler.drain(),
      new Promise((resolve) => setTimeout(resolve, 5_000).unref())
    ]);
    await this.deps.buffer.close();
  }

  private async tryToPair(): Promise<void> {
    if (this.stopping) return;
    const { logger, pairingKey } = this.deps;
    const key = await pairingKey.read();
    if (key === null) {
      this.waitThen(this.pairingCheckMs, () => this.tryToPair());
      return;
    }

    const outcome = await this.deps.enroll(key);
    switch (outcome.kind) {
      case 'enrolled':
        await this.deps.credentials.save(outcome.credentials);
        await pairingKey.discard();
        logger.info('Paired with the backend', {
          agentName: outcome.credentials.agentName,
          backendUrl: outcome.credentials.backendUrl
        });
        this.deps.scheduler.start();
        this.connectWith(outcome.credentials);
        return;
      case 'rejected':
        await pairingKey.discard();
        logger.error(
          'Pairing key refused; ask for a new one',
          undefined,
          { reason: outcome.reason }
        );
        this.waitThen(this.pairingCheckMs, () => this.tryToPair());
        return;
      case 'retry':
        logger.warn('Pairing did not complete; retrying', {
          reason: outcome.reason
        });
        this.waitThen(
          outcome.subscriptionExpired
            ? this.subscriptionRetryMs
            : this.enrollRetryMs,
          () => this.tryToPair()
        );
    }
  }

  private connectWith(credentials: AgentCredentials): void {
    const { scheduler, config, logger } = this.deps;
    this.connection = this.deps.connect(credentials, {
      onWelcome: () => {
        scheduler.start();
        void this.reportUpdate();
      },
      onUpdate: (offer) =>
        void this.deps.updater
          ?.offer(offer, credentials)
          .catch((error) =>
            logger.error(
              'Update attempt failed',
              error instanceof Error
                ? error
                : new Error(String(error))
            )
          ),
      onProbe: (request) => this.deps.probes.run(request),
      onConfig: async (message: ConfigMessage, first: boolean) => {
        scheduler.applyConfig(message.devices);
        if (first) scheduler.pollAllNow();
        try {
          await config.save({
            version: message.version,
            devices: message.devices
          });
        } catch (error) {
          logger.warn('Could not save the configuration', {
            error:
              error instanceof Error ? error.message : String(error)
          });
        }
      },
      // R17: nothing would be accepted, so nothing is measured.
      onSubscriptionExpired: () => scheduler.stop(),
      onRevoked: () => void this.forgetEverything()
    });
    this.connection.start();
  }

  // AGT-084: confirms a version on trial (AGT-085), then tells the backend
  // how the last update ended.
  private async reportUpdate(): Promise<void> {
    const { updater, logger } = this.deps;
    if (!updater) return;
    try {
      const report = await updater.welcomed();
      if (report) this.connection?.sendUpdateResult(report);
    } catch (error) {
      logger.error(
        'Could not record the update',
        error instanceof Error ? error : new Error(String(error))
      );
    }
  }

  // R3: a revoked agent keeps no token, no addresses and no results, and
  // waits to be paired again.
  private async forgetEverything(): Promise<void> {
    const { scheduler, buffer, config, credentials } = this.deps;
    this.deps.updater?.stop();
    scheduler.stop();
    await scheduler.drain();
    scheduler.clear();
    this.connection = null;
    await Promise.all([
      credentials.clear(),
      config.clear(),
      buffer.clear()
    ]);
    this.deps.logger.info(
      'Identity, configuration and results removed'
    );
    await this.tryToPair();
  }

  private waitThen(ms: number, next: () => Promise<void>): void {
    if (this.stopping) return;
    this.waitTimer = setTimeout(() => {
      this.waitTimer = null;
      void next().catch((error) =>
        this.deps.logger.error(
          'Pairing attempt failed',
          error instanceof Error ? error : new Error(String(error))
        )
      );
    }, ms);
  }
}
