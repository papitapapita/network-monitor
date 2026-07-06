// Source: src/presentation/http/controllers/AdminController.ts

import { Request, Response } from 'express';
import { AdminController } from '../../../../src/presentation/http/controllers/AdminController';
import { TriggerDataRetentionUseCase } from '../../../../src/application/shared/use-cases/TriggerDataRetentionUseCase';
import { ILogger } from '../../../../src/application/shared/interfaces/ILogger';
import { Result } from '../../../../src/domain/shared/core/Result';
import { DataRetentionSummary } from '../../../../src/application/shared/use-cases/TriggerDataRetentionUseCase';

// ---------------------------------------------------------------------------
// Factories
// ---------------------------------------------------------------------------

function makeUseCase(): jest.Mocked<Pick<TriggerDataRetentionUseCase, 'execute'>> {
  return { execute: jest.fn() };
}

function makeLogger(): jest.Mocked<ILogger> {
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

const createMockResponse = () => {
  const jsonMock = jest.fn();
  const statusMock = jest.fn().mockReturnValue({ json: jsonMock });
  return {
    res: { status: statusMock, json: jsonMock } as unknown as Response,
    statusMock,
    jsonMock
  };
};

function makeSummary(
  overrides: Partial<DataRetentionSummary> = {}
): DataRetentionSummary {
  return {
    pingResultsDeleted: 10,
    alertsDeleted: 5,
    wirelessSnapshotsDeleted: 20,
    wirelessAlertRecordsDeleted: 3,
    ...overrides
  };
}

// ---------------------------------------------------------------------------

describe('AdminController', () => {
  let useCase: jest.Mocked<Pick<TriggerDataRetentionUseCase, 'execute'>>;
  let logger: jest.Mocked<ILogger>;
  let controller: AdminController;

  beforeEach(() => {
    useCase = makeUseCase();
    logger = makeLogger();
    controller = new AdminController(
      useCase as unknown as TriggerDataRetentionUseCase,
      logger
    );
  });

  afterEach(() => {
    jest.clearAllMocks();
  });

  // =========================================================================
  describe('purgeStaleData()', () => {
    const fakeReq = {} as Request;

    // -----------------------------------------------------------------------
    describe('happy path', () => {
      it('should respond with status 200 when the use case succeeds', async () => {
        const summary = makeSummary();
        useCase.execute.mockResolvedValue(Result.ok(summary));
        const { res, statusMock } = createMockResponse();

        await controller.purgeStaleData(fakeReq, res);

        expect(statusMock).toHaveBeenCalledWith(200);
      });

      it('should include success: true in the response body', async () => {
        const summary = makeSummary();
        useCase.execute.mockResolvedValue(Result.ok(summary));
        const { res, statusMock, jsonMock } = createMockResponse();

        await controller.purgeStaleData(fakeReq, res);

        expect(statusMock).toHaveBeenCalledWith(200);
        expect(jsonMock).toHaveBeenCalledWith(
          expect.objectContaining({ success: true })
        );
      });

      it('should include the summary as data in the response body', async () => {
        const summary = makeSummary();
        useCase.execute.mockResolvedValue(Result.ok(summary));
        const { res, statusMock, jsonMock } = createMockResponse();

        await controller.purgeStaleData(fakeReq, res);

        expect(statusMock).toHaveBeenCalledWith(200);
        expect(jsonMock).toHaveBeenCalledWith({ success: true, data: summary });
      });

      it('should not call logger.error on a successful run', async () => {
        useCase.execute.mockResolvedValue(Result.ok(makeSummary()));
        const { res } = createMockResponse();

        await controller.purgeStaleData(fakeReq, res);

        expect(logger.error).not.toHaveBeenCalled();
      });
    });

    // -----------------------------------------------------------------------
    describe('failure path — use case returns a failed Result', () => {
      it('should respond with status 500 when the use case returns a failure', async () => {
        useCase.execute.mockResolvedValue(Result.fail('purge error'));
        const { res, statusMock } = createMockResponse();

        await controller.purgeStaleData(fakeReq, res);

        expect(statusMock).toHaveBeenCalledWith(500);
      });

      it('should include success: false in the response body', async () => {
        useCase.execute.mockResolvedValue(Result.fail('purge error'));
        const { res, statusMock, jsonMock } = createMockResponse();

        await controller.purgeStaleData(fakeReq, res);

        expect(statusMock).toHaveBeenCalledWith(500);
        expect(jsonMock).toHaveBeenCalledWith(
          expect.objectContaining({ success: false })
        );
      });

      it('should include the use-case error message in the response body', async () => {
        useCase.execute.mockResolvedValue(
          Result.fail('Ping results purge failed: DB timeout')
        );
        const { res, statusMock, jsonMock } = createMockResponse();

        await controller.purgeStaleData(fakeReq, res);

        expect(statusMock).toHaveBeenCalledWith(500);
        expect(jsonMock).toHaveBeenCalledWith({
          success: false,
          error: 'Ping results purge failed: DB timeout'
        });
      });

      it('should call logger.error with the failure message', async () => {
        useCase.execute.mockResolvedValue(Result.fail('purge error'));
        const { res } = createMockResponse();

        await controller.purgeStaleData(fakeReq, res);

        expect(logger.error).toHaveBeenCalledTimes(1);
        expect(logger.error).toHaveBeenCalledWith(
          '[AdminController] Data retention purge failed',
          expect.any(Error)
        );
      });
    });

    // -----------------------------------------------------------------------
    describe('failure path — use case throws an unexpected exception', () => {
      it('should respond with status 500 when the use case throws', async () => {
        useCase.execute.mockRejectedValue(new Error('unexpected crash'));
        const { res, statusMock } = createMockResponse();

        await controller.purgeStaleData(fakeReq, res);

        expect(statusMock).toHaveBeenCalledWith(500);
      });

      it('should respond with the generic internal server error message', async () => {
        useCase.execute.mockRejectedValue(new Error('unexpected crash'));
        const { res, statusMock, jsonMock } = createMockResponse();

        await controller.purgeStaleData(fakeReq, res);

        expect(statusMock).toHaveBeenCalledWith(500);
        expect(jsonMock).toHaveBeenCalledWith({
          success: false,
          error: 'Internal server error'
        });
      });

      it('should call logger.error with the unexpected error message', async () => {
        useCase.execute.mockRejectedValue(new Error('unexpected crash'));
        const { res } = createMockResponse();

        await controller.purgeStaleData(fakeReq, res);

        expect(logger.error).toHaveBeenCalledTimes(1);
        expect(logger.error).toHaveBeenCalledWith(
          '[AdminController] Unexpected error during data retention purge',
          expect.any(Error)
        );
      });

      it('should not include internal error details in the response body', async () => {
        useCase.execute.mockRejectedValue(
          new Error('sensitive internal detail')
        );
        const { res, jsonMock } = createMockResponse();

        await controller.purgeStaleData(fakeReq, res);

        expect(jsonMock).not.toHaveBeenCalledWith(
          expect.objectContaining({ error: 'sensitive internal detail' })
        );
      });
    });
  });
});
