import { RunScheduledBackupsUseCase } from 'application/device-backups/use-cases';
import { ILogger } from 'application/shared/interfaces';

// Colombia is UTC-5 with no daylight saving.
const LOCAL_OFFSET_MS = -5 * 60 * 60 * 1000;
const RUN_FROM_LOCAL_HOUR = 3;

interface OrchestratorConfig {
  checkIntervalMs?: number;
}

// One backup run per local day, from 3:00 when the network is quiet (BKP-011).
// The day is remembered in memory only; a restart may start the run again,
// and the run itself skips devices backed up recently (BKP-012). A run that
// could not start is retried on the next check.
export class ConfigBackupOrchestrator {
  private readonly checkIntervalMs: number;
  private intervalId: ReturnType<typeof setInterval> | null = null;
  private lastHandledDay: string | null = null;
  private running = false;

  constructor(
    private readonly runScheduledBackups: RunScheduledBackupsUseCase,
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
    if (this.running) return;
    const now = this.clock();
    const local = new Date(now.getTime() + LOCAL_OFFSET_MS);
    const day = local.toISOString().slice(0, 10);
    if (day === this.lastHandledDay) return;
    if (local.getUTCHours() < RUN_FROM_LOCAL_HOUR) return;

    this.running = true;
    try {
      const result = await this.runScheduledBackups.execute({ now });
      if (result.isFailure) {
        this.logger.error(
          '[ConfigBackupOrchestrator] Backup run failed',
          new Error(result.error)
        );
        return;
      }
      this.lastHandledDay = day;
      const run = result.value;
      this.logger.info('[ConfigBackupOrchestrator] Backup run done', {
        saved: run.saved,
        unchanged: run.unchanged,
        skipped: run.skipped,
        failed: run.failed.length
      });
      for (const failure of run.failed) {
        this.logger.warn('[ConfigBackupOrchestrator] Not backed up', {
          ...failure
        });
      }
    } catch (error) {
      this.logger.error(
        '[ConfigBackupOrchestrator] Unexpected error',
        error as Error
      );
    } finally {
      this.running = false;
    }
  }
}
