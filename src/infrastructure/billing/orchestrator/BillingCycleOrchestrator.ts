import { RunBillingCycleUseCase } from 'application/billing/use-cases';
import { ILogger } from 'application/shared/interfaces';

// Colombia is UTC-5 with no daylight saving.
const LOCAL_OFFSET_MS = -5 * 60 * 60 * 1000;
const RUN_FROM_LOCAL_HOUR = 6;

interface OrchestratorConfig {
  checkIntervalMs?: number;
}

// One billing run per local day, from 6:00 (BIL-284). The day is remembered
// in memory only: the run is safe to repeat, so a restart costs nothing. A
// day is not counted while automatic billing is off, so turning it on takes
// effect within one check rather than the next day. A failed run is retried
// on the next check.
export class BillingCycleOrchestrator {
  private readonly checkIntervalMs: number;
  private intervalId: ReturnType<typeof setInterval> | null = null;
  private lastHandledDay: string | null = null;

  constructor(
    private readonly runBillingCycleUseCase: RunBillingCycleUseCase,
    config: OrchestratorConfig = {},
    private readonly logger: ILogger,
    private readonly clock: () => Date = () => new Date()
  ) {
    this.checkIntervalMs = config.checkIntervalMs ?? 15 * 60_000;
  }

  start(): void {
    if (this.intervalId) return;
    void this.tick();
    this.intervalId = setInterval(
      () => void this.tick(),
      this.checkIntervalMs
    );
  }

  stop(): void {
    if (this.intervalId) {
      clearInterval(this.intervalId);
      this.intervalId = null;
    }
  }

  async tick(): Promise<void> {
    const now = this.clock();
    const local = new Date(now.getTime() + LOCAL_OFFSET_MS);
    const day = local.toISOString().slice(0, 10);
    if (day === this.lastHandledDay) return;
    if (local.getUTCHours() < RUN_FROM_LOCAL_HOUR) return;

    try {
      const result = await this.runBillingCycleUseCase.execute({
        now
      });
      if (result.isFailure) {
        this.logger.error(
          '[BillingCycleOrchestrator] Billing run failed',
          new Error(result.error)
        );
        return;
      }
      const run = result.value;
      if (!run.automaticBillingEnabled) return;

      this.lastHandledDay = day;
      this.logger.info(
        '[BillingCycleOrchestrator] Billing run done',
        {
          generated: run.generated,
          markedOverdue: run.markedOverdue,
          failed: run.failed.length
        }
      );
      for (const failure of run.failed) {
        this.logger.warn(
          '[BillingCycleOrchestrator] Not billed',
          failure
        );
      }
    } catch (error) {
      this.logger.error(
        '[BillingCycleOrchestrator] Unexpected error',
        error as Error
      );
    }
  }
}
