// Source: src/presentation/http/controllers/DeviceController.ts

import { Request, Response } from 'express';
import { DeviceController } from '../../../../src/presentation/http/controllers/DeviceController';
import { CreateDeviceUseCase } from '../../../../src/application/device-inventory/use-cases/CreateDeviceUseCase';
import { GetDeviceUseCase } from '../../../../src/application/device-inventory/use-cases/GetDeviceUseCase';
import { ListDevicesUseCase } from '../../../../src/application/device-inventory/use-cases/ListDevicesUseCase';
import { UpdateDeviceUseCase } from '../../../../src/application/device-inventory/use-cases/UpdateDeviceUseCase';
import { ILogger } from '../../../../src/application/shared/interfaces/ILogger';
import { Result } from '../../../../src/domain/shared/core/Result';

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

/** Minimal DeviceResponseDTO shape returned by use cases. */
interface DeviceResponseDTO {
  id: string;
  deviceModelId: string;
  locationId: string | null;
  status: string;
  category: string | null;
  ownerType: string;
  name: string;
  serialNumber: string | null;
  macAddress: string | null;
  ipAddress: string | null;
  description: string | null;
  installedDate: string | null;
  monitoringEnabled: boolean;
  createdAt: string;
  updatedAt: string;
}

/** Minimal DeviceListResponseDTO shape returned by ListDevicesUseCase. */
interface DeviceListResponseDTO {
  items: DeviceResponseDTO[];
  total: number;
  limit: number;
  offset: number;
  hasMore: boolean;
}

// ---------------------------------------------------------------------------
// Mock factories
// ---------------------------------------------------------------------------

const createMockCreateUseCase = () =>
  ({ execute: jest.fn() }) as unknown as CreateDeviceUseCase;

const createMockGetUseCase = () =>
  ({ execute: jest.fn() }) as unknown as GetDeviceUseCase;

const createMockListUseCase = () =>
  ({ execute: jest.fn() }) as unknown as ListDevicesUseCase;

const createMockUpdateUseCase = () =>
  ({ execute: jest.fn() }) as unknown as UpdateDeviceUseCase;

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
const MODEL_UUID = '550e8400-e29b-41d4-a716-446655440000';

const mockDeviceDTO: DeviceResponseDTO = {
  id: VALID_UUID,
  deviceModelId: MODEL_UUID,
  locationId: null,
  status: 'INVENTORY',
  category: 'CORE',
  ownerType: 'COMPANY',
  name: 'Core-Router-01',
  serialNumber: 'SN-2024-XYZ-001',
  macAddress: 'AA:BB:CC:DD:EE:FF',
  ipAddress: '192.168.1.1',
  description: 'Primary core router',
  installedDate: '2024-01-15T00:00:00.000Z',
  monitoringEnabled: true,
  createdAt: '2024-01-15T10:30:00.000Z',
  updatedAt: '2024-01-15T10:30:00.000Z'
};

const mockListDTO: DeviceListResponseDTO = {
  items: [mockDeviceDTO],
  total: 1,
  limit: 20,
  offset: 0,
  hasMore: false
};

// ---------------------------------------------------------------------------

describe('DeviceController', () => {
  let controller: DeviceController;
  let mockCreateUseCase: CreateDeviceUseCase;
  let mockGetUseCase: GetDeviceUseCase;
  let mockListUseCase: ListDevicesUseCase;
  let mockUpdateUseCase: UpdateDeviceUseCase;
  let mockLogger: jest.Mocked<ILogger>;

  beforeEach(() => {
    mockCreateUseCase = createMockCreateUseCase();
    mockGetUseCase = createMockGetUseCase();
    mockListUseCase = createMockListUseCase();
    mockUpdateUseCase = createMockUpdateUseCase();
    mockLogger = createMockLogger();

    controller = new DeviceController(
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
  describe('create (POST /api/devices)', () => {
    const validBody = {
      deviceModelId: MODEL_UUID,
      name: 'Core-Router-01',
      ownerType: 'COMPANY'
    };

    // -----------------------------------------------------------------------
    describe('Happy Path', () => {
      it('should return 201 with success: true and data on successful creation', async () => {
        const mockReq = createMockRequest({ body: validBody });
        const { res, statusMock, jsonMock } = createMockResponse();

        (mockCreateUseCase.execute as jest.Mock).mockResolvedValue(
          Result.ok(mockDeviceDTO)
        );

        await controller.create(mockReq as Request, res as Response);

        expect(statusMock).toHaveBeenCalledWith(201);
        expect(jsonMock).toHaveBeenCalledWith({
          success: true,
          data: mockDeviceDTO
        });
      });

      it('should pass all required DTO fields to the use case', async () => {
        const mockReq = createMockRequest({ body: validBody });
        const { res } = createMockResponse();

        (mockCreateUseCase.execute as jest.Mock).mockResolvedValue(
          Result.ok(mockDeviceDTO)
        );

        await controller.create(mockReq as Request, res as Response);

        expect(mockCreateUseCase.execute).toHaveBeenCalledWith(
          expect.objectContaining({
            deviceModelId: MODEL_UUID,
            name: 'Core-Router-01',
            ownerType: 'COMPANY'
          })
        );
      });

      it('should pass all optional fields when provided in the body', async () => {
        const fullBody = {
          deviceModelId: MODEL_UUID,
          name: 'Core-Router-01',
          ownerType: 'COMPANY',
          status: 'ACTIVE',
          category: 'CORE',
          locationId: VALID_UUID,
          serialNumber: 'SN-2024-XYZ-001',
          macAddress: 'AA:BB:CC:DD:EE:FF',
          ipAddress: '192.168.1.1',
          description: 'Primary core router',
          installedDate: '2024-01-15T00:00:00.000Z',
          monitoringEnabled: true
        };
        const mockReq = createMockRequest({ body: fullBody });
        const { res } = createMockResponse();

        (mockCreateUseCase.execute as jest.Mock).mockResolvedValue(
          Result.ok(mockDeviceDTO)
        );

        await controller.create(mockReq as Request, res as Response);

        expect(mockCreateUseCase.execute).toHaveBeenCalledWith(
          expect.objectContaining({
            status: 'ACTIVE',
            category: 'CORE',
            locationId: VALID_UUID,
            serialNumber: 'SN-2024-XYZ-001',
            macAddress: 'AA:BB:CC:DD:EE:FF',
            ipAddress: '192.168.1.1',
            description: 'Primary core router',
            installedDate: '2024-01-15T00:00:00.000Z',
            monitoringEnabled: true
          })
        );
      });

      it('should substitute null for missing optional body fields', async () => {
        const mockReq = createMockRequest({ body: validBody });
        const { res } = createMockResponse();

        (mockCreateUseCase.execute as jest.Mock).mockResolvedValue(
          Result.ok(mockDeviceDTO)
        );

        await controller.create(mockReq as Request, res as Response);

        expect(mockCreateUseCase.execute).toHaveBeenCalledWith(
          expect.objectContaining({
            category: null,
            locationId: null,
            serialNumber: null,
            macAddress: null,
            ipAddress: null,
            description: null,
            installedDate: null
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
          Result.fail('Device not found')
        );

        await controller.create(mockReq as Request, res as Response);

        expect(statusMock).toHaveBeenCalledWith(404);
        expect(jsonMock).toHaveBeenCalledWith({
          success: false,
          error: 'Device not found'
        });
      });
    });

    // -----------------------------------------------------------------------
    describe('Error Path — 400 Bad Request', () => {
      it('should return 400 when the use case fails with "Invalid"', async () => {
        const mockReq = createMockRequest({ body: validBody });
        const { res, statusMock, jsonMock } = createMockResponse();

        (mockCreateUseCase.execute as jest.Mock).mockResolvedValue(
          Result.fail('Invalid deviceModelId: not-a-uuid')
        );

        await controller.create(mockReq as Request, res as Response);

        expect(statusMock).toHaveBeenCalledWith(400);
        expect(jsonMock).toHaveBeenCalledWith({
          success: false,
          error: 'Invalid deviceModelId: not-a-uuid'
        });
      });

      it('should return 400 when the use case fails with "cannot be empty"', async () => {
        const mockReq = createMockRequest({ body: validBody });
        const { res, statusMock } = createMockResponse();

        (mockCreateUseCase.execute as jest.Mock).mockResolvedValue(
          Result.fail('Device name cannot be empty')
        );

        await controller.create(mockReq as Request, res as Response);

        expect(statusMock).toHaveBeenCalledWith(400);
      });

      it('should return 400 when the use case fails with "required"', async () => {
        const mockReq = createMockRequest({ body: validBody });
        const { res, statusMock } = createMockResponse();

        (mockCreateUseCase.execute as jest.Mock).mockResolvedValue(
          Result.fail('deviceModelId is required')
        );

        await controller.create(mockReq as Request, res as Response);

        expect(statusMock).toHaveBeenCalledWith(400);
      });

      it('should return 400 when the use case fails with "must be"', async () => {
        const mockReq = createMockRequest({ body: validBody });
        const { res, statusMock } = createMockResponse();

        (mockCreateUseCase.execute as jest.Mock).mockResolvedValue(
          Result.fail('ownerType must be one of: COMPANY, CLIENT')
        );

        await controller.create(mockReq as Request, res as Response);

        expect(statusMock).toHaveBeenCalledWith(400);
      });

      it('should return 400 when the use case fails with "already assigned" (duplicate MAC)', async () => {
        const mockReq = createMockRequest({ body: validBody });
        const { res, statusMock, jsonMock } = createMockResponse();

        (mockCreateUseCase.execute as jest.Mock).mockResolvedValue(
          Result.fail(
            'MAC address "AA:BB:CC:DD:EE:FF" is already assigned to another device'
          )
        );

        await controller.create(mockReq as Request, res as Response);

        expect(statusMock).toHaveBeenCalledWith(400);
        expect(jsonMock).toHaveBeenCalledWith({
          success: false,
          error: 'MAC address "AA:BB:CC:DD:EE:FF" is already assigned to another device'
        });
      });

      it('should return 400 when the use case fails with "already assigned" (duplicate IP)', async () => {
        const mockReq = createMockRequest({ body: validBody });
        const { res, statusMock } = createMockResponse();

        (mockCreateUseCase.execute as jest.Mock).mockResolvedValue(
          Result.fail(
            'IP address "192.168.1.1" is already assigned to another device'
          )
        );

        await controller.create(mockReq as Request, res as Response);

        expect(statusMock).toHaveBeenCalledWith(400);
      });

      it('should return 400 when the use case fails with "invalid" (lowercase)', async () => {
        const mockReq = createMockRequest({ body: validBody });
        const { res, statusMock } = createMockResponse();

        (mockCreateUseCase.execute as jest.Mock).mockResolvedValue(
          Result.fail('invalid MAC address format')
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

        (mockCreateUseCase.execute as jest.Mock).mockRejectedValue(thrownError);

        await controller.create(mockReq as Request, res as Response);

        expect(statusMock).toHaveBeenCalledWith(500);
        expect(jsonMock).toHaveBeenCalledWith({
          success: false,
          error: 'Internal server error'
        });
        expect(mockLogger.error).toHaveBeenCalledWith(
          'Unexpected error in DeviceController',
          thrownError,
          { error: 'Unexpected DB crash' }
        );
      });

      it('should not leak sensitive error details in the response body', async () => {
        const sensitiveError = new Error('SELECT * FROM devices; -- injected');
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
          'Unexpected error in DeviceController',
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
  describe('list (GET /api/devices)', () => {
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

      it('should convert limit and offset query strings to numbers', async () => {
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
          expect.objectContaining({
            limit: undefined,
            offset: undefined
          })
        );
      });

      it('should forward status, category, and owner filter params to the use case', async () => {
        const mockReq = createMockRequest({
          query: { status: 'ACTIVE', category: 'CORE', owner: 'COMPANY' }
        });
        const { res } = createMockResponse();

        (mockListUseCase.execute as jest.Mock).mockResolvedValue(
          Result.ok(mockListDTO)
        );

        await controller.list(mockReq as Request, res as Response);

        expect(mockListUseCase.execute).toHaveBeenCalledWith(
          expect.objectContaining({
            status: 'ACTIVE',
            category: 'CORE',
            owner: 'COMPANY'
          })
        );
      });

      it('should forward locationId and deviceModelId UUID filters to the use case', async () => {
        const mockReq = createMockRequest({
          query: { locationId: VALID_UUID, deviceModelId: MODEL_UUID }
        });
        const { res } = createMockResponse();

        (mockListUseCase.execute as jest.Mock).mockResolvedValue(
          Result.ok(mockListDTO)
        );

        await controller.list(mockReq as Request, res as Response);

        expect(mockListUseCase.execute).toHaveBeenCalledWith(
          expect.objectContaining({
            locationId: VALID_UUID,
            deviceModelId: MODEL_UUID
          })
        );
      });

      it('should convert monitoringEnabled "true" string to boolean true', async () => {
        const mockReq = createMockRequest({
          query: { monitoringEnabled: 'true' }
        });
        const { res } = createMockResponse();

        (mockListUseCase.execute as jest.Mock).mockResolvedValue(
          Result.ok(mockListDTO)
        );

        await controller.list(mockReq as Request, res as Response);

        expect(mockListUseCase.execute).toHaveBeenCalledWith(
          expect.objectContaining({ monitoringEnabled: true })
        );
      });

      it('should convert monitoringEnabled "false" string to boolean false', async () => {
        const mockReq = createMockRequest({
          query: { monitoringEnabled: 'false' }
        });
        const { res } = createMockResponse();

        (mockListUseCase.execute as jest.Mock).mockResolvedValue(
          Result.ok(mockListDTO)
        );

        await controller.list(mockReq as Request, res as Response);

        expect(mockListUseCase.execute).toHaveBeenCalledWith(
          expect.objectContaining({ monitoringEnabled: false })
        );
      });

      it('should pass undefined for monitoringEnabled when absent from query', async () => {
        const mockReq = createMockRequest({ query: {} });
        const { res } = createMockResponse();

        (mockListUseCase.execute as jest.Mock).mockResolvedValue(
          Result.ok(mockListDTO)
        );

        await controller.list(mockReq as Request, res as Response);

        expect(mockListUseCase.execute).toHaveBeenCalledWith(
          expect.objectContaining({ monitoringEnabled: undefined })
        );
      });

      it('should forward search, sortBy, and sortOrder to the use case', async () => {
        const mockReq = createMockRequest({
          query: {
            search: 'Core-Router',
            sortBy: 'name',
            sortOrder: 'ASC'
          }
        });
        const { res } = createMockResponse();

        (mockListUseCase.execute as jest.Mock).mockResolvedValue(
          Result.ok(mockListDTO)
        );

        await controller.list(mockReq as Request, res as Response);

        expect(mockListUseCase.execute).toHaveBeenCalledWith(
          expect.objectContaining({
            search: 'Core-Router',
            sortBy: 'name',
            sortOrder: 'ASC'
          })
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
      it('should return 400 when the use case fails with "Invalid" filter', async () => {
        const mockReq = createMockRequest({
          query: { status: 'UNKNOWN' }
        });
        const { res, statusMock, jsonMock } = createMockResponse();

        (mockListUseCase.execute as jest.Mock).mockResolvedValue(
          Result.fail('Invalid status: "UNKNOWN"')
        );

        await controller.list(mockReq as Request, res as Response);

        expect(statusMock).toHaveBeenCalledWith(400);
        expect(jsonMock).toHaveBeenCalledWith({
          success: false,
          error: 'Invalid status: "UNKNOWN"'
        });
      });

      it('should return 400 when the use case fails with "must be"', async () => {
        const mockReq = createMockRequest({ query: {} });
        const { res, statusMock } = createMockResponse();

        (mockListUseCase.execute as jest.Mock).mockResolvedValue(
          Result.fail('owner must be one of: COMPANY, CLIENT')
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
          'Unexpected error in DeviceController',
          thrownError,
          { error: 'Connection pool exhausted' }
        );
      });
    });
  });

  // =========================================================================
  describe('getById (GET /api/devices/:id)', () => {
    // -----------------------------------------------------------------------
    describe('Happy Path', () => {
      it('should return 200 with success: true and data when device is found', async () => {
        const mockReq = createMockRequest({ params: { id: VALID_UUID } });
        const { res, statusMock, jsonMock } = createMockResponse();

        (mockGetUseCase.execute as jest.Mock).mockResolvedValue(
          Result.ok(mockDeviceDTO)
        );

        await controller.getById(mockReq as Request, res as Response);

        expect(statusMock).toHaveBeenCalledWith(200);
        expect(jsonMock).toHaveBeenCalledWith({
          success: true,
          data: mockDeviceDTO
        });
      });

      it('should pass req.params.id to the use case', async () => {
        const mockReq = createMockRequest({ params: { id: VALID_UUID } });
        const { res } = createMockResponse();

        (mockGetUseCase.execute as jest.Mock).mockResolvedValue(
          Result.ok(mockDeviceDTO)
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
          Result.fail(`Device not found: ${VALID_UUID}`)
        );

        await controller.getById(mockReq as Request, res as Response);

        expect(statusMock).toHaveBeenCalledWith(404);
        expect(jsonMock).toHaveBeenCalledWith({
          success: false,
          error: `Device not found: ${VALID_UUID}`
        });
      });
    });

    // -----------------------------------------------------------------------
    describe('Error Path — 400 Bad Request', () => {
      it('should return 400 when the use case fails with "Invalid" ID format', async () => {
        const mockReq = createMockRequest({ params: { id: 'bad-id' } });
        const { res, statusMock } = createMockResponse();

        (mockGetUseCase.execute as jest.Mock).mockResolvedValue(
          Result.fail('Invalid device ID: bad-id')
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
          'Unexpected error in DeviceController',
          thrownError,
          { error: 'Unexpected error' }
        );
      });
    });
  });

  // =========================================================================
  describe('getErrorStatusCode (exercised through all endpoint methods)', () => {
    it('should prioritise "not found" over "Invalid" when both appear in the message', async () => {
      const mockReq = createMockRequest({ params: { id: VALID_UUID } });
      const { res, statusMock } = createMockResponse();

      (mockGetUseCase.execute as jest.Mock).mockResolvedValue(
        Result.fail('Invalid resource not found in database')
      );

      await controller.getById(mockReq as Request, res as Response);

      expect(statusMock).toHaveBeenCalledWith(404);
    });

    it('should map "must not exceed" to 400', async () => {
      const mockReq = createMockRequest({ body: {} });
      const { res, statusMock } = createMockResponse();

      (mockCreateUseCase.execute as jest.Mock).mockResolvedValue(
        Result.fail('Serial number must not exceed 100 characters')
      );

      await controller.create(mockReq as Request, res as Response);

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
        'Unexpected error in DeviceController',
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
        'Unexpected error in DeviceController',
        42,
        { error: '42' }
      );
    });
  });

  // =========================================================================
  describe('update (PATCH /api/devices/:id)', () => {
    const LOCATION_UUID = 'a1b2c3d4-e5f6-4789-abcd-ef0123456789';

    // -----------------------------------------------------------------------
    describe('Happy Path', () => {
      it('should return 200 with success: true and data on successful update', async () => {
        const mockReq = createMockRequest({
          params: { id: VALID_UUID },
          body: { status: 'ACTIVE' }
        });
        const { res, statusMock, jsonMock } = createMockResponse();

        (mockUpdateUseCase.execute as jest.Mock).mockResolvedValue(
          Result.ok(mockDeviceDTO)
        );

        await controller.update(mockReq as Request, res as Response);

        expect(statusMock).toHaveBeenCalledWith(200);
        expect(jsonMock).toHaveBeenCalledWith({
          success: true,
          data: mockDeviceDTO
        });
      });

      it('should merge req.params.id into the DTO passed to the use case', async () => {
        const mockReq = createMockRequest({
          params: { id: VALID_UUID },
          body: { status: 'ACTIVE' }
        });
        const { res } = createMockResponse();

        (mockUpdateUseCase.execute as jest.Mock).mockResolvedValue(
          Result.ok(mockDeviceDTO)
        );

        await controller.update(mockReq as Request, res as Response);

        expect(mockUpdateUseCase.execute).toHaveBeenCalledWith(
          expect.objectContaining({ id: VALID_UUID, status: 'ACTIVE' })
        );
      });

      it('should forward all optional body fields to the use case', async () => {
        const mockReq = createMockRequest({
          params: { id: VALID_UUID },
          body: {
            name: 'Core-Router-01-Updated',
            status: 'MAINTENANCE',
            category: 'CORE',
            ownerType: 'COMPANY',
            locationId: LOCATION_UUID,
            serialNumber: 'SN-2024-XYZ-001',
            macAddress: 'AA:BB:CC:DD:EE:FF',
            ipAddress: '192.168.1.2',
            description: 'Updated description',
            installedDate: '2024-06-01T00:00:00.000Z',
            monitoringEnabled: true
          }
        });
        const { res } = createMockResponse();

        (mockUpdateUseCase.execute as jest.Mock).mockResolvedValue(
          Result.ok(mockDeviceDTO)
        );

        await controller.update(mockReq as Request, res as Response);

        expect(mockUpdateUseCase.execute).toHaveBeenCalledWith(
          expect.objectContaining({
            id: VALID_UUID,
            name: 'Core-Router-01-Updated',
            status: 'MAINTENANCE',
            category: 'CORE',
            ownerType: 'COMPANY',
            locationId: LOCATION_UUID,
            serialNumber: 'SN-2024-XYZ-001',
            macAddress: 'AA:BB:CC:DD:EE:FF',
            ipAddress: '192.168.1.2',
            description: 'Updated description',
            installedDate: '2024-06-01T00:00:00.000Z',
            monitoringEnabled: true
          })
        );
      });

      it('should forward null fields to the use case (explicit clear semantics)', async () => {
        const mockReq = createMockRequest({
          params: { id: VALID_UUID },
          body: {
            locationId: null,
            macAddress: null,
            ipAddress: null,
            serialNumber: null,
            category: null,
            description: null
          }
        });
        const { res } = createMockResponse();

        (mockUpdateUseCase.execute as jest.Mock).mockResolvedValue(
          Result.ok(mockDeviceDTO)
        );

        await controller.update(mockReq as Request, res as Response);

        expect(mockUpdateUseCase.execute).toHaveBeenCalledWith(
          expect.objectContaining({
            id: VALID_UUID,
            locationId: null,
            macAddress: null,
            ipAddress: null,
            serialNumber: null,
            category: null,
            description: null
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
          Result.ok(mockDeviceDTO)
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
          body: { status: 'ACTIVE' }
        });
        const { res, statusMock, jsonMock } = createMockResponse();

        (mockUpdateUseCase.execute as jest.Mock).mockResolvedValue(
          Result.fail(`Device not found: ${VALID_UUID}`)
        );

        await controller.update(mockReq as Request, res as Response);

        expect(statusMock).toHaveBeenCalledWith(404);
        expect(jsonMock).toHaveBeenCalledWith({
          success: false,
          error: `Device not found: ${VALID_UUID}`
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
          Result.fail('Invalid device ID: bad-id')
        );

        await controller.update(mockReq as Request, res as Response);

        expect(statusMock).toHaveBeenCalledWith(400);
      });

      it('should return 400 when the use case fails with "already assigned" (duplicate MAC)', async () => {
        const mockReq = createMockRequest({
          params: { id: VALID_UUID },
          body: { macAddress: 'AA:BB:CC:DD:EE:FF' }
        });
        const { res, statusMock, jsonMock } = createMockResponse();

        (mockUpdateUseCase.execute as jest.Mock).mockResolvedValue(
          Result.fail(
            'MAC address "AA:BB:CC:DD:EE:FF" is already assigned to another device'
          )
        );

        await controller.update(mockReq as Request, res as Response);

        expect(statusMock).toHaveBeenCalledWith(400);
        expect(jsonMock).toHaveBeenCalledWith({
          success: false,
          error:
            'MAC address "AA:BB:CC:DD:EE:FF" is already assigned to another device'
        });
      });

      it('should return 400 when the use case fails with "already assigned" (duplicate IP)', async () => {
        const mockReq = createMockRequest({
          params: { id: VALID_UUID },
          body: { ipAddress: '10.0.0.1' }
        });
        const { res, statusMock } = createMockResponse();

        (mockUpdateUseCase.execute as jest.Mock).mockResolvedValue(
          Result.fail(
            'IP address "10.0.0.1" is already assigned to another device'
          )
        );

        await controller.update(mockReq as Request, res as Response);

        expect(statusMock).toHaveBeenCalledWith(400);
      });

      it('should return 400 when the use case fails with "must be" (invalid status transition)', async () => {
        const mockReq = createMockRequest({
          params: { id: VALID_UUID },
          body: { status: 'ACTIVE' }
        });
        const { res, statusMock } = createMockResponse();

        (mockUpdateUseCase.execute as jest.Mock).mockResolvedValue(
          Result.fail('Status must be one of: INVENTORY, ACTIVE, MAINTENANCE, DAMAGED, DECOMMISSIONED')
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
          body: { status: 'ACTIVE' }
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
          body: { status: 'ACTIVE' }
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
          'Unexpected error in DeviceController',
          thrownError,
          { error: 'Unexpected DB crash' }
        );
      });

      it('should not leak sensitive error details in the response body', async () => {
        const sensitiveError = new Error('SELECT * FROM devices; -- injected');
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
