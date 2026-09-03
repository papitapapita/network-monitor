// Source: src/application/device-monitoring/use-cases/GetDevicePollingHistoryUseCase.ts

import { GetDevicePollingHistoryUseCase } from '../../../../src/application/device-monitoring/use-cases/GetDevicePollingHistoryUseCase';
import {
  IPingResultRepository,
  PingResultRecord
} from '../../../../src/domain/device-monitoring/repository/IPingResultRepository';
import { ILogger } from '../../../../src/application/shared/interfaces/ILogger';
import { Result } from '../../../../src/domain/shared/core/Result';
import { DeviceId } from '../../../../src/domain/shared/ids/DeviceId';
import { GetDevicePollingHistoryDTO } from '../../../../src/application/device-monitoring/dtos/GetDevicePollingHistoryDTO';

// ---------------------------------------------------------------------------
// Constants
// ---------------------------------------------------------------------------

const VALID_DEVICE_UUID = '550e8400-e29b-41d4-a716-446655440001';
const FIXED_DATE = new Date('2024-06-01T10:00:00.000Z');

// ---------------------------------------------------------------------------
// Stub factories
// ---------------------------------------------------------------------------

function makeLogger(): ILogger {
  return {
    debug: jest.fn(),
    info: jest.fn(),
    warn: jest.fn(),
    error: jest.fn(),
    fatal: jest.fn(),
    child: jest.fn().mockReturnThis(),
    setLevel: jest.fn()
  };
}

function makePingResultRepo(): jest.Mocked<IPingResultRepository> {
  return {
    save: jest.fn(),
    findLatestByDevice: jest.fn(),
    findByDevice: jest.fn(),
    deleteOlderThan: jest.fn(),

    deleteByDevice: jest.fn()
  };
}

function makePingRecord(
  overrides: Partial<PingResultRecord> = {}
): PingResultRecord {
  return {
    id: 'ping-id-1',
    deviceId: DeviceId.parse(VALID_DEVICE_UUID).value,
    isReachable: true,
    latencyMs: 12,
    checkedAt: FIXED_DATE,
    ...overrides
  };
}

function makeRequest(
  overrides: Partial<GetDevicePollingHistoryDTO> = {}
): GetDevicePollingHistoryDTO {
  return {
    deviceId: VALID_DEVICE_UUID,
    ...overrides
  };
}

// ---------------------------------------------------------------------------

describe('GetDevicePollingHistoryUseCase', () => {
  let pingResultRepo: jest.Mocked<IPingResultRepository>;
  let logger: ILogger;
  let useCase: GetDevicePollingHistoryUseCase;

  beforeEach(() => {
    pingResultRepo = makePingResultRepo();
    logger = makeLogger();
    useCase = new GetDevicePollingHistoryUseCase(
      pingResultRepo,
      logger
    );
  });

  afterEach(() => {
    jest.clearAllMocks();
  });

  // ===========================================================================
  describe('beforeExecute — input validation', () => {
    it('should fail when deviceId is an empty string', async () => {
      const result = await useCase.execute(
        makeRequest({ deviceId: '' })
      );

      expect(result.isFailure).toBe(true);
      expect(result.error).toContain('Network device ID is required');
    });

    it('should fail when deviceId is whitespace only', async () => {
      const result = await useCase.execute(
        makeRequest({ deviceId: '  ' })
      );

      expect(result.isFailure).toBe(true);
    });

    it('should fail when limit is 0', async () => {
      const result = await useCase.execute(makeRequest({ limit: 0 }));

      expect(result.isFailure).toBe(true);
      expect(result.error).toContain('Limit must be between');
    });

    it('should fail when limit exceeds 1000', async () => {
      const result = await useCase.execute(
        makeRequest({ limit: 1001 })
      );

      expect(result.isFailure).toBe(true);
      expect(result.error).toContain('Limit must be between');
    });

    it('should accept limit equal to 1 — minimum boundary', async () => {
      pingResultRepo.findByDevice.mockResolvedValue(
        Result.ok({ records: [], total: 0 })
      );

      const result = await useCase.execute(makeRequest({ limit: 1 }));

      expect(result.isSuccess).toBe(true);
    });

    it('should accept limit equal to 1000 — maximum boundary', async () => {
      pingResultRepo.findByDevice.mockResolvedValue(
        Result.ok({ records: [], total: 0 })
      );

      const result = await useCase.execute(
        makeRequest({ limit: 1000 })
      );

      expect(result.isSuccess).toBe(true);
    });

    it('should fail when offset is negative', async () => {
      const result = await useCase.execute(
        makeRequest({ offset: -1 })
      );

      expect(result.isFailure).toBe(true);
      expect(result.error).toContain('Offset must be >= 0');
    });

    it('should accept offset of 0', async () => {
      pingResultRepo.findByDevice.mockResolvedValue(
        Result.ok({ records: [], total: 0 })
      );

      const result = await useCase.execute(
        makeRequest({ offset: 0 })
      );

      expect(result.isSuccess).toBe(true);
    });

    it('should fail when fromDate is after toDate', async () => {
      const result = await useCase.execute(
        makeRequest({
          fromDate: new Date('2024-06-10T00:00:00.000Z'),
          toDate: new Date('2024-06-01T00:00:00.000Z')
        })
      );

      expect(result.isFailure).toBe(true);
      expect(result.error).toContain(
        'fromDate must be before toDate'
      );
    });

    it('should succeed when fromDate equals toDate', async () => {
      pingResultRepo.findByDevice.mockResolvedValue(
        Result.ok({ records: [], total: 0 })
      );

      const sameDate = new Date('2024-06-01T00:00:00.000Z');
      const result = await useCase.execute(
        makeRequest({ fromDate: sameDate, toDate: sameDate })
      );

      expect(result.isSuccess).toBe(true);
    });
  });

  // ===========================================================================
  describe('executeImpl — device ID parsing', () => {
    it('should fail when deviceId is not a valid UUID', async () => {
      const result = await useCase.execute(
        makeRequest({ deviceId: 'not-a-uuid' })
      );

      expect(result.isFailure).toBe(true);
      expect(result.error).toContain('Invalid device ID');
    });
  });

  // ===========================================================================
  describe('executeImpl — repository interactions', () => {
    it('should fail when pingResultRepo returns a failure', async () => {
      pingResultRepo.findByDevice.mockResolvedValue(
        Result.fail('DB connection error')
      );

      const result = await useCase.execute(makeRequest());

      expect(result.isFailure).toBe(true);
      expect(result.error).toContain(
        'Failed to retrieve polling history'
      );
    });

    it('should call findByDevice with the parsed DeviceId', async () => {
      pingResultRepo.findByDevice.mockResolvedValue(
        Result.ok({ records: [], total: 0 })
      );

      await useCase.execute(makeRequest());

      expect(pingResultRepo.findByDevice).toHaveBeenCalledTimes(1);
      expect(
        pingResultRepo.findByDevice.mock.calls[0][0].toString()
      ).toBe(VALID_DEVICE_UUID);
    });

    it('should use default limit of 100 when limit is not provided', async () => {
      pingResultRepo.findByDevice.mockResolvedValue(
        Result.ok({ records: [], total: 0 })
      );

      await useCase.execute(makeRequest());

      const filters = pingResultRepo.findByDevice.mock.calls[0][1];
      expect(filters.limit).toBe(100);
    });

    it('should use default offset of 0 when offset is not provided', async () => {
      pingResultRepo.findByDevice.mockResolvedValue(
        Result.ok({ records: [], total: 0 })
      );

      await useCase.execute(makeRequest());

      const filters = pingResultRepo.findByDevice.mock.calls[0][1];
      expect(filters.offset).toBe(0);
    });

    it('should forward a custom limit to the repository', async () => {
      pingResultRepo.findByDevice.mockResolvedValue(
        Result.ok({ records: [], total: 0 })
      );

      await useCase.execute(makeRequest({ limit: 25 }));

      const filters = pingResultRepo.findByDevice.mock.calls[0][1];
      expect(filters.limit).toBe(25);
    });

    it('should forward a custom offset to the repository', async () => {
      pingResultRepo.findByDevice.mockResolvedValue(
        Result.ok({ records: [], total: 0 })
      );

      await useCase.execute(makeRequest({ offset: 50 }));

      const filters = pingResultRepo.findByDevice.mock.calls[0][1];
      expect(filters.offset).toBe(50);
    });

    it('should forward fromDate and toDate filters to the repository', async () => {
      pingResultRepo.findByDevice.mockResolvedValue(
        Result.ok({ records: [], total: 0 })
      );
      const from = new Date('2024-05-01T00:00:00.000Z');
      const to = new Date('2024-06-01T00:00:00.000Z');

      await useCase.execute(
        makeRequest({ fromDate: from, toDate: to })
      );

      const filters = pingResultRepo.findByDevice.mock.calls[0][1];
      expect(filters.fromDate).toEqual(from);
      expect(filters.toDate).toEqual(to);
    });

    it('[MON-042] should forward sortBy and sortOrder to the repository', async () => {
      pingResultRepo.findByDevice.mockResolvedValue(
        Result.ok({ records: [], total: 0 })
      );

      await useCase.execute(
        makeRequest({ sortBy: 'latencyMs', sortOrder: 'ASC' })
      );

      const filters = pingResultRepo.findByDevice.mock.calls[0][1];
      expect(filters.sortBy).toBe('latencyMs');
      expect(filters.sortOrder).toBe('ASC');
    });

    it('[MON-042] should leave sortBy/sortOrder undefined when not provided', async () => {
      pingResultRepo.findByDevice.mockResolvedValue(
        Result.ok({ records: [], total: 0 })
      );

      await useCase.execute(makeRequest());

      const filters = pingResultRepo.findByDevice.mock.calls[0][1];
      expect(filters.sortBy).toBeUndefined();
      expect(filters.sortOrder).toBeUndefined();
    });
  });

  // ===========================================================================
  describe('executeImpl — status filter resolution', () => {
    it('should set isReachable to true when status is ["SUCCESS"]', async () => {
      pingResultRepo.findByDevice.mockResolvedValue(
        Result.ok({ records: [], total: 0 })
      );

      await useCase.execute(makeRequest({ status: ['SUCCESS'] }));

      const filters = pingResultRepo.findByDevice.mock.calls[0][1];
      expect(filters.isReachable).toBe(true);
    });

    it('should set isReachable to false when status is ["FAILED"]', async () => {
      pingResultRepo.findByDevice.mockResolvedValue(
        Result.ok({ records: [], total: 0 })
      );

      await useCase.execute(makeRequest({ status: ['FAILED'] }));

      const filters = pingResultRepo.findByDevice.mock.calls[0][1];
      expect(filters.isReachable).toBe(false);
    });

    it('should set isReachable to undefined when status is ["SUCCESS", "FAILED"]', async () => {
      pingResultRepo.findByDevice.mockResolvedValue(
        Result.ok({ records: [], total: 0 })
      );

      await useCase.execute(
        makeRequest({ status: ['SUCCESS', 'FAILED'] })
      );

      const filters = pingResultRepo.findByDevice.mock.calls[0][1];
      expect(filters.isReachable).toBeUndefined();
    });

    it('should set isReachable to undefined when status includes UNKNOWN', async () => {
      pingResultRepo.findByDevice.mockResolvedValue(
        Result.ok({ records: [], total: 0 })
      );

      await useCase.execute(makeRequest({ status: ['UNKNOWN'] }));

      const filters = pingResultRepo.findByDevice.mock.calls[0][1];
      expect(filters.isReachable).toBeUndefined();
    });

    it('should set isReachable to undefined when status is empty array', async () => {
      pingResultRepo.findByDevice.mockResolvedValue(
        Result.ok({ records: [], total: 0 })
      );

      await useCase.execute(makeRequest({ status: [] }));

      const filters = pingResultRepo.findByDevice.mock.calls[0][1];
      expect(filters.isReachable).toBeUndefined();
    });

    it('should set isReachable to undefined when status is not provided', async () => {
      pingResultRepo.findByDevice.mockResolvedValue(
        Result.ok({ records: [], total: 0 })
      );

      await useCase.execute(makeRequest());

      const filters = pingResultRepo.findByDevice.mock.calls[0][1];
      expect(filters.isReachable).toBeUndefined();
    });
  });

  // ===========================================================================
  describe('executeImpl — response DTO shape', () => {
    it('should return a successful Result with a PollingHistoryDTO', async () => {
      pingResultRepo.findByDevice.mockResolvedValue(
        Result.ok({ records: [], total: 0 })
      );

      const result = await useCase.execute(makeRequest());

      expect(result.isSuccess).toBe(true);
    });

    it('should include the device ID in the returned DTO', async () => {
      pingResultRepo.findByDevice.mockResolvedValue(
        Result.ok({ records: [], total: 0 })
      );

      const result = await useCase.execute(makeRequest());

      expect(result.value.deviceId).toBe(VALID_DEVICE_UUID);
    });

    it('should include the totalCount from the repository page result', async () => {
      pingResultRepo.findByDevice.mockResolvedValue(
        Result.ok({ records: [makePingRecord()], total: 42 })
      );

      const result = await useCase.execute(makeRequest());

      expect(result.value.totalCount).toBe(42);
    });

    it('should return an empty results array when no records exist', async () => {
      pingResultRepo.findByDevice.mockResolvedValue(
        Result.ok({ records: [], total: 0 })
      );

      const result = await useCase.execute(makeRequest());

      expect(result.value.results).toHaveLength(0);
    });

    it('should map ping records to PollingResultDTOs in the results array', async () => {
      const record = makePingRecord({
        isReachable: true,
        latencyMs: 20
      });
      pingResultRepo.findByDevice.mockResolvedValue(
        Result.ok({ records: [record], total: 1 })
      );

      const result = await useCase.execute(makeRequest());

      expect(result.value.results).toHaveLength(1);
      expect(result.value.results[0].status).toBe('SUCCESS');
    });

    it('should include statistics in the returned DTO', async () => {
      pingResultRepo.findByDevice.mockResolvedValue(
        Result.ok({ records: [], total: 0 })
      );

      const result = await useCase.execute(makeRequest());

      expect(result.value.statistics).toBeDefined();
      expect(typeof result.value.statistics.successRate).toBe(
        'number'
      );
    });
  });
});
