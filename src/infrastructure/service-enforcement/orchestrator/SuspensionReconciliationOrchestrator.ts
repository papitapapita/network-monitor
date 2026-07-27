import { IContractedServiceRepository } from 'domain/customers/repository';
import { ContractedServiceStatus } from 'domain/customers/enums';
import { IDeviceRepository } from 'domain/device-inventory/repository';
import {
  IRouterQueueService,
  RouterConnection,
  SuspensionQueue,
  suspensionQueueName
} from 'application/service-enforcement/interfaces';
import { EnforcementRouterResolver } from 'application/service-enforcement/services';
import { ILogger } from 'application/shared/interfaces';

interface OrchestratorConfig {
  checkIntervalMs?: number;
}

/**
 * Converges router state with the DB: every SUSPENDED service with an
 * assigned device must have a suspension queue targeting the device IP,
 * and no other suspend-* queue may exist. Repairs drift left by a failed
 * event handler, an unreachable router, or manual queue edits.
 */
export class SuspensionReconciliationOrchestrator {
  private readonly checkIntervalMs: number;
  private intervalId: ReturnType<typeof setInterval> | null = null;
  private isRunning = false;
  private inFlight = false;

  constructor(
    private readonly contractedServiceRepo: IContractedServiceRepository,
    private readonly deviceRepo: IDeviceRepository,
    private readonly routerResolver: EnforcementRouterResolver,
    private readonly routerQueueService: IRouterQueueService,
    config: OrchestratorConfig = {},
    private readonly logger: ILogger
  ) {
    this.checkIntervalMs = config.checkIntervalMs ?? 60_000;
  }

  start(): void {
    if (this.isRunning) return;

    this.isRunning = true;
    this.logger.info(
      '[SuspensionReconciliationOrchestrator] Started',
      {
        checkIntervalMs: this.checkIntervalMs
      }
    );

    void this.reconcile();
    this.intervalId = setInterval(
      () => void this.reconcile(),
      this.checkIntervalMs
    );
  }

  async stop(): Promise<void> {
    if (!this.isRunning) return;

    this.isRunning = false;
    if (this.intervalId) {
      clearInterval(this.intervalId);
      this.intervalId = null;
    }

    const maxWaitMs = 30_000;
    const startWait = Date.now();
    while (this.inFlight && Date.now() - startWait < maxWaitMs) {
      await new Promise((resolve) => setTimeout(resolve, 200));
    }

    this.logger.info(
      '[SuspensionReconciliationOrchestrator] Stopped'
    );
  }

  isActive(): boolean {
    return this.isRunning;
  }

  async reconcile(): Promise<void> {
    if (this.inFlight) return;

    this.inFlight = true;
    try {
      const desiredResult = await this.buildDesiredState();
      if (desiredResult === null) return;
      const desired = desiredResult;

      const connectionResult = await this.routerResolver.resolve();
      if (connectionResult.isFailure) {
        this.logger.warn(
          '[SuspensionReconciliationOrchestrator] Cannot resolve router connection',
          { error: connectionResult.error }
        );
        return;
      }
      const connection = connectionResult.value;

      const actualResult =
        await this.routerQueueService.listSuspensionQueues(
          connection
        );
      if (actualResult.isFailure) {
        this.logger.warn(
          '[SuspensionReconciliationOrchestrator] Failed to list queues',
          { error: actualResult.error }
        );
        return;
      }
      const actualByName = new Map(
        actualResult.value.map((q) => [q.name, q])
      );

      for (const queue of desired.values()) {
        const actual = actualByName.get(queue.name);
        if (actual && actual.targetIp === queue.targetIp) continue;

        if (actual) {
          // target IP drifted — recreate the queue
          await this.removeQueue(connection, queue.name);
        }
        const addResult =
          await this.routerQueueService.addSuspensionQueue(
            connection,
            queue
          );
        if (addResult.isFailure) {
          this.logger.warn(
            '[SuspensionReconciliationOrchestrator] Failed to add queue',
            { queueName: queue.name, error: addResult.error }
          );
        } else {
          this.logger.info(
            '[SuspensionReconciliationOrchestrator] Queue reconciled',
            { queueName: queue.name, targetIp: queue.targetIp }
          );
        }
      }

      for (const name of actualByName.keys()) {
        if (!desired.has(name)) {
          await this.removeQueue(connection, name);
        }
      }
    } catch (error) {
      this.logger.warn(
        '[SuspensionReconciliationOrchestrator] Unexpected error in reconcile',
        {
          error:
            error instanceof Error ? error.message : String(error)
        }
      );
    } finally {
      this.inFlight = false;
    }
  }

  private async buildDesiredState(): Promise<Map<
    string,
    SuspensionQueue
  > | null> {
    const suspendedResult =
      await this.contractedServiceRepo.findByStatus(
        ContractedServiceStatus.SUSPENDED
      );
    if (suspendedResult.isFailure) {
      this.logger.warn(
        '[SuspensionReconciliationOrchestrator] Failed to load suspended services',
        { error: suspendedResult.error }
      );
      return null;
    }

    const desired = new Map<string, SuspensionQueue>();
    for (const service of suspendedResult.value) {
      if (!service.deviceId) continue;

      const deviceResult = await this.deviceRepo.findById(
        service.deviceId
      );
      if (deviceResult.isFailure || !deviceResult.value) {
        this.logger.warn(
          '[SuspensionReconciliationOrchestrator] Cannot load device for suspended service',
          { contractedServiceId: service.id.toString() }
        );
        continue;
      }
      const ipAddress = deviceResult.value.ipAddress;
      if (!ipAddress) continue;

      const name = suspensionQueueName(service.id.toString());
      desired.set(name, { name, targetIp: ipAddress.value });
    }
    return desired;
  }

  private async removeQueue(
    connection: RouterConnection,
    name: string
  ): Promise<void> {
    const removeResult =
      await this.routerQueueService.removeSuspensionQueue(
        connection,
        name
      );
    if (removeResult.isFailure) {
      this.logger.warn(
        '[SuspensionReconciliationOrchestrator] Failed to remove queue',
        { queueName: name, error: removeResult.error }
      );
    } else {
      this.logger.info(
        '[SuspensionReconciliationOrchestrator] Queue removed',
        { queueName: name }
      );
    }
  }
}
