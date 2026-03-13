import { Result } from '@/core/Result';
import { PollingResult, PollingResultId, NetworkDeviceId } from '@/domain/entities';
import {
  PollingStatus,
  PollingMetrics,
  NetworkDeviceStatus,
} from '@/domain/value-objects';
import { PollingResult as PrismaPollingResult } from '@/generated/prisma';

/**
 * Mapper between PollingResult domain entity and Prisma persistence model.
 *
 * Responsibilities:
 * - Convert domain entities to database records (toPersistence)
 * - Convert database records to domain entities (toDomain)
 * - Handle JSON serialization for complex value objects (PollingMetrics)
 * - Validate data integrity during conversion
 *
 * @example
 * ```typescript
 * // Domain to Persistence
 * const persistenceData = PollingResultMapper.toPersistence(pollingResult);
 * await prisma.pollingResult.create({ data: persistenceData });
 *
 * // Persistence to Domain
 * const rawResult = await prisma.pollingResult.findUnique({ where: { id } });
 * const domainResult = PollingResultMapper.toDomain(rawResult);
 * ```
 */
export class PollingResultMapper {
  /**
   * Converts a PollingResult domain entity to Prisma persistence format.
   */
  public static toPersistence(pollingResult: PollingResult): any {
    const metrics = pollingResult.metrics;

    return {
      id: pollingResult.id.toString(),
      networkDeviceId: pollingResult.networkDeviceId.toString(),
      timestamp: pollingResult.timestamp,
      status: pollingResult.status.value,
      attemptNumber: pollingResult.attemptNumber,
      deviceStatus: pollingResult.deviceStatus.value,
      errorMessage: pollingResult.errorMessage,

      // PollingMetrics fields (flattened for TimescaleDB)
      responseTimes: metrics?.responseTimes || [],
      averageResponseTime: metrics?.averageResponseTime || null,
      minResponseTime: metrics?.minResponseTime || null,
      maxResponseTime: metrics?.maxResponseTime || null,
      jitter: metrics?.jitter || null,
      packetsSent: metrics?.packetsSent || null,
      packetsReceived: metrics?.packetsReceived || null,
      packetLoss: metrics?.packetLoss || null,
      ttl: metrics?.ttl || null,

      // Backwards compatibility field
      responseTimeMs: metrics?.averageResponseTime || null,

      // Future SNMP fields (Sprint 2+)
      uptime: metrics?.uptime || null,
      temperature: metrics?.temperature || null,
      cpuUsage: metrics?.cpuUsage || null,
      memoryUsage: metrics?.memoryUsage || null,
      diskUsage: metrics?.diskUsage || null,
      interfaceStats: metrics?.interfaceStats || null,
      bandwidth: metrics?.bandwidth || null,
      errors: metrics?.errors || null,
      discards: metrics?.discards || null,
    };
  }

  /**
   * Converts a Prisma persistence record to PollingResult domain entity.
   */
  public static toDomain(raw: PrismaPollingResult): Result<PollingResult> {
    // Create value objects
    const networkDeviceId = NetworkDeviceId.create(raw.networkDeviceId);
    const statusResult = PollingStatus.create(raw.status);
    const deviceStatusResult = NetworkDeviceStatus.create(raw.deviceStatus);

    if (statusResult.isFailure) {
      return Result.fail<PollingResult>(
        `Invalid polling status: ${statusResult.getErrorValue()}`
      );
    }

    if (deviceStatusResult.isFailure) {
      return Result.fail<PollingResult>(
        `Invalid device status: ${deviceStatusResult.getErrorValue()}`
      );
    }

    // Reconstruct PollingMetrics if metrics data exists
    let metrics: PollingMetrics | null = null;
    if (
      raw.responseTimes &&
      raw.responseTimes.length > 0 &&
      raw.averageResponseTime !== null
    ) {
      const metricsResult = PollingMetrics.create({
        responseTimes: raw.responseTimes as number[],
        averageResponseTime: raw.averageResponseTime,
        minResponseTime: raw.minResponseTime || 0,
        maxResponseTime: raw.maxResponseTime || 0,
        jitter: raw.jitter || 0,
        packetsSent: raw.packetsSent || 0,
        packetsReceived: raw.packetsReceived || 0,
        packetLoss: raw.packetLoss || 0,
        ttl: raw.ttl || null,
        // Future SNMP fields
        uptime: raw.uptime || undefined,
        temperature: raw.temperature || undefined,
        cpuUsage: raw.cpuUsage || undefined,
        memoryUsage: raw.memoryUsage || undefined,
        diskUsage: raw.diskUsage || undefined,
        interfaceStats: raw.interfaceStats || undefined,
        bandwidth: raw.bandwidth || undefined,
        errors: raw.errors || undefined,
        discards: raw.discards || undefined,
      });

      if (metricsResult.isFailure) {
        return Result.fail<PollingResult>(
          `Invalid metrics: ${metricsResult.getErrorValue()}`
        );
      }

      metrics = metricsResult.getValue();
    }

    // Create PollingResult domain entity
    const pollingResultId = PollingResultId.create(raw.id);
    const pollingResultResult = PollingResult.create(
      {
        networkDeviceId,
        timestamp: raw.timestamp,
        status: statusResult.getValue(),
        metrics,
        attemptNumber: raw.attemptNumber,
        responseTimeMs: raw.responseTimeMs || null, // Backwards compatibility
        errorMessage: raw.errorMessage,
        deviceStatus: deviceStatusResult.getValue(),
      },
      pollingResultId
    );

    if (pollingResultResult.isFailure) {
      return Result.fail<PollingResult>(
        `Failed to create PollingResult: ${pollingResultResult.getErrorValue()}`
      );
    }

    return Result.ok<PollingResult>(pollingResultResult.getValue());
  }

  /**
   * Validates that a persistence record has all required fields.
   */
  private static validatePersistenceData(raw: any): Result<void> {
    if (!raw.id) {
      return Result.fail<void>('Missing id');
    }
    if (!raw.networkDeviceId) {
      return Result.fail<void>('Missing networkDeviceId');
    }
    if (!raw.timestamp) {
      return Result.fail<void>('Missing timestamp');
    }
    if (!raw.status) {
      return Result.fail<void>('Missing status');
    }
    if (!raw.deviceStatus) {
      return Result.fail<void>('Missing deviceStatus');
    }
    if (typeof raw.attemptNumber !== 'number') {
      return Result.fail<void>('Missing or invalid attemptNumber');
    }

    return Result.ok<void>();
  }
}
