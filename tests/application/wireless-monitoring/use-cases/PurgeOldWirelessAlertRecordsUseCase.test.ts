// Source: src/application/wireless-monitoring/use-cases/PurgeOldWirelessAlertRecordsUseCase.ts

import { PurgeOldWirelessAlertRecordsUseCase } from '../../../../src/application/wireless-monitoring/use-cases/PurgeOldWirelessAlertRecordsUseCase';
import { IWirelessAlertRecordRepository } from '../../../../src/domain/wireless-monitoring/repository/IWirelessAlertRecordRepository';
import { Result } from '../../../../src/domain/shared/core/Result';

// ---------------------------------------------------------------------------
// Constants
// ---------------------------------------------------------------------------

const FIXED_TIMESTAMP = 1_717_200_000_000; // 2024-06-01T00:00:00.000Z

// ---------------------------------------------------------------------------
// Factories
// ---------------------------------------------------------------------------

function makeRepo(): jest.Mocked<IWirelessAlertRecordRepository> {
  return {
    save: jest.fn(),
    findById: jest.fn(),
    exists: jest.fn(),
    findActiveByDeviceMetricAndSeverity: jest.fn(),
    findAllActiveByDevice: jest.fn(),
    findActiveUnnotifiedByDevice: jest.fn(),
    findAllActive: jest.fn(),
    findHistoryByDevice: jest.fn(),
    deleteClearedOlderThan: jest.fn()
  };
}

// ---------------------------------------------------------------------------

describe('[WLS-161] PurgeOldWirelessAlertRecordsUseCase', () => {
  let repo: jest.Mocked<IWirelessAlertRecordRepository>;
  let useCase: PurgeOldWirelessAlertRecordsUseCase;
  let dateSpy: jest.SpyInstance;

  beforeEach(() => {
    repo = makeRepo();
    useCase = new PurgeOldWirelessAlertRecordsUseCase(repo);
    dateSpy = jest
      .spyOn(Date, 'now')
      .mockReturnValue(FIXED_TIMESTAMP);
  });

  afterEach(() => {
    jest.clearAllMocks();
    dateSpy.mockRestore();
  });

  // =========================================================================
  describe('execute()', () => {
    // -----------------------------------------------------------------------
    describe('happy path', () => {
      it('should call deleteClearedOlderThan with the cutoff date computed from retentionDays', async () => {
        const retentionDays = 30;
        const expectedCutoff = new Date(
          FIXED_TIMESTAMP - retentionDays * 86_400_000
        );
        repo.deleteClearedOlderThan.mockResolvedValue(Result.ok(7));

        await useCase.execute(retentionDays);

        expect(repo.deleteClearedOlderThan).toHaveBeenCalledWith(
          expectedCutoff
        );
      });

      it('should call deleteClearedOlderThan exactly once', async () => {
        repo.deleteClearedOlderThan.mockResolvedValue(Result.ok(0));

        await useCase.execute(7);

        expect(repo.deleteClearedOlderThan).toHaveBeenCalledTimes(1);
      });

      it('should return the Result returned by the repository', async () => {
        repo.deleteClearedOlderThan.mockResolvedValue(Result.ok(22));

        const result = await useCase.execute(14);

        expect(result.isSuccess).toBe(true);
        expect(result.value).toBe(22);
      });

      it('should return a count of 0 when no cleared alert records are older than the cutoff', async () => {
        repo.deleteClearedOlderThan.mockResolvedValue(Result.ok(0));

        const result = await useCase.execute(90);

        expect(result.isSuccess).toBe(true);
        expect(result.value).toBe(0);
      });

      it('should compute the correct cutoff for a 1-day retention window', async () => {
        const expectedCutoff = new Date(FIXED_TIMESTAMP - 86_400_000);
        repo.deleteClearedOlderThan.mockResolvedValue(Result.ok(1));

        await useCase.execute(1);

        expect(repo.deleteClearedOlderThan).toHaveBeenCalledWith(
          expectedCutoff
        );
      });

      it('should compute the correct cutoff for a 365-day retention window', async () => {
        const expectedCutoff = new Date(
          FIXED_TIMESTAMP - 365 * 86_400_000
        );
        repo.deleteClearedOlderThan.mockResolvedValue(Result.ok(88));

        await useCase.execute(365);

        expect(repo.deleteClearedOlderThan).toHaveBeenCalledWith(
          expectedCutoff
        );
      });
    });

    // -----------------------------------------------------------------------
    describe('failure path', () => {
      it('should propagate the failure Result from the repository', async () => {
        repo.deleteClearedOlderThan.mockResolvedValue(
          Result.fail('alert record table unavailable')
        );

        const result = await useCase.execute(30);

        expect(result.isFailure).toBe(true);
        expect(result.error).toBe('alert record table unavailable');
      });

      it('should not swallow a rejection thrown by the repository', async () => {
        repo.deleteClearedOlderThan.mockRejectedValue(
          new Error('transaction rolled back')
        );

        await expect(useCase.execute(30)).rejects.toThrow(
          'transaction rolled back'
        );
      });
    });
  });
});
