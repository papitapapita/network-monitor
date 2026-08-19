// Source: src/application/notifications/use-cases/PurgeOldAlertsUseCase.ts

import { PurgeOldAlertsUseCase } from '../../../../src/application/notifications/use-cases/PurgeOldAlertsUseCase';
import { IAlertRepository } from '../../../../src/domain/notifications/repository/IAlertRepository';
import { Result } from '../../../../src/domain/shared/core/Result';

// ---------------------------------------------------------------------------
// Constants
// ---------------------------------------------------------------------------

const FIXED_TIMESTAMP = 1_717_200_000_000; // 2024-06-01T00:00:00.000Z

// ---------------------------------------------------------------------------
// Factories
// ---------------------------------------------------------------------------

function makeRepo(): jest.Mocked<IAlertRepository> {
  return {
    save: jest.fn(),
    findById: jest.fn(),
    findOpenByDeviceAndType: jest.fn(),
    findAllOpenByDeviceId: jest.fn(),
    findAllByDeviceId: jest.fn(),
    findAll: jest.fn(),
    deleteById: jest.fn(),
    deleteResolvedOlderThan: jest.fn()
  };
}

// ---------------------------------------------------------------------------

describe('PurgeOldAlertsUseCase', () => {
  let repo: jest.Mocked<IAlertRepository>;
  let useCase: PurgeOldAlertsUseCase;
  let dateSpy: jest.SpyInstance;

  beforeEach(() => {
    repo = makeRepo();
    useCase = new PurgeOldAlertsUseCase(repo);
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
      it('should call deleteResolvedOlderThan with the cutoff date computed from retentionDays', async () => {
        const retentionDays = 30;
        const expectedCutoff = new Date(
          FIXED_TIMESTAMP - retentionDays * 86_400_000
        );
        repo.deleteResolvedOlderThan.mockResolvedValue(Result.ok(5));

        await useCase.execute(retentionDays);

        expect(repo.deleteResolvedOlderThan).toHaveBeenCalledWith(
          expectedCutoff
        );
      });

      it('should call deleteResolvedOlderThan exactly once', async () => {
        repo.deleteResolvedOlderThan.mockResolvedValue(Result.ok(0));

        await useCase.execute(7);

        expect(repo.deleteResolvedOlderThan).toHaveBeenCalledTimes(1);
      });

      it('should return the Result returned by the repository', async () => {
        repo.deleteResolvedOlderThan.mockResolvedValue(Result.ok(8));

        const result = await useCase.execute(14);

        expect(result.isSuccess).toBe(true);
        expect(result.value).toBe(8);
      });

      it('should return a count of 0 when no resolved alerts are older than the cutoff', async () => {
        repo.deleteResolvedOlderThan.mockResolvedValue(Result.ok(0));

        const result = await useCase.execute(90);

        expect(result.isSuccess).toBe(true);
        expect(result.value).toBe(0);
      });

      it('should compute the correct cutoff for a 1-day retention window', async () => {
        const expectedCutoff = new Date(FIXED_TIMESTAMP - 86_400_000);
        repo.deleteResolvedOlderThan.mockResolvedValue(Result.ok(2));

        await useCase.execute(1);

        expect(repo.deleteResolvedOlderThan).toHaveBeenCalledWith(
          expectedCutoff
        );
      });

      it('should compute the correct cutoff for a 365-day retention window', async () => {
        const expectedCutoff = new Date(
          FIXED_TIMESTAMP - 365 * 86_400_000
        );
        repo.deleteResolvedOlderThan.mockResolvedValue(Result.ok(50));

        await useCase.execute(365);

        expect(repo.deleteResolvedOlderThan).toHaveBeenCalledWith(
          expectedCutoff
        );
      });
    });

    // -----------------------------------------------------------------------
    describe('failure path', () => {
      it('should propagate the failure Result from the repository', async () => {
        repo.deleteResolvedOlderThan.mockResolvedValue(
          Result.fail('DB write error')
        );

        const result = await useCase.execute(30);

        expect(result.isFailure).toBe(true);
        expect(result.error).toBe('DB write error');
      });

      it('should not swallow a rejection thrown by the repository', async () => {
        repo.deleteResolvedOlderThan.mockRejectedValue(
          new Error('connection refused')
        );

        await expect(useCase.execute(30)).rejects.toThrow(
          'connection refused'
        );
      });
    });
  });
});
