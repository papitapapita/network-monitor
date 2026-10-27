import { SpeedTestResultId } from 'domain/shared/ids';
import { SpeedTestResult } from 'domain/device-monitoring/entities';
import { SpeedTestStatus } from 'domain/device-monitoring/props';

type PrismaSpeedTestResultRecord = {
  id: string;
  status: SpeedTestStatus;
  downloadMbps: number | null;
  uploadMbps: number | null;
  latencyMs: number | null;
  jitterMs: number | null;
  serverLocation: string | null;
  error: string | null;
  startedById: string | null;
  startedByEmail: string;
  startedAt: Date;
  finishedAt: Date;
};

export class SpeedTestResultMapper {
  public static toDomain(
    raw: PrismaSpeedTestResultRecord
  ): SpeedTestResult {
    const idResult = SpeedTestResultId.parse(raw.id);
    if (idResult.isFailure) {
      throw new Error(
        `Data integrity violation: invalid id "${raw.id}" in speed_test_results`
      );
    }

    return SpeedTestResult.reconstitute(idResult.value, {
      status: raw.status,
      downloadMbps: raw.downloadMbps,
      uploadMbps: raw.uploadMbps,
      latencyMs: raw.latencyMs,
      jitterMs: raw.jitterMs,
      serverLocation: raw.serverLocation,
      error: raw.error,
      startedById: raw.startedById,
      startedByEmail: raw.startedByEmail,
      startedAt: raw.startedAt,
      finishedAt: raw.finishedAt
    });
  }

  public static toPersistence(
    entity: SpeedTestResult
  ): PrismaSpeedTestResultRecord {
    return {
      id: entity.id.toString(),
      status: entity.status,
      downloadMbps: entity.downloadMbps,
      uploadMbps: entity.uploadMbps,
      latencyMs: entity.latencyMs,
      jitterMs: entity.jitterMs,
      serverLocation: entity.serverLocation,
      error: entity.error,
      startedById: entity.startedById,
      startedByEmail: entity.startedByEmail,
      startedAt: entity.startedAt,
      finishedAt: entity.finishedAt
    };
  }
}
