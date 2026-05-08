// Source: src/presentation/http/controllers/DeviceModelController.ts

import { Request, Response } from 'express';
import { DeviceModelController } from '../../../../src/presentation/http/controllers/DeviceModelController';
import { GetDeviceModelUseCase } from '../../../../src/application/device-inventory/use-cases/GetDeviceModelUseCase';
import { ListDeviceModelsUseCase } from '../../../../src/application/device-inventory/use-cases/ListDeviceModelsUseCase';
import { CreateDeviceModelUseCase } from '../../../../src/application/device-inventory/use-cases/CreateDeviceModelUseCase';
import { UpdateDeviceModelUseCase } from '../../../../src/application/device-inventory/use-cases/UpdateDeviceModelUseCase';
import { DeleteDeviceModelUseCase } from '../../../../src/application/device-inventory/use-cases/DeleteDeviceModelUseCase';
import { ILogger } from '../../../../src/application/shared/interfaces/ILogger';
import { Result } from '../../../../src/domain/shared/core/Result';

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

interface DeviceModelResponseDTO {
  id: string;
  vendorId: string;
  vendorName: string;
  vendorSlug: string;
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

const createMockCreateUseCase = () =>
  ({ execute: jest.fn() }) as unknown as CreateDeviceModelUseCase;

const createMockUpdateUseCase = () =>
  ({ execute: jest.fn() }) as unknown as UpdateDeviceModelUseCase;

const createMockDeleteUseCase = () =>
  ({ execute: jest.fn() }) as unknown as DeleteDeviceModelUseCase;

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
const VENDOR_UUID = 'f47ac10b-58cc-4372-a567-0e02b2c3d480';

const mockModelDTO: DeviceModelResponseDTO = {
  id: VALID_UUID,
  vendorId: VENDOR_UUID,
  vendorName: 'Mikrotik',
  vendorSlug: 'mikrotik',
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
  let mockCreateUseCase: CreateDeviceModelUseCase;
  let mockUpdateUseCase: UpdateDeviceModelUseCase;
  let mockDeleteUseCase: DeleteDeviceModelUseCase;
  let mockLogger: jest.Mocked<ILogger>;

  beforeEach(() => {
    mockGetUseCase = createMockGetUseCase();
    mockListUseCase = createMockListUseCase();
    mockCreateUseCase = createMockCreateUseCase();
    mockUpdateUseCase = createMockUpdateUseCase();
    mockDeleteUseCase = createMockDeleteUseCase();
    mockLogger = createMockLogger();

    controller = new DeviceModelController(
      mockGetUseCase,
      mockListUseCase,
      mockCreateUseCase,
      mockUpdateUseCase,
      mockDeleteUseCase,
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
    describe('Error Path — 500 Internal Server Error', () => {
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
    describe('Error Path — 404', () => {
      it('should return 404 when the use case fails with "not found"', async () => {
        const mockReq = createMockRequest({ params: { id: VALID_UUID } });
        const { res, statusMock } = createMockResponse();

        (mockGetUseCase.execute as jest.Mock).mockResolvedValue(
          Result.fail(`Device model not found: ${VALID_UUID}`)
        );

        await controller.getById(mockReq as Request, res as Response);

        expect(statusMock).toHaveBeenCalledWith(404);
      });
    });
  });

  // =========================================================================
  describe('create (POST /api/device-models)', () => {
    it('should return 201 with success: true on successful create', async () => {
      const mockReq = createMockRequest({
        body: { vendorId: VENDOR_UUID, model: 'RB760iGS', deviceType: 'ROUTER' }
      });
      const { res, statusMock, jsonMock } = createMockResponse();

      (mockCreateUseCase.execute as jest.Mock).mockResolvedValue(
        Result.ok(mockModelDTO)
      );

      await controller.create(mockReq as Request, res as Response);

      expect(statusMock).toHaveBeenCalledWith(201);
      expect(jsonMock).toHaveBeenCalledWith({
        success: true,
        data: mockModelDTO
      });
    });

    it('should return 409 when use case fails with "already exists"', async () => {
      const mockReq = createMockRequest({ body: {} });
      const { res, statusMock } = createMockResponse();

      (mockCreateUseCase.execute as jest.Mock).mockResolvedValue(
        Result.fail('A device model "RB760iGS" already exists for this vendor')
      );

      await controller.create(mockReq as Request, res as Response);

      expect(statusMock).toHaveBeenCalledWith(409);
    });
  });

  // =========================================================================
  describe('delete (DELETE /api/device-models/:id)', () => {
    it('should return 204 on successful delete', async () => {
      const mockReq = createMockRequest({ params: { id: VALID_UUID } });
      const sendMock = jest.fn();
      const res = { status: jest.fn().mockReturnValue({ send: sendMock }) } as any;

      (mockDeleteUseCase.execute as jest.Mock).mockResolvedValue(
        Result.ok(undefined)
      );

      await controller.delete(mockReq as Request, res);

      expect(res.status).toHaveBeenCalledWith(204);
    });

    it('should return 409 when device model has associated devices', async () => {
      const mockReq = createMockRequest({ params: { id: VALID_UUID } });
      const { res, statusMock } = createMockResponse();

      (mockDeleteUseCase.execute as jest.Mock).mockResolvedValue(
        Result.fail('Cannot delete device model: it has 3 device(s) associated.')
      );

      await controller.delete(mockReq as Request, res as Response);

      expect(statusMock).toHaveBeenCalledWith(409);
    });
  });
});
