import { ILogger } from 'application/shared/interfaces';
import { GetSubscriptionStatusUseCase } from 'application/shared/use-cases/GetSubscriptionStatusUseCase';

export interface SupervisedJob {
  name: string;
  start(): void;
  stop(): void | Promise<void>;
}

// ADR 0002, R17: while the subscription is read-only or locked, nothing is
// measured and nothing runs in the background. Starts the jobs only when the
// subscription allows them and re-checks every minute, so a grace period that
// ends while the process is up stops them within a minute. A failure to read
// the status leaves the jobs as they are.
export class SubscriptionJobSupervisor {
  private readonly checkIntervalMs: number;
  private intervalId: ReturnType<typeof setInterval> | null = null;
  private jobsRunning = false;
  private checking: Promise<void> = Promise.resolve();

  constructor(
    private readonly jobs: SupervisedJob[],
    private readonly getSubscriptionStatus: GetSubscriptionStatusUseCase,
    private readonly logger: ILogger,
    config: { checkIntervalMs?: number } = {}
  ) {
    this.checkIntervalMs = config.checkIntervalMs ?? 60_000;
  }

  async start(): Promise<void> {
    if (this.intervalId) return;
    await this.check();
    this.intervalId = setInterval(
      () => void this.check(),
      this.checkIntervalMs
    );
  }

  async stop(): Promise<void> {
    if (this.intervalId) {
      clearInterval(this.intervalId);
      this.intervalId = null;
    }
    await this.checking;
    if (this.jobsRunning) await this.stopJobs();
  }

  areJobsRunning(): boolean {
    return this.jobsRunning;
  }

  // Serialised: a slow stop must finish before the next check decides.
  private check(): Promise<void> {
    this.checking = this.checking.then(() => this.reconcile());
    return this.checking;
  }

  private async reconcile(): Promise<void> {
    try {
      const status = await this.getSubscriptionStatus.execute();
      if (status.isFailure) {
        this.logger.warn(
          'Subscription status unavailable; jobs unchanged',
          {
            error: status.error
          }
        );
        if (!this.jobsRunning && this.intervalId === null)
          this.startJobs();
        return;
      }
      if (status.value.readOnly && this.jobsRunning) {
        this.logger.warn(
          'Subscription expired: stopping monitoring and background jobs',
          { state: status.value.state }
        );
        await this.stopJobs();
      } else if (!status.value.readOnly && !this.jobsRunning) {
        this.startJobs();
      }
    } catch (error) {
      this.logger.error(
        'SubscriptionJobSupervisor: unexpected error',
        error instanceof Error ? error : new Error(String(error))
      );
    }
  }

  private startJobs(): void {
    for (const job of this.jobs) job.start();
    this.jobsRunning = true;
  }

  private async stopJobs(): Promise<void> {
    for (const job of this.jobs) await job.stop();
    this.jobsRunning = false;
  }
}
