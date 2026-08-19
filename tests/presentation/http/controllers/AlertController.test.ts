// Source: src/presentation/http/controllers/AlertController.ts

import { Request, Response } from 'express';
import { AlertController } from '../../../../src/presentation/http/controllers/AlertController';
import { ListAlertsUseCase } from '../../../../src/application/notifications/use-cases/ListAlertsUseCase';
import { GetAlertByIdUseCase } from '../../../../src/application/notifications/use-cases/GetAlertByIdUseCase';
import { DeleteAlertUseCase } from '../../../../src/application/notifications/use-cases/DeleteAlertUseCase';
import { ClearAlertUseCase } from '../../../../src/application/notifications/use-cases/ClearAlertUseCase';
import { BulkClearAlertsUseCase } from '../../../../src/application/notifications/use-cases/BulkClearAlertsUseCase';
import { BulkDeleteAlertsUseCase } from '../../../../src/application/notifications/use-cases/BulkDeleteAlertsUseCase';
import { ILogger } from '../../../../src/application/shared/interfaces/ILogger';
import { Result } from '../../../../src/domain/shared/core/Result';

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

/** Minimal AlertResponseDTO shape returned by ListAlertsUseCase. */
interface AlertResponseDTO {
  id: string;
  deviceId: string;
  type: string;
  message: string;
  sentAt: string;
}

/** Minimal AlertListResponseDTO shape returned by ListAlertsUseCase. */
interface AlertListResponseDTO {
  items: AlertResponseDTO[];
  total: number;
  limit: number;
  offset: number;
  hasMore: boolean;
}

// ---------------------------------------------------------------------------
// Mock factories
// ---------------------------------------------------------------------------

const createMockListAlertsUseCase = () =>
  ({ execute: jest.fn() }) as unknown as ListAlertsUseCase;

const createMockGetAlertByIdUseCase = () =>
  ({ execute: jest.fn() }) as unknown as GetAlertByIdUseCase;

const createMockDeleteAlertUseCase = () =>
  ({ execute: jest.fn() }) as unknown as DeleteAlertUseCase;

const createMockClearAlertUseCase = () =>
  ({ execute: jest.fn() }) as unknown as ClearAlertUseCase;

const createMockBulkClearAlertsUseCase = () =>
  ({ execute: jest.fn() }) as unknown as BulkClearAlertsUseCase;

const createMockBulkDeleteAlertsUseCase = () =>
  ({ execute: jest.fn() }) as unknown as BulkDeleteAlertsUseCase;

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
} => {
  const jsonMock = jest.fn();
  const statusMock = jest.fn().mockReturnValue({ json: jsonMock });
  return {
    res: { status: statusMock, json: jsonMock },
    statusMock,
    jsonMock
  };
};

// ---------------------------------------------------------------------------
// Shared fixtures
// ---------------------------------------------------------------------------

const DEVICE_UUID = 'f47ac10b-58cc-4372-a567-0e02b2c3d479';
const ALERT_UUID = 'a1b2c3d4-e5f6-7890-abcd-ef0123456789';

const mockAlertDTO: AlertResponseDTO = {
  id: ALERT_UUID,
  deviceId: DEVICE_UUID,
  type: 'DEVICE_DOWN',
  message: 'Device Core-Router-01 is unreachable',
  sentAt: '2024-01-15T10:30:00.000Z'
};

const mockAlertListDTO: AlertListResponseDTO = {
  items: [mockAlertDTO],
  total: 1,
  limit: 20,
  offset: 0,
  hasMore: false
};

// ---------------------------------------------------------------------------

describe('AlertController', () => {
  let controller: AlertController;
  let mockListAlertsUseCase: ListAlertsUseCase;
  let mockGetAlertByIdUseCase: GetAlertByIdUseCase;
  let mockDeleteAlertUseCase: DeleteAlertUseCase;
  let mockClearAlertUseCase: ClearAlertUseCase;
  let mockBulkClearAlertsUseCase: BulkClearAlertsUseCase;
  let mockBulkDeleteAlertsUseCase: BulkDeleteAlertsUseCase;
  let mockLogger: jest.Mocked<ILogger>;

  beforeEach(() => {
    mockListAlertsUseCase = createMockListAlertsUseCase();
    mockGetAlertByIdUseCase = createMockGetAlertByIdUseCase();
    mockDeleteAlertUseCase = createMockDeleteAlertUseCase();
    mockClearAlertUseCase = createMockClearAlertUseCase();
    mockBulkClearAlertsUseCase = createMockBulkClearAlertsUseCase();
    mockBulkDeleteAlertsUseCase = createMockBulkDeleteAlertsUseCase();
    mockLogger = createMockLogger();

    controller = new AlertController(
      mockListAlertsUseCase,
      mockGetAlertByIdUseCase,
      mockDeleteAlertUseCase,
      mockClearAlertUseCase,
      mockBulkClearAlertsUseCase,
      mockBulkDeleteAlertsUseCase,
      mockLogger
    );
  });

  afterEach(() => {
    jest.clearAllMocks();
  });

  // =========================================================================
  describe('listAlerts (GET /api/alerts)', () => {
    // -----------------------------------------------------------------------
    describe('Happy Path', () => {
      it('should return 200 with success: true and data on a successful list', async () => {
        const mockReq = createMockRequest({ query: {} });
        const { res, statusMock, jsonMock } = createMockResponse();

        (
          mockListAlertsUseCase.execute as jest.Mock
        ).mockResolvedValue(Result.ok(mockAlertListDTO));

        await controller.listAlerts(
          mockReq as Request,
          res as Response
        );

        expect(statusMock).toHaveBeenCalledWith(200);
        expect(jsonMock).toHaveBeenCalledWith({
          success: true,
          data: mockAlertListDTO
        });
      });

      it('should pass deviceId query param to the use case', async () => {
        const mockReq = createMockRequest({
          query: { deviceId: DEVICE_UUID }
        });
        const { res } = createMockResponse();

        (
          mockListAlertsUseCase.execute as jest.Mock
        ).mockResolvedValue(Result.ok(mockAlertListDTO));

        await controller.listAlerts(
          mockReq as Request,
          res as Response
        );

        expect(mockListAlertsUseCase.execute).toHaveBeenCalledWith(
          expect.objectContaining({ deviceId: DEVICE_UUID })
        );
      });

      it('should convert limit and offset query strings to numbers', async () => {
        const mockReq = createMockRequest({
          query: { limit: '10', offset: '5' }
        });
        const { res } = createMockResponse();

        (
          mockListAlertsUseCase.execute as jest.Mock
        ).mockResolvedValue(Result.ok(mockAlertListDTO));

        await controller.listAlerts(
          mockReq as Request,
          res as Response
        );

        expect(mockListAlertsUseCase.execute).toHaveBeenCalledWith(
          expect.objectContaining({ limit: 10, offset: 5 })
        );
      });

      it('should pass undefined for limit and offset when absent from query', async () => {
        const mockReq = createMockRequest({ query: {} });
        const { res } = createMockResponse();

        (
          mockListAlertsUseCase.execute as jest.Mock
        ).mockResolvedValue(Result.ok(mockAlertListDTO));

        await controller.listAlerts(
          mockReq as Request,
          res as Response
        );

        expect(mockListAlertsUseCase.execute).toHaveBeenCalledWith(
          expect.objectContaining({
            limit: undefined,
            offset: undefined
          })
        );
      });

      it('should pass undefined for deviceId when absent from query', async () => {
        const mockReq = createMockRequest({ query: {} });
        const { res } = createMockResponse();

        (
          mockListAlertsUseCase.execute as jest.Mock
        ).mockResolvedValue(Result.ok(mockAlertListDTO));

        await controller.listAlerts(
          mockReq as Request,
          res as Response
        );

        expect(mockListAlertsUseCase.execute).toHaveBeenCalledWith(
          expect.objectContaining({ deviceId: undefined })
        );
      });

      it('should return an empty list when no alerts exist', async () => {
        const emptyListDTO: AlertListResponseDTO = {
          items: [],
          total: 0,
          limit: 20,
          offset: 0,
          hasMore: false
        };
        const mockReq = createMockRequest({ query: {} });
        const { res, statusMock, jsonMock } = createMockResponse();

        (
          mockListAlertsUseCase.execute as jest.Mock
        ).mockResolvedValue(Result.ok(emptyListDTO));

        await controller.listAlerts(
          mockReq as Request,
          res as Response
        );

        expect(statusMock).toHaveBeenCalledWith(200);
        expect(jsonMock).toHaveBeenCalledWith({
          success: true,
          data: emptyListDTO
        });
      });
    });

    // -----------------------------------------------------------------------
    describe('Error Path — 404 Not Found', () => {
      it('should return 404 when the use case fails with "not found"', async () => {
        const mockReq = createMockRequest({
          query: { deviceId: DEVICE_UUID }
        });
        const { res, statusMock, jsonMock } = createMockResponse();

        (
          mockListAlertsUseCase.execute as jest.Mock
        ).mockResolvedValue(
          Result.fail(`Device not found: ${DEVICE_UUID}`)
        );

        await controller.listAlerts(
          mockReq as Request,
          res as Response
        );

        expect(statusMock).toHaveBeenCalledWith(404);
        expect(jsonMock).toHaveBeenCalledWith({
          success: false,
          error: `Device not found: ${DEVICE_UUID}`
        });
      });
    });

    // -----------------------------------------------------------------------
    describe('Error Path — 400 Bad Request', () => {
      it('should return 400 when the use case fails with "Invalid"', async () => {
        const mockReq = createMockRequest({
          query: { deviceId: 'not-a-uuid' }
        });
        const { res, statusMock, jsonMock } = createMockResponse();

        (
          mockListAlertsUseCase.execute as jest.Mock
        ).mockResolvedValue(
          Result.fail('Invalid device ID: not-a-uuid')
        );

        await controller.listAlerts(
          mockReq as Request,
          res as Response
        );

        expect(statusMock).toHaveBeenCalledWith(400);
        expect(jsonMock).toHaveBeenCalledWith({
          success: false,
          error: 'Invalid device ID: not-a-uuid'
        });
      });

      it('should return 400 when the use case fails with lowercase "invalid"', async () => {
        const mockReq = createMockRequest({ query: { limit: '-1' } });
        const { res, statusMock } = createMockResponse();

        (
          mockListAlertsUseCase.execute as jest.Mock
        ).mockResolvedValue(
          Result.fail('invalid limit: must be a positive integer')
        );

        await controller.listAlerts(
          mockReq as Request,
          res as Response
        );

        expect(statusMock).toHaveBeenCalledWith(400);
      });

      it('should return 400 when the use case fails with "required"', async () => {
        const mockReq = createMockRequest({ query: {} });
        const { res, statusMock } = createMockResponse();

        (
          mockListAlertsUseCase.execute as jest.Mock
        ).mockResolvedValue(Result.fail('deviceId is required'));

        await controller.listAlerts(
          mockReq as Request,
          res as Response
        );

        expect(statusMock).toHaveBeenCalledWith(400);
      });

      it('should return 400 when the use case fails with "must be"', async () => {
        const mockReq = createMockRequest({ query: { limit: '0' } });
        const { res, statusMock } = createMockResponse();

        (
          mockListAlertsUseCase.execute as jest.Mock
        ).mockResolvedValue(
          Result.fail('Limit must be a positive integer')
        );

        await controller.listAlerts(
          mockReq as Request,
          res as Response
        );

        expect(statusMock).toHaveBeenCalledWith(400);
      });
    });

    // -----------------------------------------------------------------------
    describe('Error Path — 500 Internal Server Error (use case Result failure)', () => {
      it('should return 500 when the use case fails with an unrecognised message', async () => {
        const mockReq = createMockRequest({ query: {} });
        const { res, statusMock, jsonMock } = createMockResponse();

        (
          mockListAlertsUseCase.execute as jest.Mock
        ).mockResolvedValue(
          Result.fail('Database connection refused')
        );

        await controller.listAlerts(
          mockReq as Request,
          res as Response
        );

        expect(statusMock).toHaveBeenCalledWith(500);
        expect(jsonMock).toHaveBeenCalledWith({
          success: false,
          error: 'Database connection refused'
        });
      });
    });

    // -----------------------------------------------------------------------
    describe('Error Path — 500 Internal Server Error (unexpected thrown exception)', () => {
      it('should return 500 and log the error when the use case throws', async () => {
        const thrownError = new Error('Unexpected DB crash');
        const mockReq = createMockRequest({ query: {} });
        const { res, statusMock, jsonMock } = createMockResponse();

        (
          mockListAlertsUseCase.execute as jest.Mock
        ).mockRejectedValue(thrownError);

        await controller.listAlerts(
          mockReq as Request,
          res as Response
        );

        expect(statusMock).toHaveBeenCalledWith(500);
        expect(jsonMock).toHaveBeenCalledWith({
          success: false,
          error: 'Internal server error'
        });
        expect(mockLogger.error).toHaveBeenCalledWith(
          'Unexpected error in AlertController',
          thrownError,
          { error: 'Unexpected DB crash' }
        );
      });

      it('should not leak sensitive error details in the response body', async () => {
        const sensitiveError = new Error(
          'SELECT * FROM alerts; -- injected'
        );
        const mockReq = createMockRequest({ query: {} });
        const { res, jsonMock } = createMockResponse();

        (
          mockListAlertsUseCase.execute as jest.Mock
        ).mockRejectedValue(sensitiveError);

        await controller.listAlerts(
          mockReq as Request,
          res as Response
        );

        expect(jsonMock).toHaveBeenCalledWith({
          success: false,
          error: 'Internal server error'
        });
        expect(jsonMock).not.toHaveBeenCalledWith(
          expect.objectContaining({
            error: expect.stringContaining('SELECT')
          })
        );
      });

      it('should handle non-Error thrown values by converting them to strings', async () => {
        const mockReq = createMockRequest({ query: {} });
        const { res, statusMock } = createMockResponse();

        (
          mockListAlertsUseCase.execute as jest.Mock
        ).mockRejectedValue('string exception');

        await controller.listAlerts(
          mockReq as Request,
          res as Response
        );

        expect(statusMock).toHaveBeenCalledWith(500);
        expect(mockLogger.error).toHaveBeenCalledWith(
          'Unexpected error in AlertController',
          'string exception',
          { error: 'string exception' }
        );
      });

      it('should handle a thrown null gracefully', async () => {
        const mockReq = createMockRequest({ query: {} });
        const { res, statusMock, jsonMock } = createMockResponse();

        (
          mockListAlertsUseCase.execute as jest.Mock
        ).mockRejectedValue(null);

        await controller.listAlerts(
          mockReq as Request,
          res as Response
        );

        expect(statusMock).toHaveBeenCalledWith(500);
        expect(jsonMock).toHaveBeenCalledWith({
          success: false,
          error: 'Internal server error'
        });
      });

      it('should handle a numeric thrown value and log it as a string', async () => {
        const mockReq = createMockRequest({ query: {} });
        const { res, statusMock } = createMockResponse();

        (
          mockListAlertsUseCase.execute as jest.Mock
        ).mockRejectedValue(42);

        await controller.listAlerts(
          mockReq as Request,
          res as Response
        );

        expect(statusMock).toHaveBeenCalledWith(500);
        expect(mockLogger.error).toHaveBeenCalledWith(
          'Unexpected error in AlertController',
          42,
          { error: '42' }
        );
      });
    });

    // -----------------------------------------------------------------------
    describe('getErrorStatusCode (exercised through listAlerts)', () => {
      it('should prioritise "not found" over "Invalid" when both appear in the message', async () => {
        const mockReq = createMockRequest({ query: {} });
        const { res, statusMock } = createMockResponse();

        (
          mockListAlertsUseCase.execute as jest.Mock
        ).mockResolvedValue(
          Result.fail('Invalid resource not found in database')
        );

        await controller.listAlerts(
          mockReq as Request,
          res as Response
        );

        expect(statusMock).toHaveBeenCalledWith(404);
      });

      it('should default to 500 for messages that match no known keyword', async () => {
        const mockReq = createMockRequest({ query: {} });
        const { res, statusMock } = createMockResponse();

        (
          mockListAlertsUseCase.execute as jest.Mock
        ).mockResolvedValue(
          Result.fail('Something completely unknown happened')
        );

        await controller.listAlerts(
          mockReq as Request,
          res as Response
        );

        expect(statusMock).toHaveBeenCalledWith(500);
      });
    });
  });

  // =========================================================================
  describe('clearAlert (POST /api/alerts/:id/clear)', () => {
    describe('Happy Path', () => {
      it('[NOT-037] should return 200 with success: true and the cleared alert', async () => {
        const mockReq = createMockRequest({
          params: { id: ALERT_UUID }
        });
        const { res, statusMock, jsonMock } = createMockResponse();

        (
          mockClearAlertUseCase.execute as jest.Mock
        ).mockResolvedValue(Result.ok(mockAlertDTO));

        await controller.clearAlert(
          mockReq as Request,
          res as Response
        );

        expect(mockClearAlertUseCase.execute).toHaveBeenCalledWith({
          id: ALERT_UUID
        });
        expect(statusMock).toHaveBeenCalledWith(200);
        expect(jsonMock).toHaveBeenCalledWith({
          success: true,
          data: mockAlertDTO
        });
      });
    });

    describe('Error Path — 404 Not Found', () => {
      it('[NOT-037] should return 404 when the alert does not exist', async () => {
        const mockReq = createMockRequest({
          params: { id: ALERT_UUID }
        });
        const { res, statusMock, jsonMock } = createMockResponse();

        (
          mockClearAlertUseCase.execute as jest.Mock
        ).mockResolvedValue(Result.fail('Alert not found'));

        await controller.clearAlert(
          mockReq as Request,
          res as Response
        );

        expect(statusMock).toHaveBeenCalledWith(404);
        expect(jsonMock).toHaveBeenCalledWith({
          success: false,
          error: 'Alert not found'
        });
      });
    });

    describe('Error Path — 500 Internal Server Error (unexpected thrown exception)', () => {
      it('should return 500 and log the error when the use case throws', async () => {
        const thrownError = new Error('Clear failed');
        const mockReq = createMockRequest({
          params: { id: ALERT_UUID }
        });
        const { res, statusMock, jsonMock } = createMockResponse();

        (
          mockClearAlertUseCase.execute as jest.Mock
        ).mockRejectedValue(thrownError);

        await controller.clearAlert(
          mockReq as Request,
          res as Response
        );

        expect(statusMock).toHaveBeenCalledWith(500);
        expect(jsonMock).toHaveBeenCalledWith({
          success: false,
          error: 'Internal server error'
        });
      });
    });
  });

  // =========================================================================
  describe('bulkClearAlerts (POST /api/alerts/clear)', () => {
    describe('Happy Path', () => {
      it('[NOT-038] should return 200 with the bucketed result, passing ids through', async () => {
        const mockReq = createMockRequest({
          body: { ids: [ALERT_UUID] }
        });
        const { res, statusMock, jsonMock } = createMockResponse();
        const bucketed = {
          cleared: [mockAlertDTO],
          skipped: [],
          failed: []
        };

        (
          mockBulkClearAlertsUseCase.execute as jest.Mock
        ).mockResolvedValue(Result.ok(bucketed));

        await controller.bulkClearAlerts(
          mockReq as Request,
          res as Response
        );

        expect(
          mockBulkClearAlertsUseCase.execute
        ).toHaveBeenCalledWith({
          ids: [ALERT_UUID],
          deviceId: undefined
        });
        expect(statusMock).toHaveBeenCalledWith(200);
        expect(jsonMock).toHaveBeenCalledWith({
          success: true,
          data: bucketed
        });
      });

      it('[NOT-038] should pass deviceId through when ids is omitted', async () => {
        const mockReq = createMockRequest({
          body: { deviceId: DEVICE_UUID }
        });
        const { res } = createMockResponse();

        (
          mockBulkClearAlertsUseCase.execute as jest.Mock
        ).mockResolvedValue(
          Result.ok({ cleared: [], skipped: [], failed: [] })
        );

        await controller.bulkClearAlerts(
          mockReq as Request,
          res as Response
        );

        expect(
          mockBulkClearAlertsUseCase.execute
        ).toHaveBeenCalledWith({
          ids: undefined,
          deviceId: DEVICE_UUID
        });
      });
    });

    describe('Error Path — 400 Bad Request', () => {
      it('[NOT-038] should return 400 when neither ids nor deviceId is provided', async () => {
        const mockReq = createMockRequest({ body: {} });
        const { res, statusMock } = createMockResponse();

        (
          mockBulkClearAlertsUseCase.execute as jest.Mock
        ).mockResolvedValue(
          Result.fail('Exactly one of ids or deviceId is required')
        );

        await controller.bulkClearAlerts(
          mockReq as Request,
          res as Response
        );

        expect(statusMock).toHaveBeenCalledWith(400);
      });
    });

    describe('Error Path — 500 Internal Server Error (unexpected thrown exception)', () => {
      it('should return 500 and log the error when the use case throws', async () => {
        const thrownError = new Error('Bulk clear failed');
        const mockReq = createMockRequest({
          body: { ids: [ALERT_UUID] }
        });
        const { res, statusMock, jsonMock } = createMockResponse();

        (
          mockBulkClearAlertsUseCase.execute as jest.Mock
        ).mockRejectedValue(thrownError);

        await controller.bulkClearAlerts(
          mockReq as Request,
          res as Response
        );

        expect(statusMock).toHaveBeenCalledWith(500);
        expect(jsonMock).toHaveBeenCalledWith({
          success: false,
          error: 'Internal server error'
        });
      });
    });
  });

  // =========================================================================
  describe('bulkDeleteAlerts (DELETE /api/alerts)', () => {
    describe('Happy Path', () => {
      it('[NOT-039] should return 200 with the bucketed result', async () => {
        const mockReq = createMockRequest({
          body: { ids: [ALERT_UUID] }
        });
        const { res, statusMock, jsonMock } = createMockResponse();
        const bucketed = {
          deleted: [ALERT_UUID],
          skipped: [],
          failed: []
        };

        (
          mockBulkDeleteAlertsUseCase.execute as jest.Mock
        ).mockResolvedValue(Result.ok(bucketed));

        await controller.bulkDeleteAlerts(
          mockReq as Request,
          res as Response
        );

        expect(
          mockBulkDeleteAlertsUseCase.execute
        ).toHaveBeenCalledWith({
          ids: [ALERT_UUID]
        });
        expect(statusMock).toHaveBeenCalledWith(200);
        expect(jsonMock).toHaveBeenCalledWith({
          success: true,
          data: bucketed
        });
      });
    });

    describe('Error Path — 400 Bad Request', () => {
      it('[NOT-039] should return 400 when ids is missing', async () => {
        const mockReq = createMockRequest({ body: {} });
        const { res, statusMock } = createMockResponse();

        (
          mockBulkDeleteAlertsUseCase.execute as jest.Mock
        ).mockResolvedValue(
          Result.fail('ids is required and must not be empty')
        );

        await controller.bulkDeleteAlerts(
          mockReq as Request,
          res as Response
        );

        expect(statusMock).toHaveBeenCalledWith(400);
      });
    });

    describe('Error Path — 500 Internal Server Error (unexpected thrown exception)', () => {
      it('should return 500 and log the error when the use case throws', async () => {
        const thrownError = new Error('Bulk delete failed');
        const mockReq = createMockRequest({
          body: { ids: [ALERT_UUID] }
        });
        const { res, statusMock, jsonMock } = createMockResponse();

        (
          mockBulkDeleteAlertsUseCase.execute as jest.Mock
        ).mockRejectedValue(thrownError);

        await controller.bulkDeleteAlerts(
          mockReq as Request,
          res as Response
        );

        expect(statusMock).toHaveBeenCalledWith(500);
        expect(jsonMock).toHaveBeenCalledWith({
          success: false,
          error: 'Internal server error'
        });
      });
    });
  });
});
