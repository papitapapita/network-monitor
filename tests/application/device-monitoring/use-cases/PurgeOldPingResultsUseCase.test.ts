// Source: src/application/device-monitoring/use-cases/PurgeOldPingResultsUseCase.ts

import { PurgeOldPingResultsUseCase } from '../../../../src/application/device-monitoring/use-cases/PurgeOldPingResultsUseCase';
import { IPingResultRepository } from '../../../../src/domain/device-monitoring/repository/IPingResultRepository';
import { Result } from '../../../../src/domain/shared/core/Result';

// ---------------------------------------------------------------------------
// Constants
// ---------------------------------------------------------------------------

const FIXED_TIMESTAMP = 1_717_200_000_000; // 2024-06-01T00:00:00.000Z

// ---------------------------------------------------------------------------
// Factories
// ---------------------------------------------------------------------------

function makeRepo(): jest.Mocked<IPingResultRepository> {
  return {
    save: jest.fn(),
    findLatestByDevice: jest.fn(),
    findByDevice: jest.fn(),
    deleteOlderThan: jest.fn()
  };
}

// ---------------------------------------------------------------------------

describe('PurgeOldPingResultsUseCase', () => {
  let repo: jest.Mocked<IPingResultRepository>;
  let useCase: PurgeOldPingResultsUseCase;
  let dateSpy: jest.SpyInstance;

  beforeEach(() => {
    repo = makeRepo();
    useCase = new PurgeOldPingResultsUseCase(repo);
    dateSpy = jest.spyOn(Date, 'now').mockReturnValue(FIXED_TIMESTAMP);
  });

  afterEach(() => {
    jest.clearAllMocks();
    dateSpy.mockRestore();
  });

  // =========================================================================
  describe('execute()', () => {
    // -----------------------------------------------------------------------
    describe('happy path', () => {
      it('[MON-040] should call deleteOlderThan with the cutoff date computed from retentionDays', async () => {
        const retentionDays = 30;
        const expectedCutoff = new Date(
          FIXED_TIMESTAMP - retentionDays * 86_400_000
        );
        repo.deleteOlderThan.mockResolvedValue(Result.ok(42));

        await useCase.execute(retentionDays);

        expect(repo.deleteOlderThan).toHaveBeenCalledWith(expectedCutoff);
      });

      it('should call deleteOlderThan exactly once', async () => {
        repo.deleteOlderThan.mockResolvedValue(Result.ok(0));

        await useCase.execute(7);

        expect(repo.deleteOlderThan).toHaveBeenCalledTimes(1);
      });

      it('should return the Result returned by the repository', async () => {
        repo.deleteOlderThan.mockResolvedValue(Result.ok(17));

        const result = await useCase.execute(14);

        expect(result.isSuccess).toBe(true);
        expect(result.value).toBe(17);
      });

      it('should return a count of 0 when no records are older than the cutoff', async () => {
        repo.deleteOlderThan.mockResolvedValue(Result.ok(0));

        const result = await useCase.execute(90);

        expect(result.isSuccess).toBe(true);
        expect(result.value).toBe(0);
      });

      it('should compute the correct cutoff for a 1-day retention window', async () => {
        const expectedCutoff = new Date(FIXED_TIMESTAMP - 86_400_000);
        repo.deleteOlderThan.mockResolvedValue(Result.ok(1));

        await useCase.execute(1);

        expect(repo.deleteOlderThan).toHaveBeenCalledWith(expectedCutoff);
      });

      it('should compute the correct cutoff for a 365-day retention window', async () => {
        const expectedCutoff = new Date(
          FIXED_TIMESTAMP - 365 * 86_400_000
        );
        repo.deleteOlderThan.mockResolvedValue(Result.ok(100));

        await useCase.execute(365);

        expect(repo.deleteOlderThan).toHaveBeenCalledWith(expectedCutoff);
      });
    });

    // -----------------------------------------------------------------------
    describe('failure path', () => {
      it('should propagate the failure Result from the repository', async () => {
        repo.deleteOlderThan.mockResolvedValue(
          Result.fail('DB connection lost')
        );

        const result = await useCase.execute(30);

        expect(result.isFailure).toBe(true);
        expect(result.error).toBe('DB connection lost');
      });

      it('should not swallow a rejection thrown by the repository', async () => {
        repo.deleteOlderThan.mockRejectedValue(new Error('unexpected'));

        await expect(useCase.execute(30)).rejects.toThrow('unexpected');
      });
    });
  });
});
