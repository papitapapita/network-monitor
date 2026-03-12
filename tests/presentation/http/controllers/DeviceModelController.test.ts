// Source: src/presentation/http/controllers/DeviceModelController.ts

import { Request, Response } from 'express';
import { DeviceModelController } from '../../../../src/presentation/http/controllers/DeviceModelController';
import { GetDeviceModelUseCase } from '../../../../src/application/device-inventory/use-cases/GetDeviceModelUseCase';
import { ListDeviceModelsUseCase } from '../../../../src/application/device-inventory/use-cases/ListDeviceModelsUseCase';
import { ILogger } from '../../../../src/application/shared/interfaces/ILogger';
import { Result } from '../../../../src/domain/shared/core/Result';

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

interface DeviceModelResponseDTO {
  id: string;
  manufacturer: string;
  model: string;
  deviceType: string;
  createdAt: string;
  updatedAt: string;
}

interface DeviceModelListResponseDTO {
  deviceModels: DeviceModelResponseDTO[];
  total: number;
  limit: number;
  offset: number;
  hasMore: boolean;
}

// ---------------------------------------------------------------------------
// Mock factories
// ---------------------------------------------------------------------------

const createMockGetUseCase = () =>
  ({ execute: jest.fn() }) as unknown as GetDeviceModelUseCase;

const createMockListUseCase = () =>
  ({ execute: jest.fn() }) as unknown as ListDeviceModelsUseCase;

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
  return { res: { status: statusMock, json: jsonMock }, statusMock, jsonMock };
};

// ---------------------------------------------------------------------------
// Shared fixtures
// ---------------------------------------------------------------------------

const VALID_UUID = 'f47ac10b-58cc-4372-a567-0e02b2c3d479';

const mockModelDTO: DeviceModelResponseDTO = {
  id: VALID_UUID,
  manufacturer: 'Mikrotik',
  model: 'RB760iGS',
  deviceType: 'ROUTER',
  createdAt: '2024-01-01T00:00:00.000Z',
  updatedAt: '2024-01-01T00:00:00.000Z'
};

const mockListDTO: DeviceModelListResponseDTO = {
  deviceModels: [mockModelDTO],
  total: 1,
  limit: 20,
  offset: 0,
  hasMore: false
};

// ---------------------------------------------------------------------------

describe('DeviceModelController', () => {
  let controller: DeviceModelController;
  let mockGetUseCase: GetDeviceModelUseCase;
  let mockListUseCase: ListDeviceModelsUseCase;
  let mockLogger: jest.Mocked<ILogger>;

  beforeEach(() => {
    mockGetUseCase = createMockGetUseCase();
    mockListUseCase = createMockListUseCase();
    mockLogger = createMockLogger();

    controller = new DeviceModelController(
      mockGetUseCase,
      mockListUseCase,
      mockLogger
    );
  });

  afterEach(() => {
    jest.clearAllMocks();
  });

  // =========================================================================
  describe('list (GET /api/device-models)', () => {
    // -----------------------------------------------------------------------
    describe('Happy Path', () => {
      it('should return 200 with success: true and data on successful list', async () => {
        const mockReq = createMockRequest({ query: {} });
        const { res, statusMock, jsonMock } = createMockResponse();

        (mockListUseCase.execute as jest.Mock).mockResolvedValue(
          Result.ok(mockListDTO)
        );

        await controller.list(mockReq as Request, res as Response);

        expect(statusMock).toHaveBeenCalledWith(200);
        expect(jsonMock).toHaveBeenCalledWith({
          success: true,
          data: mockListDTO
        });
      });

      it('should convert limit query string to number before passing to use case', async () => {
        const mockReq = createMockRequest({
          query: { limit: '10', offset: '5' }
        });
        const { res } = createMockResponse();

        (mockListUseCase.execute as jest.Mock).mockResolvedValue(
          Result.ok(mockListDTO)
        );

        await controller.list(mockReq as Request, res as Response);

        expect(mockListUseCase.execute).toHaveBeenCalledWith(
          expect.objectContaining({ limit: 10, offset: 5 })
        );
      });

      it('should pass undefined for limit and offset when absent from query', async () => {
        const mockReq = createMockRequest({ query: {} });
        const { res } = createMockResponse();

        (mockListUseCase.execute as jest.Mock).mockResolvedValue(
          Result.ok(mockListDTO)
        );

        await controller.list(mockReq as Request, res as Response);

        expect(mockListUseCase.execute).toHaveBeenCalledWith(
          expect.objectContaining({ limit: undefined, offset: undefined })
        );
      });
    });

    // -----------------------------------------------------------------------
    describe('Error Path — 404 Not Found', () => {
      it('should return 404 when the use case fails with "not found"', async () => {
        const mockReq = createMockRequest({ query: {} });
        const { res, statusMock, jsonMock } = createMockResponse();

        (mockListUseCase.execute as jest.Mock).mockResolvedValue(
          Result.fail('Resource not found')
        );

        await controller.list(mockReq as Request, res as Response);

        expect(statusMock).toHaveBeenCalledWith(404);
        expect(jsonMock).toHaveBeenCalledWith({
          success: false,
          error: 'Resource not found'
        });
      });
    });

    // -----------------------------------------------------------------------
    describe('Error Path — 400 Bad Request', () => {
      it('should return 400 when the use case fails with "Invalid"', async () => {
        const mockReq = createMockRequest({ query: {} });
        const { res, statusMock } = createMockResponse();

        (mockListUseCase.execute as jest.Mock).mockResolvedValue(
          Result.fail('Invalid query parameter')
        );

        await controller.list(mockReq as Request, res as Response);

        expect(statusMock).toHaveBeenCalledWith(400);
      });

      it('should return 400 when the use case fails with "must be"', async () => {
        const mockReq = createMockRequest({ query: {} });
        const { res, statusMock } = createMockResponse();

        (mockListUseCase.execute as jest.Mock).mockResolvedValue(
          Result.fail('Offset must be a non-negative integer')
        );

        await controller.list(mockReq as Request, res as Response);

        expect(statusMock).toHaveBeenCalledWith(400);
      });
    });

    // -----------------------------------------------------------------------
    describe('Error Path — 500 Internal Server Error', () => {
      it('should return 500 when the use case fails with an unrecognised message', async () => {
        const mockReq = createMockRequest({ query: {} });
        const { res, statusMock } = createMockResponse();

        (mockListUseCase.execute as jest.Mock).mockResolvedValue(
          Result.fail('Unexpected infrastructure error')
        );

        await controller.list(mockReq as Request, res as Response);

        expect(statusMock).toHaveBeenCalledWith(500);
      });

      it('should return 500 and log when the use case throws', async () => {
        const thrownError = new Error('Connection pool exhausted');
        const mockReq = createMockRequest({ query: {} });
        const { res, statusMock, jsonMock } = createMockResponse();

        (mockListUseCase.execute as jest.Mock).mockRejectedValue(thrownError);

        await controller.list(mockReq as Request, res as Response);

        expect(statusMock).toHaveBeenCalledWith(500);
        expect(jsonMock).toHaveBeenCalledWith({
          success: false,
          error: 'Internal server error'
        });
        expect(mockLogger.error).toHaveBeenCalledWith(
          'Unexpected error in DeviceModelController',
          thrownError,
          { error: 'Connection pool exhausted' }
        );
      });

      it('should not leak sensitive error details in the response body', async () => {
        const sensitiveError = new Error('SELECT * FROM device_models;');
        const mockReq = createMockRequest({ query: {} });
        const { res, jsonMock } = createMockResponse();

        (mockListUseCase.execute as jest.Mock).mockRejectedValue(sensitiveError);

        await controller.list(mockReq as Request, res as Response);

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

      it('should handle non-Error thrown values', async () => {
        const mockReq = createMockRequest({ query: {} });
        const { res, statusMock } = createMockResponse();

        (mockListUseCase.execute as jest.Mock).mockRejectedValue(
          'string exception'
        );

        await controller.list(mockReq as Request, res as Response);

        expect(statusMock).toHaveBeenCalledWith(500);
        expect(mockLogger.error).toHaveBeenCalledWith(
          'Unexpected error in DeviceModelController',
          'string exception',
          { error: 'string exception' }
        );
      });
    });
  });

  // =========================================================================
  describe('getById (GET /api/device-models/:id)', () => {
    // -----------------------------------------------------------------------
    describe('Happy Path', () => {
      it('should return 200 with success: true and data when model is found', async () => {
        const mockReq = createMockRequest({ params: { id: VALID_UUID } });
        const { res, statusMock, jsonMock } = createMockResponse();

        (mockGetUseCase.execute as jest.Mock).mockResolvedValue(
          Result.ok(mockModelDTO)
        );

        await controller.getById(mockReq as Request, res as Response);

        expect(statusMock).toHaveBeenCalledWith(200);
        expect(jsonMock).toHaveBeenCalledWith({
          success: true,
          data: mockModelDTO
        });
      });

      it('should pass req.params.id to the use case', async () => {
        const mockReq = createMockRequest({ params: { id: VALID_UUID } });
        const { res } = createMockResponse();

        (mockGetUseCase.execute as jest.Mock).mockResolvedValue(
          Result.ok(mockModelDTO)
        );

        await controller.getById(mockReq as Request, res as Response);

        expect(mockGetUseCase.execute).toHaveBeenCalledWith({ id: VALID_UUID });
      });
    });

    // -----------------------------------------------------------------------
    describe('Error Path — 404 Not Found', () => {
      it('should return 404 when the use case fails with "not found"', async () => {
        const mockReq = createMockRequest({ params: { id: VALID_UUID } });
        const { res, statusMock, jsonMock } = createMockResponse();

        (mockGetUseCase.execute as jest.Mock).mockResolvedValue(
          Result.fail(`Device model not found: ${VALID_UUID}`)
        );

        await controller.getById(mockReq as Request, res as Response);

        expect(statusMock).toHaveBeenCalledWith(404);
        expect(jsonMock).toHaveBeenCalledWith({
          success: false,
          error: `Device model not found: ${VALID_UUID}`
        });
      });
    });

    // -----------------------------------------------------------------------
    describe('Error Path — 400 Bad Request', () => {
      it('should return 400 when the use case fails with "Invalid" ID format', async () => {
        const mockReq = createMockRequest({ params: { id: 'bad-id' } });
        const { res, statusMock } = createMockResponse();

        (mockGetUseCase.execute as jest.Mock).mockResolvedValue(
          Result.fail('Invalid device model ID: bad-id')
        );

        await controller.getById(mockReq as Request, res as Response);

        expect(statusMock).toHaveBeenCalledWith(400);
      });

      it('should return 400 when the use case fails with "required"', async () => {
        const mockReq = createMockRequest({ params: { id: '' } });
        const { res, statusMock } = createMockResponse();

        (mockGetUseCase.execute as jest.Mock).mockResolvedValue(
          Result.fail('Device model ID is required')
        );

        await controller.getById(mockReq as Request, res as Response);

        expect(statusMock).toHaveBeenCalledWith(400);
      });
    });

    // -----------------------------------------------------------------------
    describe('Error Path — 500 Internal Server Error', () => {
      it('should return 500 when the use case fails with an unrecognised message', async () => {
        const mockReq = createMockRequest({ params: { id: VALID_UUID } });
        const { res, statusMock } = createMockResponse();

        (mockGetUseCase.execute as jest.Mock).mockResolvedValue(
          Result.fail('DB read timeout')
        );

        await controller.getById(mockReq as Request, res as Response);

        expect(statusMock).toHaveBeenCalledWith(500);
      });

      it('should return 500 and log when the use case throws', async () => {
        const thrownError = new Error('Unexpected error');
        const mockReq = createMockRequest({ params: { id: VALID_UUID } });
        const { res, statusMock, jsonMock } = createMockResponse();

        (mockGetUseCase.execute as jest.Mock).mockRejectedValue(thrownError);

        await controller.getById(mockReq as Request, res as Response);

        expect(statusMock).toHaveBeenCalledWith(500);
        expect(jsonMock).toHaveBeenCalledWith({
          success: false,
          error: 'Internal server error'
        });
        expect(mockLogger.error).toHaveBeenCalledWith(
          'Unexpected error in DeviceModelController',
          thrownError,
          { error: 'Unexpected error' }
        );
      });

      it('should handle a thrown null gracefully', async () => {
        const mockReq = createMockRequest({ params: { id: VALID_UUID } });
        const { res, statusMock, jsonMock } = createMockResponse();

        (mockGetUseCase.execute as jest.Mock).mockRejectedValue(null);

        await controller.getById(mockReq as Request, res as Response);

        expect(statusMock).toHaveBeenCalledWith(500);
        expect(jsonMock).toHaveBeenCalledWith({
          success: false,
          error: 'Internal server error'
        });
      });
    });
  });

  // =========================================================================
  describe('getErrorStatusCode (exercised through endpoint methods)', () => {
    it('should prioritise "not found" over "Invalid" when both appear in the message', async () => {
      const mockReq = createMockRequest({ params: { id: VALID_UUID } });
      const { res, statusMock } = createMockResponse();

      (mockGetUseCase.execute as jest.Mock).mockResolvedValue(
        Result.fail('Invalid resource not found in database')
      );

      await controller.getById(mockReq as Request, res as Response);

      expect(statusMock).toHaveBeenCalledWith(404);
    });

    it('should default to 500 for messages that match no known keyword', async () => {
      const mockReq = createMockRequest({ query: {} });
      const { res, statusMock } = createMockResponse();

      (mockListUseCase.execute as jest.Mock).mockResolvedValue(
        Result.fail('Something completely unknown happened')
      );

      await controller.list(mockReq as Request, res as Response);

      expect(statusMock).toHaveBeenCalledWith(500);
    });
  });

  // =========================================================================
  describe('handleUnexpectedError (exercised through endpoint methods)', () => {
    it('should extract the message from an Error instance', async () => {
      const error = new Error('Exact message');
      const mockReq = createMockRequest({ query: {} });
      const { res } = createMockResponse();

      (mockListUseCase.execute as jest.Mock).mockRejectedValue(error);

      await controller.list(mockReq as Request, res as Response);

      expect(mockLogger.error).toHaveBeenCalledWith(
        'Unexpected error in DeviceModelController',
        error,
        { error: 'Exact message' }
      );
    });

    it('should convert a numeric thrown value to a string', async () => {
      const mockReq = createMockRequest({ query: {} });
      const { res } = createMockResponse();

      (mockListUseCase.execute as jest.Mock).mockRejectedValue(42);

      await controller.list(mockReq as Request, res as Response);

      expect(mockLogger.error).toHaveBeenCalledWith(
        'Unexpected error in DeviceModelController',
        42,
        { error: '42' }
      );
    });
  });
});
