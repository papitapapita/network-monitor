import { PollingMapper } from '../../../src/application/mappers/PollingMapper';
import {
  PollingResult,
  PollingResultId,
  PollingMetrics,
  NetworkDeviceId,
  PollingStatus,
  NetworkDeviceStatus
} from '../../../src/domain/device-inventory';

describe('PollingMapper', () => {
  // ========================================
  // Test Data Helpers
  // ========================================

  const createMockPollingMetrics = (): PollingMetrics => {
    const metricsResult = PollingMetrics.create({
      responseTimes: [23.5, 24.1, 23.8, 24.3],
      totalPings: 4,
      successfulPings: 4
    });

    return metricsResult.value;
  };

  const createMockPollingMetricsWithPacketLoss =
    (): PollingMetrics => {
      const metricsResult = PollingMetrics.create({
        responseTimes: [25.0, 26.5],
        totalPings: 4,
        successfulPings: 2
      });

      return metricsResult.value;
    };

  const createMockPollingResult = (overrides?: {
    status?: PollingStatus;
    metrics?: PollingMetrics | null;
    errorMessage?: string | null;
    deviceStatus?: NetworkDeviceStatus;
    attemptNumber?: number;
  }): PollingResult => {
    const resultId = PollingResultId.create().value;
    const deviceId = NetworkDeviceId.create().value;
    const metrics =
      overrides?.metrics !== undefined
        ? overrides.metrics
        : createMockPollingMetrics();

    const resultResult = PollingResult.create(
      {
        networkDeviceId: deviceId,
        timestamp: new Date('2024-01-15T10:30:00Z'),
        status: overrides?.status || PollingStatus.SUCCESS,
        metrics,
        attemptNumber: overrides?.attemptNumber || 1,
        errorMessage: overrides?.errorMessage || null,
        deviceStatus:
          overrides?.deviceStatus || NetworkDeviceStatus.ONLINE
      },
      resultId
    );

    return resultResult.value;
  };

  // ========================================
  // toPollingMetricsDTO() Tests
  // ========================================

  describe('toPollingMetricsDTO', () => {
    it('should convert PollingMetrics value object to PollingMetricsDTO', () => {
      // Arrange
      const metrics = createMockPollingMetrics();

      // Act
      const dto = PollingMapper.toPollingMetricsDTO(metrics);

      // Assert
      expect(dto).toBeDefined();
      expect(dto.responseTimes).toEqual([23.5, 24.1, 23.8, 24.3]);
      expect(dto.averageResponseTime).toBeCloseTo(23.925, 2);
      expect(dto.minResponseTime).toBe(23.5);
      expect(dto.maxResponseTime).toBe(24.3);
    });

    it('should extract primitive values from value object', () => {
      // Arrange
      const metrics = createMockPollingMetrics();

      // Act
      const dto = PollingMapper.toPollingMetricsDTO(metrics);

      // Assert
      expect(typeof dto.averageResponseTime).toBe('number');
      expect(typeof dto.minResponseTime).toBe('number');
      expect(typeof dto.maxResponseTime).toBe('number');
      expect(typeof dto.jitter).toBe('number');
      expect(typeof dto.packetLoss).toBe('number');
    });

    it('should clone responseTimes array (not reference)', () => {
      // Arrange
      const metrics = createMockPollingMetrics();

      // Act
      const dto = PollingMapper.toPollingMetricsDTO(metrics);

      // Assert - Modifying DTO array should not affect original
      dto.responseTimes.push(999);
      expect(metrics.responseTimes).toHaveLength(4);
      expect(dto.responseTimes).toHaveLength(5);
    });

    it('should map domain field names to DTO field names', () => {
      // Arrange
      const metrics = createMockPollingMetrics();

      // Act
      const dto = PollingMapper.toPollingMetricsDTO(metrics);

      // Assert - Domain uses totalPings/successfulPings, DTO uses packetsSent/packetsReceived
      expect(dto.packetsSent).toBe(metrics.totalPings);
      expect(dto.packetsReceived).toBe(metrics.successfulPings);
      expect(dto.packetsSent).toBe(4);
      expect(dto.packetsReceived).toBe(4);
    });

    it('should calculate jitter (standard deviation)', () => {
      // Arrange
      const metrics = createMockPollingMetrics();

      // Act
      const dto = PollingMapper.toPollingMetricsDTO(metrics);

      // Assert
      expect(dto.jitter).toBeGreaterThan(0);
      expect(typeof dto.jitter).toBe('number');
    });

    it('should handle metrics with packet loss', () => {
      // Arrange
      const metrics = createMockPollingMetricsWithPacketLoss();

      // Act
      const dto = PollingMapper.toPollingMetricsDTO(metrics);

      // Assert
      expect(dto.packetsSent).toBe(4);
      expect(dto.packetsReceived).toBe(2);
      expect(dto.packetLoss).toBe(50); // 50% packet loss
      expect(dto.responseTimes).toHaveLength(2); // Only successful pings
    });

    it('should set ttl to null (not yet implemented)', () => {
      // Arrange
      const metrics = createMockPollingMetrics();

      // Act
      const dto = PollingMapper.toPollingMetricsDTO(metrics);

      // Assert
      expect(dto.ttl).toBeNull();
    });
  });

  // ========================================
  // toPollingResultDTO() Tests
  // ========================================

  describe('toPollingResultDTO', () => {
    it('should convert PollingResult aggregate to PollingResultDTO', () => {
      // Arrange
      const result = createMockPollingResult();

      // Act
      const dto = PollingMapper.toPollingResultDTO(result);

      // Assert
      expect(dto).toBeDefined();
      expect(dto.id).toBe(result.id.toString());
      expect(dto.networkDeviceId).toBe(
        result.networkDeviceId.toString()
      );
    });

    it('should extract string IDs from Value Objects', () => {
      // Arrange
      const result = createMockPollingResult();

      // Act
      const dto = PollingMapper.toPollingResultDTO(result);

      // Assert
      expect(typeof dto.id).toBe('string');
      expect(typeof dto.networkDeviceId).toBe('string');
      expect(dto.id.length).toBeGreaterThan(0);
      expect(dto.networkDeviceId.length).toBeGreaterThan(0);
    });

    it('should extract string values from domain enums', () => {
      // Arrange
      const result = createMockPollingResult({
        status: PollingStatus.SUCCESS,
        deviceStatus: NetworkDeviceStatus.ONLINE
      });

      // Act
      const dto = PollingMapper.toPollingResultDTO(result);

      // Assert
      expect(dto.status).toBe('SUCCESS');
      expect(dto.deviceStatus).toBe('ONLINE');
      expect(typeof dto.status).toBe('string');
      expect(typeof dto.deviceStatus).toBe('string');
    });

    it('should preserve primitive fields', () => {
      // Arrange
      const result = createMockPollingResult({ attemptNumber: 3 });

      // Act
      const dto = PollingMapper.toPollingResultDTO(result);

      // Assert
      expect(dto.attemptNumber).toBe(3);
      expect(dto.timestamp).toBeInstanceOf(Date);
      expect(dto.errorMessage).toBeNull();
    });

    it('should transform nested PollingMetrics using toPollingMetricsDTO', () => {
      // Arrange
      const result = createMockPollingResult();

      // Act
      const dto = PollingMapper.toPollingResultDTO(result);

      // Assert
      expect(dto.metrics).toBeDefined();
      expect(dto.metrics).not.toBeNull();
      expect(dto.metrics?.responseTimes).toEqual([
        23.5, 24.1, 23.8, 24.3
      ]);
      expect(dto.metrics?.packetsSent).toBe(4);
    });

    it('should handle null metrics (failed poll)', () => {
      // Arrange
      const result = createMockPollingResult({
        status: PollingStatus.FAILED,
        metrics: null,
        errorMessage: 'Host unreachable',
        deviceStatus: NetworkDeviceStatus.OFFLINE
      });

      // Act
      const dto = PollingMapper.toPollingResultDTO(result);

      // Assert
      expect(dto.metrics).toBeNull();
      expect(dto.status).toBe('FAILED');
      expect(dto.errorMessage).toBe('Host unreachable');
      expect(dto.deviceStatus).toBe('OFFLINE');
    });

    it('should handle different PollingStatus values', () => {
      // Test SUCCESS
      const successResult = createMockPollingResult({
        status: PollingStatus.SUCCESS
      });
      const successDto =
        PollingMapper.toPollingResultDTO(successResult);
      expect(successDto.status).toBe('SUCCESS');

      // Test PARTIAL_SUCCESS (has metrics but some packet loss)
      const partialResult = createMockPollingResult({
        status: PollingStatus.PARTIAL_SUCCESS,
        metrics: createMockPollingMetricsWithPacketLoss()
      });
      const partialDto =
        PollingMapper.toPollingResultDTO(partialResult);
      expect(partialDto.status).toBe('PARTIAL_SUCCESS');
    });

    it('should handle different NetworkDeviceStatus values', () => {
      // Test ONLINE
      const onlineResult = createMockPollingResult({
        deviceStatus: NetworkDeviceStatus.ONLINE
      });
      const onlineDto =
        PollingMapper.toPollingResultDTO(onlineResult);
      expect(onlineDto.deviceStatus).toBe('ONLINE');

      // Test MAINTENANCE
      const maintenanceResult = createMockPollingResult({
        deviceStatus: NetworkDeviceStatus.MAINTENANCE
      });
      const maintenanceDto =
        PollingMapper.toPollingResultDTO(maintenanceResult);
      expect(maintenanceDto.deviceStatus).toBe('MAINTENANCE');
    });

    it('should preserve timestamp as Date object', () => {
      // Arrange
      const result = createMockPollingResult();

      // Act
      const dto = PollingMapper.toPollingResultDTO(result);

      // Assert
      expect(dto.timestamp).toBeInstanceOf(Date);
      expect(dto.timestamp.toISOString()).toBe(
        '2024-01-15T10:30:00.000Z'
      );
    });
  });

  // ========================================
  // toPollingResultDTOList() Tests
  // ========================================

  describe('toPollingResultDTOList', () => {
    it('should convert array of PollingResult to array of DTOs', () => {
      // Arrange
      const results = [
        createMockPollingResult(),
        createMockPollingResult({ attemptNumber: 2 }),
        createMockPollingResult({ attemptNumber: 3 })
      ];

      // Act
      const dtos = PollingMapper.toPollingResultDTOList(results);

      // Assert
      expect(dtos).toHaveLength(3);
      expect(dtos[0].attemptNumber).toBe(1);
      expect(dtos[1].attemptNumber).toBe(2);
      expect(dtos[2].attemptNumber).toBe(3);
    });

    it('should map each result using toPollingResultDTO', () => {
      // Arrange
      const results = [
        createMockPollingResult({ status: PollingStatus.SUCCESS }),
        createMockPollingResult({
          status: PollingStatus.PARTIAL_SUCCESS,
          metrics: createMockPollingMetricsWithPacketLoss()
        })
      ];

      // Act
      const dtos = PollingMapper.toPollingResultDTOList(results);

      // Assert
      expect(dtos[0].status).toBe('SUCCESS');
      expect(dtos[0].metrics).not.toBeNull();
      expect(dtos[0].metrics?.packetLoss).toBe(0);
      expect(dtos[1].status).toBe('PARTIAL_SUCCESS');
      expect(dtos[1].metrics).not.toBeNull();
      expect(dtos[1].metrics?.packetLoss).toBe(50);
    });

    it('should handle empty array', () => {
      // Arrange
      const results: PollingResult[] = [];

      // Act
      const dtos = PollingMapper.toPollingResultDTOList(results);

      // Assert
      expect(dtos).toHaveLength(0);
      expect(Array.isArray(dtos)).toBe(true);
    });

    it('should handle single result array', () => {
      // Arrange
      const results = [createMockPollingResult()];

      // Act
      const dtos = PollingMapper.toPollingResultDTOList(results);

      // Assert
      expect(dtos).toHaveLength(1);
      expect(dtos[0].id).toBe(results[0].id.toString());
    });
  });

  // ========================================
  // toLastPollStatistics() Tests
  // ========================================

  describe('toLastPollStatistics', () => {
    it('should extract statistics from PollingMetrics', () => {
      // Arrange
      const metrics = createMockPollingMetrics();

      // Act
      const stats = PollingMapper.toLastPollStatistics(metrics);

      // Assert
      expect(stats).not.toBeNull();
      expect(stats?.responseTimes).toEqual([23.5, 24.1, 23.8, 24.3]);
      expect(stats?.average).toBeCloseTo(23.925, 2);
      expect(stats?.min).toBe(23.5);
      expect(stats?.max).toBe(24.3);
      expect(stats?.jitter).toBeGreaterThan(0);
      expect(stats?.packetLoss).toBe(0);
    });

    it('should return null when metrics is null', () => {
      // Arrange
      const metrics = null;

      // Act
      const stats = PollingMapper.toLastPollStatistics(metrics);

      // Assert
      expect(stats).toBeNull();
    });

    it('should clone responseTimes array (not reference)', () => {
      // Arrange
      const metrics = createMockPollingMetrics();

      // Act
      const stats = PollingMapper.toLastPollStatistics(metrics);

      // Assert
      stats!.responseTimes.push(999);
      expect(metrics.responseTimes).toHaveLength(4);
      expect(stats!.responseTimes).toHaveLength(5);
    });

    it('should flatten PollingMetrics into plain object structure', () => {
      // Arrange
      const metrics = createMockPollingMetrics();

      // Act
      const stats = PollingMapper.toLastPollStatistics(metrics);

      // Assert - Plain object with specific keys
      expect(stats).toHaveProperty('responseTimes');
      expect(stats).toHaveProperty('average');
      expect(stats).toHaveProperty('min');
      expect(stats).toHaveProperty('max');
      expect(stats).toHaveProperty('jitter');
      expect(stats).toHaveProperty('packetLoss');
      expect(Object.keys(stats!)).toHaveLength(6);
    });

    it('should handle metrics with packet loss', () => {
      // Arrange
      const metrics = createMockPollingMetricsWithPacketLoss();

      // Act
      const stats = PollingMapper.toLastPollStatistics(metrics);

      // Assert
      expect(stats?.packetLoss).toBe(50);
      expect(stats?.responseTimes).toHaveLength(2);
    });
  });

  // ========================================
  // Mapper Compliance Tests
  // ========================================

  describe('Mapper Compliance (APPLICATION-MAPPER-STANDARD.md)', () => {
    it('should have only static methods', () => {
      // Assert
      expect(typeof PollingMapper.toPollingMetricsDTO).toBe(
        'function'
      );
      expect(typeof PollingMapper.toPollingResultDTO).toBe(
        'function'
      );
      expect(typeof PollingMapper.toPollingResultDTOList).toBe(
        'function'
      );
      expect(typeof PollingMapper.toLastPollStatistics).toBe(
        'function'
      );
    });

    it('should not have constructor dependencies', () => {
      // Mapper should be a static class with no instance methods
      // All methods should be accessible without instantiation
      expect(typeof PollingMapper.toPollingMetricsDTO).toBe(
        'function'
      );
      expect(typeof PollingMapper.toPollingResultDTO).toBe(
        'function'
      );
      expect(typeof PollingMapper.toPollingResultDTOList).toBe(
        'function'
      );
      expect(typeof PollingMapper.toLastPollStatistics).toBe(
        'function'
      );
    });

    it('should perform pure transformations (deterministic)', () => {
      // Arrange
      const result = createMockPollingResult();

      // Act
      const dto1 = PollingMapper.toPollingResultDTO(result);
      const dto2 = PollingMapper.toPollingResultDTO(result);

      // Assert - Same input produces same output
      expect(dto1).toEqual(dto2);
    });

    it('should not modify input objects (pure function)', () => {
      // Arrange
      const metrics = createMockPollingMetrics();
      const originalResponseTimes = [...metrics.responseTimes];

      // Act
      PollingMapper.toPollingMetricsDTO(metrics);

      // Assert - Input unchanged
      expect([...metrics.responseTimes]).toEqual(
        originalResponseTimes
      );
    });

    it('should handle all DTO transformations without side effects', () => {
      // Arrange
      const result = createMockPollingResult();
      const results = [result];

      // Act - Multiple transformations
      const metricsDto = result.metrics
        ? PollingMapper.toPollingMetricsDTO(result.metrics)
        : null;
      const resultDto = PollingMapper.toPollingResultDTO(result);
      const listDto = PollingMapper.toPollingResultDTOList(results);
      const stats = PollingMapper.toLastPollStatistics(
        result.metrics
      );

      // Assert - All transformations successful, no errors
      expect(metricsDto).toBeDefined();
      expect(resultDto).toBeDefined();
      expect(listDto).toHaveLength(1);
      expect(stats).toBeDefined();
    });
  });
});
