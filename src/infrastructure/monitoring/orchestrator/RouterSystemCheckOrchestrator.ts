import { CheckRouterSystemsUseCase } from 'application/device-monitoring/use-cases';
import { ILogger } from 'application/shared/interfaces';

interface OrchestratorConfig {
  checkIntervalMs?: number;
}

// MON-161: reads what every MikroTik says about itself on an interval.
export class RouterSystemCheckOrchestrator {
  private readonly checkIntervalMs: number;
  private intervalId: ReturnType<typeof setInterval> | null = null;
  private running = false;

  constructor(
    private readonly checkRouterSystems: CheckRouterSystemsUseCase,
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
      const result = await this.checkRouterSystems.execute({
        now: this.clock()
      });
      if (result.isFailure) {
        this.logger.error(
          '[RouterSystemCheckOrchestrator] Check failed',
          new Error(result.error)
        );
        return;
      }
      for (const failed of result.value.failed) {
        this.logger.warn(
          '[RouterSystemCheckOrchestrator] Router not read',
          { ...failed }
        );
      }
    } catch (error) {
      this.logger.error(
        '[RouterSystemCheckOrchestrator] Unexpected error',
        error as Error
      );
    } finally {
      this.running = false;
    }
  }
}

// Minutes between checks, from ROUTER_SYSTEM_CHECK_INTERVAL_MINUTES (1–1440,
// default 10). A value outside that stops the boot.
export function loadRouterSystemCheckIntervalMs(
  env: NodeJS.ProcessEnv
): number {
  const raw = env.ROUTER_SYSTEM_CHECK_INTERVAL_MINUTES?.trim();
  if (!raw) return 10 * 60_000;
  const minutes = Number(raw);
  if (!Number.isInteger(minutes) || minutes < 1 || minutes > 1440) {
    throw new Error(
      'ROUTER_SYSTEM_CHECK_INTERVAL_MINUTES must be a whole number from 1 to 1440'
    );
  }
  return minutes * 60_000;
}
