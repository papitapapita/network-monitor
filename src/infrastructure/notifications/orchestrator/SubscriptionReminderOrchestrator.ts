import { SendSubscriptionReminderUseCase } from 'application/notifications/use-cases';
import { ILogger } from 'application/shared/interfaces';

// Colombia is UTC-5 with no daylight saving.
const LOCAL_OFFSET_MS = -5 * 60 * 60 * 1000;
const SEND_FROM_LOCAL_HOUR = 9;

interface OrchestratorConfig {
  checkIntervalMs?: number;
}

// One reminder attempt per local day, from 9:00. The day is remembered in
// memory only: a restart after 9:00 can repeat that day's reminder, which is
// cheaper than a table for it. A failed send is retried on the next check.
export class SubscriptionReminderOrchestrator {
  private readonly checkIntervalMs: number;
  private intervalId: ReturnType<typeof setInterval> | null = null;
  private lastHandledDay: string | null = null;

  constructor(
    private readonly sendSubscriptionReminderUseCase: SendSubscriptionReminderUseCase,
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
    const local = new Date(this.clock().getTime() + LOCAL_OFFSET_MS);
    const day = local.toISOString().slice(0, 10);
    if (day === this.lastHandledDay) return;
    if (local.getUTCHours() < SEND_FROM_LOCAL_HOUR) return;

    try {
      const result =
        await this.sendSubscriptionReminderUseCase.execute();
      if (result.isFailure) {
        this.logger.error(
          '[SubscriptionReminderOrchestrator] Reminder failed',
          new Error(result.error)
        );
        return;
      }
      this.lastHandledDay = day;
    } catch (error) {
      this.logger.error(
        '[SubscriptionReminderOrchestrator] Unexpected error',
        error as Error
      );
    }
  }
}
