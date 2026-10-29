import { RunScheduledDiscoveryUseCase } from 'application/device-inventory/use-cases';
import { ILogger } from 'application/shared/interfaces';

interface OrchestratorConfig {
  checkIntervalMs?: number;
}

// Checks often and lets the use case decide whether the interval has passed
// (DEV-211), so a settings change is picked up within one check.
export class DiscoveryScanOrchestrator {
  private readonly checkIntervalMs: number;
  private intervalId: ReturnType<typeof setInterval> | null = null;
  private running = false;

  constructor(
    private readonly runScheduledDiscovery: RunScheduledDiscoveryUseCase,
    config: OrchestratorConfig = {},
    private readonly logger: ILogger,
    private readonly clock: () => Date = () => new Date()
  ) {
    this.checkIntervalMs = config.checkIntervalMs ?? 5 * 60_000;
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
    this.running = true;
    try {
      const result = await this.runScheduledDiscovery.execute({
        now: this.clock()
      });
      if (result.isFailure) {
        this.logger.error(
          '[DiscoveryScanOrchestrator] Scheduled scan failed',
          new Error(result.error)
        );
        return;
      }
      if (!result.value.ran) return;
      for (const segment of result.value.segments) {
        if (segment.error === null) {
          this.logger.info(
            '[DiscoveryScanOrchestrator] Segment scanned',
            {
              ...segment
            }
          );
        } else {
          this.logger.warn(
            '[DiscoveryScanOrchestrator] Segment not scanned',
            { ...segment }
          );
        }
      }
      for (const router of result.value.routers) {
        if (router.error === null) {
          this.logger.info(
            '[DiscoveryScanOrchestrator] Router neighbours read',
            { ...router }
          );
        } else {
          this.logger.warn(
            '[DiscoveryScanOrchestrator] Router neighbours not read',
            { ...router }
          );
        }
      }
    } catch (error) {
      this.logger.error(
        '[DiscoveryScanOrchestrator] Unexpected error',
        error as Error
      );
    } finally {
      this.running = false;
    }
  }
}
