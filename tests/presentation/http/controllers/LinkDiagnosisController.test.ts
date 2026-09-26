// Source: src/presentation/http/controllers/LinkDiagnosisController.ts

import { Request, Response } from 'express';
import { LinkDiagnosisController } from '../../../../src/presentation/http/controllers/LinkDiagnosisController';
import { StartLinkDiagnosisUseCase } from '../../../../src/application/wireless-monitoring/use-cases/StartLinkDiagnosisUseCase';
import { GetLinkDiagnosisUseCase } from '../../../../src/application/wireless-monitoring/use-cases/GetLinkDiagnosisUseCase';
import { StopLinkDiagnosisUseCase } from '../../../../src/application/wireless-monitoring/use-cases/StopLinkDiagnosisUseCase';
import { TOO_MANY_DIAGNOSES } from '../../../../src/application/wireless-monitoring/interfaces/ILinkDiagnosisRunner';
import { ILogger } from '../../../../src/application/shared/interfaces/ILogger';
import { Result } from '../../../../src/domain/shared/core/Result';

const DEVICE_UUID = 'f47ac10b-58cc-4372-a567-0e02b2c3d479';

const createMockLogger = (): jest.Mocked<ILogger> => ({
  debug: jest.fn(),
  info: jest.fn(),
  warn: jest.fn(),
  error: jest.fn(),
  fatal: jest.fn(),
  child: jest.fn().mockReturnThis() as jest.Mocked<ILogger>['child'],
  setLevel: jest.fn()
});

const createMockRequest = (overrides: Partial<Request> = {}) =>
  ({
    body: {},
    params: { id: DEVICE_UUID },
    query: {},
    ...overrides
  }) as Request;

const createMockResponse = () => {
  const jsonMock = jest.fn();
  const statusMock = jest.fn().mockReturnValue({ json: jsonMock });
  return {
    res: {
      status: statusMock,
      json: jsonMock
    } as unknown as Response,
    statusMock,
    jsonMock
  };
};

describe('LinkDiagnosisController', () => {
  let start: { execute: jest.Mock };
  let get: { execute: jest.Mock };
  let stop: { execute: jest.Mock };
  let logger: jest.Mocked<ILogger>;
  let controller: LinkDiagnosisController;

  beforeEach(() => {
    start = { execute: jest.fn() };
    get = { execute: jest.fn() };
    stop = { execute: jest.fn() };
    logger = createMockLogger();
    controller = new LinkDiagnosisController(
      start as unknown as StartLinkDiagnosisUseCase,
      get as unknown as GetLinkDiagnosisUseCase,
      stop as unknown as StopLinkDiagnosisUseCase,
      logger
    );
  });

  describe('[WLS-180] start', () => {
    const diagnosis = { deviceId: DEVICE_UUID, status: 'RUNNING' };

    it('should return 201 when a new session starts', async () => {
      const { res, statusMock, jsonMock } = createMockResponse();
      start.execute.mockResolvedValue(
        Result.ok({ started: true, diagnosis })
      );

      await controller.start(
        createMockRequest({ body: { durationSeconds: 120 } }),
        res
      );

      expect(start.execute).toHaveBeenCalledWith({
        deviceId: DEVICE_UUID,
        durationSeconds: 120
      });
      expect(statusMock).toHaveBeenCalledWith(201);
      expect(jsonMock).toHaveBeenCalledWith({
        started: true,
        diagnosis
      });
    });

    it('should return 200 when the request joins a running session', async () => {
      const { res, statusMock } = createMockResponse();
      start.execute.mockResolvedValue(
        Result.ok({ started: false, diagnosis })
      );

      await controller.start(createMockRequest(), res);

      expect(statusMock).toHaveBeenCalledWith(200);
    });

    it('should tolerate a missing body and pass no duration', async () => {
      const { res } = createMockResponse();
      start.execute.mockResolvedValue(
        Result.ok({ started: true, diagnosis })
      );

      await controller.start(
        createMockRequest({ body: undefined }),
        res
      );

      expect(start.execute).toHaveBeenCalledWith({
        deviceId: DEVICE_UUID,
        durationSeconds: undefined
      });
    });

    it.each([
      [TOO_MANY_DIAGNOSES, 429],
      ['Cannot diagnose device — device is retired', 409],
      ['No wireless polling configuration found for device', 404],
      ['Device has no IP address configured', 400],
      ['Diagnosis duration must not exceed 300 seconds', 400],
      ['Credentials not configured for device', 400],
      ["Wireless polling is not supported for vendor 'x'", 400],
      ['Invalid device ID: bad', 400],
      ['Failed to load credentials: db down', 500]
    ])('should map "%s" to %i', async (error, status) => {
      const { res, statusMock, jsonMock } = createMockResponse();
      start.execute.mockResolvedValue(Result.fail(error));

      await controller.start(createMockRequest(), res);

      expect(statusMock).toHaveBeenCalledWith(status);
      expect(jsonMock).toHaveBeenCalledWith({ error });
    });

    it('should answer 500 without leaking the error when the use case throws', async () => {
      const { res, statusMock, jsonMock } = createMockResponse();
      start.execute.mockRejectedValue(new Error('boom'));

      await controller.start(createMockRequest(), res);

      expect(statusMock).toHaveBeenCalledWith(500);
      expect(jsonMock).toHaveBeenCalledWith({
        error: 'Internal server error'
      });
      expect(logger.error).toHaveBeenCalled();
    });
  });

  describe('[WLS-181] get / stop', () => {
    const diagnosis = { deviceId: DEVICE_UUID, status: 'STOPPED' };

    it('should return 200 with the session on GET', async () => {
      const { res, statusMock, jsonMock } = createMockResponse();
      get.execute.mockResolvedValue(Result.ok(diagnosis));

      await controller.get(createMockRequest(), res);

      expect(statusMock).toHaveBeenCalledWith(200);
      expect(jsonMock).toHaveBeenCalledWith(diagnosis);
    });

    it('should return 404 on GET when there is no session', async () => {
      const { res, statusMock } = createMockResponse();
      get.execute.mockResolvedValue(
        Result.fail('Diagnosis not found for device')
      );

      await controller.get(createMockRequest(), res);

      expect(statusMock).toHaveBeenCalledWith(404);
    });

    it('should return 200 with the final session on DELETE', async () => {
      const { res, statusMock, jsonMock } = createMockResponse();
      stop.execute.mockResolvedValue(Result.ok(diagnosis));

      await controller.stop(createMockRequest(), res);

      expect(stop.execute).toHaveBeenCalledWith({
        deviceId: DEVICE_UUID
      });
      expect(statusMock).toHaveBeenCalledWith(200);
      expect(jsonMock).toHaveBeenCalledWith(diagnosis);
    });

    it('should return 404 on DELETE when nothing is running', async () => {
      const { res, statusMock } = createMockResponse();
      stop.execute.mockResolvedValue(
        Result.fail('Running diagnosis not found for device')
      );

      await controller.stop(createMockRequest(), res);

      expect(statusMock).toHaveBeenCalledWith(404);
    });
  });
});
