import { SpeedTestPlanDTO, SpeedTestProgressDTO } from '../dtos';

export interface SpeedTestMeasurement {
  downloadMbps: number | null;
  uploadMbps: number | null;
  latencyMs: number | null;
  jitterMs: number | null;
  // the speed-test server's site, e.g. "BOG"
  serverLocation: string | null;
  // why the test stopped early; what it measured before stays set
  error: string | null;
}

// Measures this server's own internet connection (MON-100).
export interface IInternetSpeedTester {
  readonly plan: SpeedTestPlanDTO;
  // Resolves on failure too, with `error` set. Once the signal aborts, it
  // stops as soon as it can and what it returns is not used.
  measure(
    onProgress: (progress: SpeedTestProgressDTO) => void,
    signal: AbortSignal
  ): Promise<SpeedTestMeasurement>;
}
