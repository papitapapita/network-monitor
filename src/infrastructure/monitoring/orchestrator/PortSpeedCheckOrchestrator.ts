import { CheckPortSpeedsUseCase } from 'application/device-monitoring/use-cases';
import { ILogger } from 'application/shared/interfaces';

interface OrchestratorConfig {
  checkIntervalMs?: number;
}

// MON-147: reads every MikroTik with an expected port speed on an interval.
export class PortSpeedCheckOrchestrator {
  private readonly checkIntervalMs: number;
  private intervalId: ReturnType<typeof setInterval> | null = null;
  private running = false;

  constructor(
    private readonly checkPortSpeeds: CheckPortSpeedsUseCase,
    config: OrchestratorConfig = {},
    private readonly logger: ILogger,
    private readonly clock: () => Date = () => new Date()
  ) {
    this.checkIntervalMs = config.checkIntervalMs ?? 10 * 60_000;
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
      const result = await this.checkPortSpeeds.execute({
        now: this.clock()
      });
      if (result.isFailure) {
        this.logger.error(
          '[PortSpeedCheckOrchestrator] Check failed',
          new Error(result.error)
        );
        return;
      }
      for (const skipped of result.value.skipped) {
        this.logger.warn(
          '[PortSpeedCheckOrchestrator] Router not read',
          { ...skipped }
        );
      }
    } catch (error) {
      this.logger.error(
        '[PortSpeedCheckOrchestrator] Unexpected error',
        error as Error
      );
    } finally {
      this.running = false;
    }
  }
}

// Minutes between checks, from PORT_SPEED_CHECK_INTERVAL_MINUTES (1–1440,
// default 10). A value outside that stops the boot.
export function loadPortSpeedCheckIntervalMs(
  env: NodeJS.ProcessEnv
): number {
  const raw = env.PORT_SPEED_CHECK_INTERVAL_MINUTES?.trim();
  if (!raw) return 10 * 60_000;
  const minutes = Number(raw);
  if (!Number.isInteger(minutes) || minutes < 1 || minutes > 1440) {
    throw new Error(
      'PORT_SPEED_CHECK_INTERVAL_MINUTES must be a whole number from 1 to 1440'
    );
  }
  return minutes * 60_000;
}
