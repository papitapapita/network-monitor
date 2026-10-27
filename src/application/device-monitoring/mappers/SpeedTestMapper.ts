import { SpeedTestResult } from 'domain/device-monitoring/entities';
import { SpeedTestResultDTO } from '../dtos';

export class SpeedTestMapper {
  public static toDTO(result: SpeedTestResult): SpeedTestResultDTO {
    return {
      id: result.id.toString(),
      status: result.status,
      downloadMbps: result.downloadMbps,
      uploadMbps: result.uploadMbps,
      latencyMs: result.latencyMs,
      jitterMs: result.jitterMs,
      serverLocation: result.serverLocation,
      error: result.error,
      startedByEmail: result.startedByEmail,
      startedAt: result.startedAt.toISOString(),
      finishedAt: result.finishedAt.toISOString(),
      durationMs:
        result.finishedAt.getTime() - result.startedAt.getTime()
    };
  }
}
