// Source: src/presentation/http/controllers/LocationController.ts

import { Request, Response } from 'express';
import { LocationController } from '../../../../src/presentation/http/controllers/LocationController';
import { CreateLocationUseCase } from '../../../../src/application/device-inventory/use-cases/CreateLocationUseCase';
import { GetLocationUseCase } from '../../../../src/application/device-inventory/use-cases/GetLocationUseCase';
import { ListLocationsUseCase } from '../../../../src/application/device-inventory/use-cases/ListLocationsUseCase';
import { UpdateLocationUseCase } from '../../../../src/application/device-inventory/use-cases/UpdateLocationUseCase';
import { ILogger } from '../../../../src/application/shared/interfaces/ILogger';
import { Result } from '../../../../src/domain/shared/core/Result';

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

/** Minimal LocationResponseDTO shape returned by use cases. */
interface LocationResponseDTO {
  id: string;
  name: string;
  type: string;
  municipality: string | null;
  neighborhood: string | null;
  address: string | null;
  latitude: number | null;
  longitude: number | null;
  altitude: number | undefined;
  createdAt: string;
  updatedAt: string;
}

/** Minimal LocationListResponseDTO shape returned by ListLocationsUseCase. */
interface LocationListResponseDTO {
  items: LocationResponseDTO[];
  total: number;
  limit: number;
  offset: number;
  hasMore: boolean;
}

// ---------------------------------------------------------------------------
// Mock factories
// ---------------------------------------------------------------------------

const createMockCreateUseCase = () =>
  ({ execute: jest.fn() }) as unknown as CreateLocationUseCase;

const createMockGetUseCase = () =>
  ({ execute: jest.fn() }) as unknown as GetLocationUseCase;

const createMockListUseCase = () =>
  ({ execute: jest.fn() }) as unknown as ListLocationsUseCase;

const createMockUpdateUseCase = () =>
  ({ execute: jest.fn() }) as unknown as UpdateLocationUseCase;

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

const mockLocationDTO: LocationResponseDTO = {
  id: VALID_UUID,
  name: 'Torre Norte',
  type: 'TOWER',
  municipality: 'Medellín',
  neighborhood: 'Robledo',
  address: 'Carrera 80 # 75-32',
  latitude: 6.2442,
  longitude: -75.5812,
  altitude: 1540,
  createdAt: '2024-01-01T00:00:00.000Z',
  updatedAt: '2024-01-01T00:00:00.000Z'
};

const mockListDTO: LocationListResponseDTO = {
  items: [mockLocationDTO],
  total: 1,
  limit: 20,
  offset: 0,
  hasMore: false
};

// ---------------------------------------------------------------------------

describe('LocationController', () => {
  let controller: LocationController;
  let mockCreateUseCase: CreateLocationUseCase;
  let mockGetUseCase: GetLocationUseCase;
  let mockListUseCase: ListLocationsUseCase;
  let mockUpdateUseCase: UpdateLocationUseCase;
  let mockLogger: jest.Mocked<ILogger>;

  beforeEach(() => {
    mockCreateUseCase = createMockCreateUseCase();
    mockGetUseCase = createMockGetUseCase();
    mockListUseCase = createMockListUseCase();
    mockUpdateUseCase = createMockUpdateUseCase();
    mockLogger = createMockLogger();

    controller = new LocationController(
      mockCreateUseCase,
      mockGetUseCase,
      mockListUseCase,
      mockUpdateUseCase,
      mockLogger
    );
  });

  afterEach(() => {
    jest.clearAllMocks();
  });

  // =========================================================================
  describe('create (POST /api/locations)', () => {
    const validBody = {
      name: 'Torre Norte',
      type: 'TOWER',
      municipality: 'Medellín',
      neighborhood: null,
      address: null,
      latitude: null,
      longitude: null,
      altitude: undefined
    };

    // -----------------------------------------------------------------------
    describe('Happy Path', () => {
      it('should return 201 with success: true and data on successful creation', async () => {
        const mockReq = createMockRequest({ body: validBody });
        const { res, statusMock, jsonMock } = createMockResponse();

        (mockCreateUseCase.execute as jest.Mock).mockResolvedValue(
          Result.ok(mockLocationDTO)
        );

        await controller.create(mockReq as Request, res as Response);

        expect(statusMock).toHaveBeenCalledWith(201);
        expect(jsonMock).toHaveBeenCalledWith({
          success: true,
          data: mockLocationDTO
        });
      });

      it('should pass the mapped DTO fields to the use case', async () => {
        const body = {
          name: 'DataCenter Sul',
          type: 'DATACENTER',
          municipality: 'São Paulo',
          neighborhood: 'Centro',
          address: 'Av. Paulista, 1000',
          latitude: -23.561684,
          longitude: -46.655981,
          altitude: 760
        };
        const mockReq = createMockRequest({ body });
        const { res } = createMockResponse();

        (mockCreateUseCase.execute as jest.Mock).mockResolvedValue(
          Result.ok(mockLocationDTO)
        );

        await controller.create(mockReq as Request, res as Response);

        expect(mockCreateUseCase.execute).toHaveBeenCalledWith(
          expect.objectContaining({
            name: 'DataCenter Sul',
            type: 'DATACENTER',
            latitude: -23.561684,
            longitude: -46.655981,
            altitude: 760
          })
        );
      });

      it('should substitute null for missing optional body fields', async () => {
        const mockReq = createMockRequest({
          body: { name: 'POP Alpha', type: 'POP' }
        });
        const { res } = createMockResponse();

        (mockCreateUseCase.execute as jest.Mock).mockResolvedValue(
          Result.ok(mockLocationDTO)
        );

        await controller.create(mockReq as Request, res as Response);

        expect(mockCreateUseCase.execute).toHaveBeenCalledWith(
          expect.objectContaining({
            municipality: null,
            neighborhood: null,
            address: null,
            latitude: null,
            longitude: null
          })
        );
      });
    });

    // -----------------------------------------------------------------------
    describe('Error Path — 404 Not Found', () => {
      it('should return 404 when the use case fails with "not found"', async () => {
        const mockReq = createMockRequest({ body: validBody });
        const { res, statusMock, jsonMock } = createMockResponse();

        (mockCreateUseCase.execute as jest.Mock).mockResolvedValue(
          Result.fail('Location not found')
        );

        await controller.create(mockReq as Request, res as Response);

        expect(statusMock).toHaveBeenCalledWith(404);
        expect(jsonMock).toHaveBeenCalledWith({
          success: false,
          error: 'Location not found'
        });
      });
    });

    // -----------------------------------------------------------------------
    describe('Error Path — 400 Bad Request', () => {
      it('should return 400 when the use case fails with "Invalid"', async () => {
        const mockReq = createMockRequest({ body: validBody });
        const { res, statusMock, jsonMock } = createMockResponse();

        (mockCreateUseCase.execute as jest.Mock).mockResolvedValue(
          Result.fail('Invalid location type: UNKNOWN')
        );

        await controller.create(mockReq as Request, res as Response);

        expect(statusMock).toHaveBeenCalledWith(400);
        expect(jsonMock).toHaveBeenCalledWith({
          success: false,
          error: 'Invalid location type: UNKNOWN'
        });
      });

      it('should return 400 when the use case fails with lowercase "invalid"', async () => {
        const mockReq = createMockRequest({ body: validBody });
        const { res, statusMock } = createMockResponse();

        (mockCreateUseCase.execute as jest.Mock).mockResolvedValue(
          Result.fail('invalid coordinates provided')
        );

        await controller.create(mockReq as Request, res as Response);

        expect(statusMock).toHaveBeenCalledWith(400);
      });

      it('should return 400 when the use case fails with "cannot be empty"', async () => {
        const mockReq = createMockRequest({ body: validBody });
        const { res, statusMock } = createMockResponse();

        (mockCreateUseCase.execute as jest.Mock).mockResolvedValue(
          Result.fail('Location name cannot be empty')
        );

        await controller.create(mockReq as Request, res as Response);

        expect(statusMock).toHaveBeenCalledWith(400);
      });

      it('should return 400 when the use case fails with "must be"', async () => {
        const mockReq = createMockRequest({ body: validBody });
        const { res, statusMock } = createMockResponse();

        (mockCreateUseCase.execute as jest.Mock).mockResolvedValue(
          Result.fail('Latitude must be between -90 and 90')
        );

        await controller.create(mockReq as Request, res as Response);

        expect(statusMock).toHaveBeenCalledWith(400);
      });

      it('should return 400 when the use case fails with "required"', async () => {
        const mockReq = createMockRequest({ body: validBody });
        const { res, statusMock } = createMockResponse();

        (mockCreateUseCase.execute as jest.Mock).mockResolvedValue(
          Result.fail('Location name is required')
        );

        await controller.create(mockReq as Request, res as Response);

        expect(statusMock).toHaveBeenCalledWith(400);
      });

      it('should return 400 when the use case fails with "must not exceed"', async () => {
        const mockReq = createMockRequest({ body: validBody });
        const { res, statusMock } = createMockResponse();

        (mockCreateUseCase.execute as jest.Mock).mockResolvedValue(
          Result.fail('Name must not exceed 150 characters')
        );

        await controller.create(mockReq as Request, res as Response);

        expect(statusMock).toHaveBeenCalledWith(400);
      });

      it('should return 400 when the use case fails with "At least one"', async () => {
        const mockReq = createMockRequest({ body: validBody });
        const { res, statusMock } = createMockResponse();

        (mockCreateUseCase.execute as jest.Mock).mockResolvedValue(
          Result.fail('At least one address field must be provided')
        );

        await controller.create(mockReq as Request, res as Response);

        expect(statusMock).toHaveBeenCalledWith(400);
      });
    });

    // -----------------------------------------------------------------------
    describe('Error Path — 500 Internal Server Error (use case Result failure)', () => {
      it('should return 500 when the use case fails with an unrecognised message', async () => {
        const mockReq = createMockRequest({ body: validBody });
        const { res, statusMock, jsonMock } = createMockResponse();

        (mockCreateUseCase.execute as jest.Mock).mockResolvedValue(
          Result.fail('Database connection refused')
        );

        await controller.create(mockReq as Request, res as Response);

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
        const mockReq = createMockRequest({ body: validBody });
        const { res, statusMock, jsonMock } = createMockResponse();

        (mockCreateUseCase.execute as jest.Mock).mockRejectedValue(
          thrownError
        );

        await controller.create(mockReq as Request, res as Response);

        expect(statusMock).toHaveBeenCalledWith(500);
        expect(jsonMock).toHaveBeenCalledWith({
          success: false,
          error: 'Internal server error'
        });
        expect(mockLogger.error).toHaveBeenCalledWith(
          'Unexpected error in LocationController',
          thrownError,
          { error: 'Unexpected DB crash' }
        );
      });

      it('should return the generic "Internal server error" message (no details leaked)', async () => {
        const sensitiveError = new Error('SELECT * FROM locations; -- injected');
        const mockReq = createMockRequest({ body: validBody });
        const { res, jsonMock } = createMockResponse();

        (mockCreateUseCase.execute as jest.Mock).mockRejectedValue(
          sensitiveError
        );

        await controller.create(mockReq as Request, res as Response);

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
        const mockReq = createMockRequest({ body: validBody });
        const { res, statusMock } = createMockResponse();

        (mockCreateUseCase.execute as jest.Mock).mockRejectedValue(
          'string exception'
        );

        await controller.create(mockReq as Request, res as Response);

        expect(statusMock).toHaveBeenCalledWith(500);
        expect(mockLogger.error).toHaveBeenCalledWith(
          'Unexpected error in LocationController',
          'string exception',
          { error: 'string exception' }
        );
      });

      it('should handle a thrown null gracefully', async () => {
        const mockReq = createMockRequest({ body: validBody });
        const { res, statusMock, jsonMock } = createMockResponse();

        (mockCreateUseCase.execute as jest.Mock).mockRejectedValue(null);

        await controller.create(mockReq as Request, res as Response);

        expect(statusMock).toHaveBeenCalledWith(500);
        expect(jsonMock).toHaveBeenCalledWith({
          success: false,
          error: 'Internal server error'
        });
      });
    });
  });

  // =========================================================================
  describe('list (GET /api/locations)', () => {
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

      it('should pass undefined for limit and offset when they are absent from query', async () => {
        const mockReq = createMockRequest({ query: {} });
        const { res } = createMockResponse();

        (mockListUseCase.execute as jest.Mock).mockResolvedValue(
          Result.ok(mockListDTO)
        );

        await controller.list(mockReq as Request, res as Response);

        expect(mockListUseCase.execute).toHaveBeenCalledWith(
          expect.objectContaining({
            limit: undefined,
            offset: undefined
          })
        );
      });

      it('should forward the type query parameter as-is to the use case', async () => {
        const mockReq = createMockRequest({
          query: { type: 'TOWER' }
        });
        const { res } = createMockResponse();

        (mockListUseCase.execute as jest.Mock).mockResolvedValue(
          Result.ok(mockListDTO)
        );

        await controller.list(mockReq as Request, res as Response);

        expect(mockListUseCase.execute).toHaveBeenCalledWith(
          expect.objectContaining({ type: 'TOWER' })
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
      it('should return 400 when the use case fails with "Invalid" type filter', async () => {
        const mockReq = createMockRequest({ query: { type: 'UNKNOWN' } });
        const { res, statusMock, jsonMock } = createMockResponse();

        (mockListUseCase.execute as jest.Mock).mockResolvedValue(
          Result.fail('Invalid location type: "UNKNOWN"')
        );

        await controller.list(mockReq as Request, res as Response);

        expect(statusMock).toHaveBeenCalledWith(400);
        expect(jsonMock).toHaveBeenCalledWith({
          success: false,
          error: 'Invalid location type: "UNKNOWN"'
        });
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
          'Unexpected error in LocationController',
          thrownError,
          { error: 'Connection pool exhausted' }
        );
      });
    });
  });

  // =========================================================================
  describe('getById (GET /api/locations/:id)', () => {
    // -----------------------------------------------------------------------
    describe('Happy Path', () => {
      it('should return 200 with success: true and data when location is found', async () => {
        const mockReq = createMockRequest({ params: { id: VALID_UUID } });
        const { res, statusMock, jsonMock } = createMockResponse();

        (mockGetUseCase.execute as jest.Mock).mockResolvedValue(
          Result.ok(mockLocationDTO)
        );

        await controller.getById(mockReq as Request, res as Response);

        expect(statusMock).toHaveBeenCalledWith(200);
        expect(jsonMock).toHaveBeenCalledWith({
          success: true,
          data: mockLocationDTO
        });
      });

      it('should pass req.params.id to the use case', async () => {
        const mockReq = createMockRequest({ params: { id: VALID_UUID } });
        const { res } = createMockResponse();

        (mockGetUseCase.execute as jest.Mock).mockResolvedValue(
          Result.ok(mockLocationDTO)
        );

        await controller.getById(mockReq as Request, res as Response);

        expect(mockGetUseCase.execute).toHaveBeenCalledWith({
          id: VALID_UUID
        });
      });
    });

    // -----------------------------------------------------------------------
    describe('Error Path — 404 Not Found', () => {
      it('should return 404 when the use case fails with "not found"', async () => {
        const mockReq = createMockRequest({ params: { id: VALID_UUID } });
        const { res, statusMock, jsonMock } = createMockResponse();

        (mockGetUseCase.execute as jest.Mock).mockResolvedValue(
          Result.fail(`Location not found: ${VALID_UUID}`)
        );

        await controller.getById(mockReq as Request, res as Response);

        expect(statusMock).toHaveBeenCalledWith(404);
        expect(jsonMock).toHaveBeenCalledWith({
          success: false,
          error: `Location not found: ${VALID_UUID}`
        });
      });
    });

    // -----------------------------------------------------------------------
    describe('Error Path — 400 Bad Request', () => {
      it('should return 400 when the use case fails with "Invalid" ID format', async () => {
        const mockReq = createMockRequest({ params: { id: 'bad-id' } });
        const { res, statusMock } = createMockResponse();

        (mockGetUseCase.execute as jest.Mock).mockResolvedValue(
          Result.fail('Invalid location ID: bad-id')
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
          'Unexpected error in LocationController',
          thrownError,
          { error: 'Unexpected error' }
        );
      });
    });
  });

  // =========================================================================
  describe('getErrorStatusCode (exercised through all endpoint methods)', () => {
    /**
     * These tests verify the private getErrorStatusCode helper indirectly
     * by observing the HTTP status produced by each public method.
     */

    it('should prioritise "not found" over "Invalid" when both appear in the message', async () => {
      // "not found" is checked first in the implementation
      const mockReq = createMockRequest({ params: { id: VALID_UUID } });
      const { res, statusMock } = createMockResponse();

      (mockGetUseCase.execute as jest.Mock).mockResolvedValue(
        Result.fail('Invalid resource not found in database')
      );

      await controller.getById(mockReq as Request, res as Response);

      expect(statusMock).toHaveBeenCalledWith(404);
    });

    it('should map "must be" to 400', async () => {
      const mockReq = createMockRequest({ query: {} });
      const { res, statusMock } = createMockResponse();

      (mockListUseCase.execute as jest.Mock).mockResolvedValue(
        Result.fail('Offset must be a non-negative integer')
      );

      await controller.list(mockReq as Request, res as Response);

      expect(statusMock).toHaveBeenCalledWith(400);
    });

    it('should default to 500 for messages that match no known keyword', async () => {
      const mockReq = createMockRequest({ body: {} });
      const { res, statusMock } = createMockResponse();

      (mockCreateUseCase.execute as jest.Mock).mockResolvedValue(
        Result.fail('Something completely unknown happened')
      );

      await controller.create(mockReq as Request, res as Response);

      expect(statusMock).toHaveBeenCalledWith(500);
    });
  });

  // =========================================================================
  describe('handleUnexpectedError (exercised through all endpoint methods)', () => {
    it('should extract the message from an Error instance', async () => {
      const error = new Error('Exact message');
      const mockReq = createMockRequest({ body: {} });
      const { res } = createMockResponse();

      (mockCreateUseCase.execute as jest.Mock).mockRejectedValue(error);

      await controller.create(mockReq as Request, res as Response);

      expect(mockLogger.error).toHaveBeenCalledWith(
        'Unexpected error in LocationController',
        error,
        { error: 'Exact message' }
      );
    });

    it('should convert a numeric thrown value to a string', async () => {
      const mockReq = createMockRequest({ body: {} });
      const { res } = createMockResponse();

      (mockCreateUseCase.execute as jest.Mock).mockRejectedValue(42);

      await controller.create(mockReq as Request, res as Response);

      expect(mockLogger.error).toHaveBeenCalledWith(
        'Unexpected error in LocationController',
        42,
        { error: '42' }
      );
    });
  });

  // =========================================================================
  describe('update (PATCH /api/locations/:id)', () => {
    // -----------------------------------------------------------------------
    describe('Happy Path', () => {
      it('should return 200 with success: true and data on successful update', async () => {
        const mockReq = createMockRequest({
          params: { id: VALID_UUID },
          body: { name: 'Torre Norte Revised' }
        });
        const { res, statusMock, jsonMock } = createMockResponse();

        (mockUpdateUseCase.execute as jest.Mock).mockResolvedValue(
          Result.ok(mockLocationDTO)
        );

        await controller.update(mockReq as Request, res as Response);

        expect(statusMock).toHaveBeenCalledWith(200);
        expect(jsonMock).toHaveBeenCalledWith({
          success: true,
          data: mockLocationDTO
        });
      });

      it('should merge req.params.id into the DTO passed to the use case', async () => {
        const mockReq = createMockRequest({
          params: { id: VALID_UUID },
          body: { name: 'Torre Norte Revised' }
        });
        const { res } = createMockResponse();

        (mockUpdateUseCase.execute as jest.Mock).mockResolvedValue(
          Result.ok(mockLocationDTO)
        );

        await controller.update(mockReq as Request, res as Response);

        expect(mockUpdateUseCase.execute).toHaveBeenCalledWith(
          expect.objectContaining({ id: VALID_UUID, name: 'Torre Norte Revised' })
        );
      });

      it('should forward all optional body fields to the use case', async () => {
        const mockReq = createMockRequest({
          params: { id: VALID_UUID },
          body: {
            name: 'DataCenter Sul',
            type: 'DATACENTER',
            municipality: 'São Paulo',
            neighborhood: 'Centro',
            address: 'Av. Paulista, 1000',
            latitude: -23.561684,
            longitude: -46.655981,
            altitude: 760
          }
        });
        const { res } = createMockResponse();

        (mockUpdateUseCase.execute as jest.Mock).mockResolvedValue(
          Result.ok(mockLocationDTO)
        );

        await controller.update(mockReq as Request, res as Response);

        expect(mockUpdateUseCase.execute).toHaveBeenCalledWith(
          expect.objectContaining({
            id: VALID_UUID,
            name: 'DataCenter Sul',
            type: 'DATACENTER',
            municipality: 'São Paulo',
            neighborhood: 'Centro',
            address: 'Av. Paulista, 1000',
            latitude: -23.561684,
            longitude: -46.655981,
            altitude: 760
          })
        );
      });

      it('should forward null coordinates to use case (explicit coordinate clear)', async () => {
        const mockReq = createMockRequest({
          params: { id: VALID_UUID },
          body: { latitude: null, longitude: null }
        });
        const { res } = createMockResponse();

        (mockUpdateUseCase.execute as jest.Mock).mockResolvedValue(
          Result.ok(mockLocationDTO)
        );

        await controller.update(mockReq as Request, res as Response);

        expect(mockUpdateUseCase.execute).toHaveBeenCalledWith(
          expect.objectContaining({
            id: VALID_UUID,
            latitude: null,
            longitude: null
          })
        );
      });

      it('should accept an empty body (no-op update)', async () => {
        const mockReq = createMockRequest({
          params: { id: VALID_UUID },
          body: {}
        });
        const { res, statusMock } = createMockResponse();

        (mockUpdateUseCase.execute as jest.Mock).mockResolvedValue(
          Result.ok(mockLocationDTO)
        );

        await controller.update(mockReq as Request, res as Response);

        expect(statusMock).toHaveBeenCalledWith(200);
        expect(mockUpdateUseCase.execute).toHaveBeenCalledWith(
          expect.objectContaining({ id: VALID_UUID })
        );
      });
    });

    // -----------------------------------------------------------------------
    describe('Error Path — 404 Not Found', () => {
      it('should return 404 when the use case fails with "not found"', async () => {
        const mockReq = createMockRequest({
          params: { id: VALID_UUID },
          body: { name: 'New Name' }
        });
        const { res, statusMock, jsonMock } = createMockResponse();

        (mockUpdateUseCase.execute as jest.Mock).mockResolvedValue(
          Result.fail(`Location not found: ${VALID_UUID}`)
        );

        await controller.update(mockReq as Request, res as Response);

        expect(statusMock).toHaveBeenCalledWith(404);
        expect(jsonMock).toHaveBeenCalledWith({
          success: false,
          error: `Location not found: ${VALID_UUID}`
        });
      });
    });

    // -----------------------------------------------------------------------
    describe('Error Path — 400 Bad Request', () => {
      it('should return 400 when the use case fails with "Invalid" (invalid ID)', async () => {
        const mockReq = createMockRequest({
          params: { id: 'bad-id' },
          body: {}
        });
        const { res, statusMock } = createMockResponse();

        (mockUpdateUseCase.execute as jest.Mock).mockResolvedValue(
          Result.fail('Invalid location ID: bad-id')
        );

        await controller.update(mockReq as Request, res as Response);

        expect(statusMock).toHaveBeenCalledWith(400);
      });

      it('should return 400 when the use case fails with "invalid" (lowercase — invalid type)', async () => {
        const mockReq = createMockRequest({
          params: { id: VALID_UUID },
          body: { type: 'UNKNOWN' }
        });
        const { res, statusMock } = createMockResponse();

        (mockUpdateUseCase.execute as jest.Mock).mockResolvedValue(
          Result.fail('invalid location type: "UNKNOWN"')
        );

        await controller.update(mockReq as Request, res as Response);

        expect(statusMock).toHaveBeenCalledWith(400);
      });

      it('should return 400 when the use case fails with "must be" (coordinate range)', async () => {
        const mockReq = createMockRequest({
          params: { id: VALID_UUID },
          body: { latitude: 200, longitude: 0 }
        });
        const { res, statusMock } = createMockResponse();

        (mockUpdateUseCase.execute as jest.Mock).mockResolvedValue(
          Result.fail('Latitude must be between -90 and 90')
        );

        await controller.update(mockReq as Request, res as Response);

        expect(statusMock).toHaveBeenCalledWith(400);
      });
    });

    // -----------------------------------------------------------------------
    describe('Error Path — 500 Internal Server Error (use case Result failure)', () => {
      it('should return 500 when the use case fails with an unrecognised message', async () => {
        const mockReq = createMockRequest({
          params: { id: VALID_UUID },
          body: { name: 'New Name' }
        });
        const { res, statusMock, jsonMock } = createMockResponse();

        (mockUpdateUseCase.execute as jest.Mock).mockResolvedValue(
          Result.fail('Database write timeout')
        );

        await controller.update(mockReq as Request, res as Response);

        expect(statusMock).toHaveBeenCalledWith(500);
        expect(jsonMock).toHaveBeenCalledWith({
          success: false,
          error: 'Database write timeout'
        });
      });
    });

    // -----------------------------------------------------------------------
    describe('Error Path — 500 Internal Server Error (unexpected thrown exception)', () => {
      it('should return 500 and log the error when the use case throws', async () => {
        const thrownError = new Error('Unexpected DB crash');
        const mockReq = createMockRequest({
          params: { id: VALID_UUID },
          body: { name: 'New Name' }
        });
        const { res, statusMock, jsonMock } = createMockResponse();

        (mockUpdateUseCase.execute as jest.Mock).mockRejectedValue(thrownError);

        await controller.update(mockReq as Request, res as Response);

        expect(statusMock).toHaveBeenCalledWith(500);
        expect(jsonMock).toHaveBeenCalledWith({
          success: false,
          error: 'Internal server error'
        });
        expect(mockLogger.error).toHaveBeenCalledWith(
          'Unexpected error in LocationController',
          thrownError,
          { error: 'Unexpected DB crash' }
        );
      });

      it('should not leak sensitive error details in the response body', async () => {
        const sensitiveError = new Error('SELECT * FROM locations; -- injected');
        const mockReq = createMockRequest({
          params: { id: VALID_UUID },
          body: {}
        });
        const { res, jsonMock } = createMockResponse();

        (mockUpdateUseCase.execute as jest.Mock).mockRejectedValue(
          sensitiveError
        );

        await controller.update(mockReq as Request, res as Response);

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
    });
  });
});
