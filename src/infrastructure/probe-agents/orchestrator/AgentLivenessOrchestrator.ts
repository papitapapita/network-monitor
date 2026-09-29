import { MarkSilentAgentsOfflineUseCase } from 'application/probe-agents/use-cases';
import { ILogger } from 'application/shared/interfaces';

interface OrchestratorConfig {
  checkIntervalMs?: number;
}

export class AgentLivenessOrchestrator {
  private readonly checkIntervalMs: number;
  private intervalId: ReturnType<typeof setInterval> | null = null;
  private isRunning = false;

  constructor(
    private readonly markSilentAgentsOfflineUseCase: MarkSilentAgentsOfflineUseCase,
    config: OrchestratorConfig = {},
    private readonly logger: ILogger
  ) {
    this.checkIntervalMs = config.checkIntervalMs ?? 60_000;
  }

  start(): void {
    if (this.isRunning) return;

    this.isRunning = true;
    this.logger.info('[AgentLivenessOrchestrator] Started', {
      checkIntervalMs: this.checkIntervalMs
    });

    void this.scan();
    this.intervalId = setInterval(
      () => void this.scan(),
      this.checkIntervalMs
    );
  }

  stop(): void {
    if (!this.isRunning) return;

    this.isRunning = false;
    if (this.intervalId) {
      clearInterval(this.intervalId);
      this.intervalId = null;
    }

    this.logger.info('[AgentLivenessOrchestrator] Stopped');
  }

  isActive(): boolean {
    return this.isRunning;
  }

  private async scan(): Promise<void> {
    if (!this.isRunning) return;

    try {
      const result =
        await this.markSilentAgentsOfflineUseCase.execute();
      if (result.isFailure) {
        this.logger.error(
          '[AgentLivenessOrchestrator] Scan failed',
          new Error(result.error)
        );
      }
    } catch (error) {
      this.logger.error(
        '[AgentLivenessOrchestrator] Unexpected error',
        error as Error
      );
    }
  }
}
