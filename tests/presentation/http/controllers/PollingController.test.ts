// Source: src/presentation/http/controllers/PollingController.ts

import { Request, Response } from 'express';
import { PollingController } from '../../../../src/presentation/http/controllers/PollingController';
import { ExecutePollingCycleUseCase } from '../../../../src/application/device-monitoring/use-cases/ExecutePollingCycleUseCase';
import { GetDevicePollingStatusUseCase } from '../../../../src/application/device-monitoring/use-cases/GetDevicePollingStatusUseCase';
import { GetDevicePollingHistoryUseCase } from '../../../../src/application/device-monitoring/use-cases/GetDevicePollingHistoryUseCase';
import { ConfigureDevicePollingUseCase } from '../../../../src/application/device-monitoring/use-cases/ConfigureDevicePollingUseCase';
import { CreateDevicePollingUseCase } from '../../../../src/application/device-monitoring/use-cases/CreateDevicePollingUseCase';
import { ILogger } from '../../../../src/application/shared/interfaces/ILogger';
import { Result } from '../../../../src/domain/shared/core/Result';

// ---------------------------------------------------------------------------
// Mock factories
// ---------------------------------------------------------------------------

const createMockExecutePollingCycleUseCase = () =>
  ({ execute: jest.fn() }) as unknown as ExecutePollingCycleUseCase;

const createMockGetPollingStatusUseCase = () =>
  ({ execute: jest.fn() }) as unknown as GetDevicePollingStatusUseCase;

const createMockGetPollingHistoryUseCase = () =>
  ({ execute: jest.fn() }) as unknown as GetDevicePollingHistoryUseCase;

const createMockConfigurePollingUseCase = () =>
  ({ execute: jest.fn() }) as unknown as ConfigureDevicePollingUseCase;

const createMockCreatePollingUseCase = () =>
  ({ execute: jest.fn() }) as unknown as CreateDevicePollingUseCase;

const createMockLogger = (): jest.Mocked<ILogger> => ({
  info: jest.fn(),
  warn: jest.fn(),
  error: jest.fn(),
  debug: jest.fn(),
  fatal: jest.fn(),
  child: jest.fn().mockReturnThis() as jest.Mocked<ILogger>['child'],
  setLevel: jest.fn()
});

const createMockRequest = (
  overrides: Partial<Request> = {}
): Partial<Request> => ({
  body: {},
  params: {},
  query: {},
  ...overrides
});

const createMockResponse = (): {
  res: Partial<Response>;
  statusMock: jest.Mock;
  jsonMock: jest.Mock;
  sendMock: jest.Mock;
} => {
  const jsonMock = jest.fn();
  const sendMock = jest.fn();
  const statusMock = jest
    .fn()
    .mockReturnValue({ json: jsonMock, send: sendMock });
  return {
    res: { status: statusMock, json: jsonMock, send: sendMock },
    statusMock,
    jsonMock,
    sendMock
  };
};

// ---------------------------------------------------------------------------
// Shared fixtures
// ---------------------------------------------------------------------------

const DEVICE_UUID = 'f47ac10b-58cc-4372-a567-0e02b2c3d479';

const mockPollResult = {
  deviceId: DEVICE_UUID,
  status: 'SUCCESS',
  latencyMs: 12,
  polledAt: '2024-01-01T00:00:00.000Z'
};

const mockPollingStatusResult = {
  deviceId: DEVICE_UUID,
  isUp: true,
  lastPolledAt: '2024-01-01T00:00:00.000Z',
  consecutiveFailures: 0
};

const mockPollingHistoryResult = {
  items: [mockPollResult],
  total: 1
};

const mockPollingConfig = {
  deviceId: DEVICE_UUID,
  intervalSeconds: 60,
  failuresBeforeDown: 3,
  enabled: true
};

// ---------------------------------------------------------------------------

describe('PollingController', () => {
  let controller: PollingController;
  let mockExecutePollingCycleUseCase: ExecutePollingCycleUseCase;
  let mockGetPollingStatusUseCase: GetDevicePollingStatusUseCase;
  let mockGetPollingHistoryUseCase: GetDevicePollingHistoryUseCase;
  let mockConfigurePollingUseCase: ConfigureDevicePollingUseCase;
  let mockCreatePollingUseCase: CreateDevicePollingUseCase;
  let mockLogger: jest.Mocked<ILogger>;

  beforeEach(() => {
    mockExecutePollingCycleUseCase = createMockExecutePollingCycleUseCase();
    mockGetPollingStatusUseCase = createMockGetPollingStatusUseCase();
    mockGetPollingHistoryUseCase = createMockGetPollingHistoryUseCase();
    mockConfigurePollingUseCase = createMockConfigurePollingUseCase();
    mockCreatePollingUseCase = createMockCreatePollingUseCase();
    mockLogger = createMockLogger();

    controller = new PollingController(
      mockExecutePollingCycleUseCase,
      mockGetPollingStatusUseCase,
      mockGetPollingHistoryUseCase,
      mockConfigurePollingUseCase,
      mockCreatePollingUseCase,
      mockLogger
    );
  });

  afterEach(() => {
    jest.clearAllMocks();
  });

  // =========================================================================
  describe('poll (POST /api/devices/:id/poll)', () => {
    // -----------------------------------------------------------------------
    describe('Happy Path', () => {
      it('should return 200 with the poll result on a successful manual poll', async () => {
        const mockReq = createMockRequest({ params: { id: DEVICE_UUID } });
        const { res, statusMock, jsonMock } = createMockResponse();

        (mockExecutePollingCycleUseCase.execute as jest.Mock).mockResolvedValue(
          Result.ok(mockPollResult)
        );

        await controller.poll(mockReq as Request, res as Response);

        expect(statusMock).toHaveBeenCalledWith(200);
        expect(jsonMock).toHaveBeenCalledWith(mockPollResult);
      });

      it('should pass deviceId and forceExecution: true to the use case', async () => {
        const mockReq = createMockRequest({ params: { id: DEVICE_UUID } });
        const { res } = createMockResponse();

        (mockExecutePollingCycleUseCase.execute as jest.Mock).mockResolvedValue(
          Result.ok(mockPollResult)
        );

        await controller.poll(mockReq as Request, res as Response);

        expect(mockExecutePollingCycleUseCase.execute).toHaveBeenCalledWith({
          deviceId: DEVICE_UUID,
          forceExecution: true
        });
      });
    });

    // -----------------------------------------------------------------------
    describe('Error Path — 404 Not Found', () => {
      it('should return 404 when the use case fails with "not found"', async () => {
        const mockReq = createMockRequest({ params: { id: DEVICE_UUID } });
        const { res, statusMock, jsonMock } = createMockResponse();

        (mockExecutePollingCycleUseCase.execute as jest.Mock).mockResolvedValue(
          Result.fail(`Device not found: ${DEVICE_UUID}`)
        );

        await controller.poll(mockReq as Request, res as Response);

        expect(statusMock).toHaveBeenCalledWith(404);
        expect(jsonMock).toHaveBeenCalledWith({
          error: `Device not found: ${DEVICE_UUID}`
        });
      });

      it('should return 404 when the use case fails with "No polling configuration"', async () => {
        const mockReq = createMockRequest({ params: { id: DEVICE_UUID } });
        const { res, statusMock } = createMockResponse();

        (mockExecutePollingCycleUseCase.execute as jest.Mock).mockResolvedValue(
          Result.fail('No polling configuration found for device')
        );

        await controller.poll(mockReq as Request, res as Response);

        expect(statusMock).toHaveBeenCalledWith(404);
      });
    });

    // -----------------------------------------------------------------------
    describe('Error Path — 400 Bad Request', () => {
      it('should return 400 when the use case fails with a validation error', async () => {
        const mockReq = createMockRequest({ params: { id: 'bad-id' } });
        const { res, statusMock, jsonMock } = createMockResponse();

        (mockExecutePollingCycleUseCase.execute as jest.Mock).mockResolvedValue(
          Result.fail('Invalid device ID format')
        );

        await controller.poll(mockReq as Request, res as Response);

        expect(statusMock).toHaveBeenCalledWith(400);
        expect(jsonMock).toHaveBeenCalledWith({
          error: 'Invalid device ID format'
        });
      });
    });

    // -----------------------------------------------------------------------
    describe('Error Path — 500 Internal Server Error (use case Result failure)', () => {
      it('should return 500 when the use case fails with an unrecognised message', async () => {
        const mockReq = createMockRequest({ params: { id: DEVICE_UUID } });
        const { res, statusMock, jsonMock } = createMockResponse();

        (mockExecutePollingCycleUseCase.execute as jest.Mock).mockResolvedValue(
          Result.fail('Database connection refused')
        );

        await controller.poll(mockReq as Request, res as Response);

        expect(statusMock).toHaveBeenCalledWith(500);
        expect(jsonMock).toHaveBeenCalledWith({
          error: 'Database connection refused'
        });
      });
    });

    // -----------------------------------------------------------------------
    describe('Error Path — 500 Internal Server Error (unexpected thrown exception)', () => {
      it('should return 500 and log the error when the use case throws', async () => {
        const thrownError = new Error('Unexpected DB crash');
        const mockReq = createMockRequest({ params: { id: DEVICE_UUID } });
        const { res, statusMock, jsonMock } = createMockResponse();

        (mockExecutePollingCycleUseCase.execute as jest.Mock).mockRejectedValue(
          thrownError
        );

        await controller.poll(mockReq as Request, res as Response);

        expect(statusMock).toHaveBeenCalledWith(500);
        expect(jsonMock).toHaveBeenCalledWith({
          error: 'Internal server error'
        });
        expect(mockLogger.error).toHaveBeenCalledWith(
          'Unexpected error in PollingController',
          thrownError,
          { error: 'Unexpected DB crash' }
        );
      });

      it('should not leak sensitive error details in the response body', async () => {
        const sensitiveError = new Error('SELECT * FROM polling; -- injected');
        const mockReq = createMockRequest({ params: { id: DEVICE_UUID } });
        const { res, jsonMock } = createMockResponse();

        (mockExecutePollingCycleUseCase.execute as jest.Mock).mockRejectedValue(
          sensitiveError
        );

        await controller.poll(mockReq as Request, res as Response);

        expect(jsonMock).toHaveBeenCalledWith({ error: 'Internal server error' });
        expect(jsonMock).not.toHaveBeenCalledWith(
          expect.objectContaining({
            error: expect.stringContaining('SELECT')
          })
        );
      });

      it('should handle non-Error thrown values by converting them to strings', async () => {
        const mockReq = createMockRequest({ params: { id: DEVICE_UUID } });
        const { res, statusMock } = createMockResponse();

        (mockExecutePollingCycleUseCase.execute as jest.Mock).mockRejectedValue(
          'string exception'
        );

        await controller.poll(mockReq as Request, res as Response);

        expect(statusMock).toHaveBeenCalledWith(500);
        expect(mockLogger.error).toHaveBeenCalledWith(
          'Unexpected error in PollingController',
          'string exception',
          { error: 'string exception' }
        );
      });
    });
  });

  // =========================================================================
  describe('getStatus (GET /api/devices/:id/polling/status)', () => {
    // -----------------------------------------------------------------------
    describe('Happy Path', () => {
      it('should return 200 with the polling status on success', async () => {
        const mockReq = createMockRequest({ params: { id: DEVICE_UUID } });
        const { res, statusMock, jsonMock } = createMockResponse();

        (mockGetPollingStatusUseCase.execute as jest.Mock).mockResolvedValue(
          Result.ok(mockPollingStatusResult)
        );

        await controller.getStatus(mockReq as Request, res as Response);

        expect(statusMock).toHaveBeenCalledWith(200);
        expect(jsonMock).toHaveBeenCalledWith(mockPollingStatusResult);
      });

      it('should pass deviceId to the use case', async () => {
        const mockReq = createMockRequest({ params: { id: DEVICE_UUID } });
        const { res } = createMockResponse();

        (mockGetPollingStatusUseCase.execute as jest.Mock).mockResolvedValue(
          Result.ok(mockPollingStatusResult)
        );

        await controller.getStatus(mockReq as Request, res as Response);

        expect(mockGetPollingStatusUseCase.execute).toHaveBeenCalledWith({
          deviceId: DEVICE_UUID
        });
      });
    });

    // -----------------------------------------------------------------------
    describe('Error Path — 404 Not Found', () => {
      it('should return 404 when the use case fails with "not found"', async () => {
        const mockReq = createMockRequest({ params: { id: DEVICE_UUID } });
        const { res, statusMock, jsonMock } = createMockResponse();

        (mockGetPollingStatusUseCase.execute as jest.Mock).mockResolvedValue(
          Result.fail(`Device not found: ${DEVICE_UUID}`)
        );

        await controller.getStatus(mockReq as Request, res as Response);

        expect(statusMock).toHaveBeenCalledWith(404);
        expect(jsonMock).toHaveBeenCalledWith({
          error: `Device not found: ${DEVICE_UUID}`
        });
      });

      it('should return 404 when the use case fails with "No polling configuration"', async () => {
        const mockReq = createMockRequest({ params: { id: DEVICE_UUID } });
        const { res, statusMock } = createMockResponse();

        (mockGetPollingStatusUseCase.execute as jest.Mock).mockResolvedValue(
          Result.fail('No polling configuration exists for this device')
        );

        await controller.getStatus(mockReq as Request, res as Response);

        expect(statusMock).toHaveBeenCalledWith(404);
      });
    });

    // -----------------------------------------------------------------------
    describe('Error Path — 400 Bad Request', () => {
      it('should return 400 when the use case fails with a non-404 error', async () => {
        const mockReq = createMockRequest({ params: { id: 'bad-id' } });
        const { res, statusMock } = createMockResponse();

        (mockGetPollingStatusUseCase.execute as jest.Mock).mockResolvedValue(
          Result.fail('Invalid device ID format')
        );

        await controller.getStatus(mockReq as Request, res as Response);

        expect(statusMock).toHaveBeenCalledWith(400);
      });
    });

    // -----------------------------------------------------------------------
    describe('Error Path — 500 Internal Server Error (unexpected thrown exception)', () => {
      it('should return 500 and log the error when the use case throws', async () => {
        const thrownError = new Error('Connection pool exhausted');
        const mockReq = createMockRequest({ params: { id: DEVICE_UUID } });
        const { res, statusMock, jsonMock } = createMockResponse();

        (mockGetPollingStatusUseCase.execute as jest.Mock).mockRejectedValue(
          thrownError
        );

        await controller.getStatus(mockReq as Request, res as Response);

        expect(statusMock).toHaveBeenCalledWith(500);
        expect(jsonMock).toHaveBeenCalledWith({ error: 'Internal server error' });
        expect(mockLogger.error).toHaveBeenCalledWith(
          'Unexpected error in PollingController',
          thrownError,
          { error: 'Connection pool exhausted' }
        );
      });
    });
  });

  // =========================================================================
  describe('getHistory (GET /api/devices/:id/polling/history)', () => {
    // -----------------------------------------------------------------------
    describe('Happy Path', () => {
      it('should return 200 with historical polling records on success', async () => {
        const mockReq = createMockRequest({
          params: { id: DEVICE_UUID },
          query: {}
        });
        const { res, statusMock, jsonMock } = createMockResponse();

        (mockGetPollingHistoryUseCase.execute as jest.Mock).mockResolvedValue(
          Result.ok(mockPollingHistoryResult)
        );

        await controller.getHistory(mockReq as Request, res as Response);

        expect(statusMock).toHaveBeenCalledWith(200);
        expect(jsonMock).toHaveBeenCalledWith(mockPollingHistoryResult);
      });

      it('should pass deviceId to the use case', async () => {
        const mockReq = createMockRequest({
          params: { id: DEVICE_UUID },
          query: {}
        });
        const { res } = createMockResponse();

        (mockGetPollingHistoryUseCase.execute as jest.Mock).mockResolvedValue(
          Result.ok(mockPollingHistoryResult)
        );

        await controller.getHistory(mockReq as Request, res as Response);

        expect(mockGetPollingHistoryUseCase.execute).toHaveBeenCalledWith(
          expect.objectContaining({ deviceId: DEVICE_UUID })
        );
      });

      it('should convert limit and offset query strings to integers', async () => {
        const mockReq = createMockRequest({
          params: { id: DEVICE_UUID },
          query: { limit: '10', offset: '20' }
        });
        const { res } = createMockResponse();

        (mockGetPollingHistoryUseCase.execute as jest.Mock).mockResolvedValue(
          Result.ok(mockPollingHistoryResult)
        );

        await controller.getHistory(mockReq as Request, res as Response);

        expect(mockGetPollingHistoryUseCase.execute).toHaveBeenCalledWith(
          expect.objectContaining({ limit: 10, offset: 20 })
        );
      });

      it('should split a comma-separated status query param into an array', async () => {
        const mockReq = createMockRequest({
          params: { id: DEVICE_UUID },
          query: { status: 'SUCCESS,FAILED' }
        });
        const { res } = createMockResponse();

        (mockGetPollingHistoryUseCase.execute as jest.Mock).mockResolvedValue(
          Result.ok(mockPollingHistoryResult)
        );

        await controller.getHistory(mockReq as Request, res as Response);

        expect(mockGetPollingHistoryUseCase.execute).toHaveBeenCalledWith(
          expect.objectContaining({ status: ['SUCCESS', 'FAILED'] })
        );
      });

      it('should split a single-value status query param into a one-element array', async () => {
        const mockReq = createMockRequest({
          params: { id: DEVICE_UUID },
          query: { status: 'SUCCESS' }
        });
        const { res } = createMockResponse();

        (mockGetPollingHistoryUseCase.execute as jest.Mock).mockResolvedValue(
          Result.ok(mockPollingHistoryResult)
        );

        await controller.getHistory(mockReq as Request, res as Response);

        expect(mockGetPollingHistoryUseCase.execute).toHaveBeenCalledWith(
          expect.objectContaining({ status: ['SUCCESS'] })
        );
      });

      it('should pass undefined for status when absent from query', async () => {
        const mockReq = createMockRequest({
          params: { id: DEVICE_UUID },
          query: {}
        });
        const { res } = createMockResponse();

        (mockGetPollingHistoryUseCase.execute as jest.Mock).mockResolvedValue(
          Result.ok(mockPollingHistoryResult)
        );

        await controller.getHistory(mockReq as Request, res as Response);

        expect(mockGetPollingHistoryUseCase.execute).toHaveBeenCalledWith(
          expect.objectContaining({ status: undefined })
        );
      });

      it('should convert fromDate and toDate query strings to Date objects', async () => {
        const mockReq = createMockRequest({
          params: { id: DEVICE_UUID },
          query: {
            fromDate: '2024-01-01T00:00:00.000Z',
            toDate: '2024-01-31T23:59:59.999Z'
          }
        });
        const { res } = createMockResponse();

        (mockGetPollingHistoryUseCase.execute as jest.Mock).mockResolvedValue(
          Result.ok(mockPollingHistoryResult)
        );

        await controller.getHistory(mockReq as Request, res as Response);

        const call = (mockGetPollingHistoryUseCase.execute as jest.Mock).mock
          .calls[0][0];
        expect(call.fromDate).toBeInstanceOf(Date);
        expect(call.toDate).toBeInstanceOf(Date);
      });

      it('should pass undefined for fromDate and toDate when absent from query', async () => {
        const mockReq = createMockRequest({
          params: { id: DEVICE_UUID },
          query: {}
        });
        const { res } = createMockResponse();

        (mockGetPollingHistoryUseCase.execute as jest.Mock).mockResolvedValue(
          Result.ok(mockPollingHistoryResult)
        );

        await controller.getHistory(mockReq as Request, res as Response);

        expect(mockGetPollingHistoryUseCase.execute).toHaveBeenCalledWith(
          expect.objectContaining({ fromDate: undefined, toDate: undefined })
        );
      });
    });

    // -----------------------------------------------------------------------
    describe('Error Path — 400 Bad Request', () => {
      it('should return 400 when the use case fails', async () => {
        const mockReq = createMockRequest({
          params: { id: DEVICE_UUID },
          query: { status: 'INVALID_STATUS' }
        });
        const { res, statusMock, jsonMock } = createMockResponse();

        (mockGetPollingHistoryUseCase.execute as jest.Mock).mockResolvedValue(
          Result.fail('Invalid status value: INVALID_STATUS')
        );

        await controller.getHistory(mockReq as Request, res as Response);

        expect(statusMock).toHaveBeenCalledWith(400);
        expect(jsonMock).toHaveBeenCalledWith({
          error: 'Invalid status value: INVALID_STATUS'
        });
      });
    });

    // -----------------------------------------------------------------------
    describe('Error Path — 500 Internal Server Error (unexpected thrown exception)', () => {
      it('should return 500 and log the error when the use case throws', async () => {
        const thrownError = new Error('Unexpected error in history fetch');
        const mockReq = createMockRequest({
          params: { id: DEVICE_UUID },
          query: {}
        });
        const { res, statusMock, jsonMock } = createMockResponse();

        (mockGetPollingHistoryUseCase.execute as jest.Mock).mockRejectedValue(
          thrownError
        );

        await controller.getHistory(mockReq as Request, res as Response);

        expect(statusMock).toHaveBeenCalledWith(500);
        expect(jsonMock).toHaveBeenCalledWith({ error: 'Internal server error' });
        expect(mockLogger.error).toHaveBeenCalledWith(
          'Unexpected error in PollingController',
          thrownError,
          { error: 'Unexpected error in history fetch' }
        );
      });
    });
  });

  // =========================================================================
  describe('create (POST /api/devices/:id/polling)', () => {
    const validBody = {
      ipAddress: '192.168.1.10',
      intervalSeconds: 60,
      failuresBeforeDown: 3,
      enabled: true
    };

    // -----------------------------------------------------------------------
    describe('Happy Path', () => {
      it('should return 201 with the created polling config on success', async () => {
        const mockReq = createMockRequest({
          params: { id: DEVICE_UUID },
          body: validBody
        });
        const { res, statusMock, jsonMock } = createMockResponse();

        (mockCreatePollingUseCase.execute as jest.Mock).mockResolvedValue(
          Result.ok(mockPollingConfig)
        );

        await controller.create(mockReq as Request, res as Response);

        expect(statusMock).toHaveBeenCalledWith(201);
        expect(jsonMock).toHaveBeenCalledWith(mockPollingConfig);
      });

      it('should pass deviceId and all body fields to the use case', async () => {
        const mockReq = createMockRequest({
          params: { id: DEVICE_UUID },
          body: validBody
        });
        const { res } = createMockResponse();

        (mockCreatePollingUseCase.execute as jest.Mock).mockResolvedValue(
          Result.ok(mockPollingConfig)
        );

        await controller.create(mockReq as Request, res as Response);

        expect(mockCreatePollingUseCase.execute).toHaveBeenCalledWith({
          deviceId: DEVICE_UUID,
          ipAddress: '192.168.1.10',
          intervalSeconds: 60,
          failuresBeforeDown: 3,
          enabled: true
        });
      });
    });

    // -----------------------------------------------------------------------
    describe('Error Path — 404 Not Found', () => {
      it('should return 404 when the use case fails with "not found"', async () => {
        const mockReq = createMockRequest({
          params: { id: DEVICE_UUID },
          body: validBody
        });
        const { res, statusMock, jsonMock } = createMockResponse();

        (mockCreatePollingUseCase.execute as jest.Mock).mockResolvedValue(
          Result.fail(`Device not found: ${DEVICE_UUID}`)
        );

        await controller.create(mockReq as Request, res as Response);

        expect(statusMock).toHaveBeenCalledWith(404);
        expect(jsonMock).toHaveBeenCalledWith({
          error: `Device not found: ${DEVICE_UUID}`
        });
      });
    });

    // -----------------------------------------------------------------------
    describe('Error Path — 400 Bad Request', () => {
      it('should return 400 when the use case fails with a validation error', async () => {
        const mockReq = createMockRequest({
          params: { id: DEVICE_UUID },
          body: { ipAddress: 'not-an-ip' }
        });
        const { res, statusMock, jsonMock } = createMockResponse();

        (mockCreatePollingUseCase.execute as jest.Mock).mockResolvedValue(
          Result.fail('Invalid IP address: not-an-ip')
        );

        await controller.create(mockReq as Request, res as Response);

        expect(statusMock).toHaveBeenCalledWith(400);
        expect(jsonMock).toHaveBeenCalledWith({
          error: 'Invalid IP address: not-an-ip'
        });
      });
    });

    // -----------------------------------------------------------------------
    describe('Error Path — 500 Internal Server Error (unexpected thrown exception)', () => {
      it('should return 500 and log the error when the use case throws', async () => {
        const thrownError = new Error('Unexpected create error');
        const mockReq = createMockRequest({
          params: { id: DEVICE_UUID },
          body: { ipAddress: '192.168.1.10' }
        });
        const { res, statusMock, jsonMock } = createMockResponse();

        (mockCreatePollingUseCase.execute as jest.Mock).mockRejectedValue(
          thrownError
        );

        await controller.create(mockReq as Request, res as Response);

        expect(statusMock).toHaveBeenCalledWith(500);
        expect(jsonMock).toHaveBeenCalledWith({ error: 'Internal server error' });
        expect(mockLogger.error).toHaveBeenCalledWith(
          'Unexpected error in PollingController',
          thrownError,
          { error: 'Unexpected create error' }
        );
      });
    });
  });

  // =========================================================================
  describe('configure (PATCH /api/devices/:id/polling/config)', () => {
    const validBody = {
      intervalSeconds: 120,
      failuresBeforeDown: 5,
      enabled: false
    };

    // -----------------------------------------------------------------------
    describe('Happy Path', () => {
      it('should return 204 with no body on a successful configuration update', async () => {
        const mockReq = createMockRequest({
          params: { id: DEVICE_UUID },
          body: validBody
        });
        const { res, statusMock, sendMock } = createMockResponse();

        (mockConfigurePollingUseCase.execute as jest.Mock).mockResolvedValue(
          Result.ok(undefined)
        );

        await controller.configure(mockReq as Request, res as Response);

        expect(statusMock).toHaveBeenCalledWith(204);
        expect(sendMock).toHaveBeenCalled();
      });

      it('should pass deviceId and body fields to the use case', async () => {
        const mockReq = createMockRequest({
          params: { id: DEVICE_UUID },
          body: validBody
        });
        const { res } = createMockResponse();

        (mockConfigurePollingUseCase.execute as jest.Mock).mockResolvedValue(
          Result.ok(undefined)
        );

        await controller.configure(mockReq as Request, res as Response);

        expect(mockConfigurePollingUseCase.execute).toHaveBeenCalledWith({
          deviceId: DEVICE_UUID,
          intervalSeconds: 120,
          failuresBeforeDown: 5,
          enabled: false
        });
      });
    });

    // -----------------------------------------------------------------------
    describe('Error Path — 404 Not Found', () => {
      it('should return 404 when the use case fails with "not found"', async () => {
        const mockReq = createMockRequest({
          params: { id: DEVICE_UUID },
          body: validBody
        });
        const { res, statusMock, jsonMock } = createMockResponse();

        (mockConfigurePollingUseCase.execute as jest.Mock).mockResolvedValue(
          Result.fail(`Device not found: ${DEVICE_UUID}`)
        );

        await controller.configure(mockReq as Request, res as Response);

        expect(statusMock).toHaveBeenCalledWith(404);
        expect(jsonMock).toHaveBeenCalledWith({
          error: `Device not found: ${DEVICE_UUID}`
        });
      });

      it('should return 404 when the use case fails with "No polling configuration"', async () => {
        const mockReq = createMockRequest({
          params: { id: DEVICE_UUID },
          body: validBody
        });
        const { res, statusMock } = createMockResponse();

        (mockConfigurePollingUseCase.execute as jest.Mock).mockResolvedValue(
          Result.fail('No polling configuration found for this device')
        );

        await controller.configure(mockReq as Request, res as Response);

        expect(statusMock).toHaveBeenCalledWith(404);
      });
    });

    // -----------------------------------------------------------------------
    describe('Error Path — 400 Bad Request', () => {
      it('should return 400 when the use case fails with a validation error', async () => {
        const mockReq = createMockRequest({
          params: { id: DEVICE_UUID },
          body: { intervalSeconds: -1 }
        });
        const { res, statusMock, jsonMock } = createMockResponse();

        (mockConfigurePollingUseCase.execute as jest.Mock).mockResolvedValue(
          Result.fail('intervalSeconds must be a positive integer')
        );

        await controller.configure(mockReq as Request, res as Response);

        expect(statusMock).toHaveBeenCalledWith(400);
        expect(jsonMock).toHaveBeenCalledWith({
          error: 'intervalSeconds must be a positive integer'
        });
      });
    });

    // -----------------------------------------------------------------------
    describe('Error Path — 500 Internal Server Error (unexpected thrown exception)', () => {
      it('should return 500 and log the error when the use case throws', async () => {
        const thrownError = new Error('Unexpected configure error');
        const mockReq = createMockRequest({
          params: { id: DEVICE_UUID },
          body: { intervalSeconds: 60 }
        });
        const { res, statusMock, jsonMock } = createMockResponse();

        (mockConfigurePollingUseCase.execute as jest.Mock).mockRejectedValue(
          thrownError
        );

        await controller.configure(mockReq as Request, res as Response);

        expect(statusMock).toHaveBeenCalledWith(500);
        expect(jsonMock).toHaveBeenCalledWith({ error: 'Internal server error' });
        expect(mockLogger.error).toHaveBeenCalledWith(
          'Unexpected error in PollingController',
          thrownError,
          { error: 'Unexpected configure error' }
        );
      });
    });
  });
});
