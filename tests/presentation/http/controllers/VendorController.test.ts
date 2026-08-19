// Source: src/presentation/http/controllers/VendorController.ts

import { Request, Response } from 'express';
import { VendorController } from '../../../../src/presentation/http/controllers/VendorController';
import { CreateVendorUseCase } from '../../../../src/application/device-inventory/use-cases/CreateVendorUseCase';
import { GetVendorUseCase } from '../../../../src/application/device-inventory/use-cases/GetVendorUseCase';
import { ListVendorsUseCase } from '../../../../src/application/device-inventory/use-cases/ListVendorsUseCase';
import { UpdateVendorUseCase } from '../../../../src/application/device-inventory/use-cases/UpdateVendorUseCase';
import { DeleteVendorUseCase } from '../../../../src/application/device-inventory/use-cases/DeleteVendorUseCase';
import { ILogger } from '../../../../src/application/shared/interfaces/ILogger';
import { Result } from '../../../../src/domain/shared/core/Result';

// ---------------------------------------------------------------------------
// Mock factories
// ---------------------------------------------------------------------------

const createMockCreateUseCase = () =>
  ({ execute: jest.fn() }) as unknown as CreateVendorUseCase;

const createMockGetUseCase = () =>
  ({ execute: jest.fn() }) as unknown as GetVendorUseCase;

const createMockListUseCase = () =>
  ({ execute: jest.fn() }) as unknown as ListVendorsUseCase;

const createMockUpdateUseCase = () =>
  ({ execute: jest.fn() }) as unknown as UpdateVendorUseCase;

const createMockDeleteUseCase = () =>
  ({ execute: jest.fn() }) as unknown as DeleteVendorUseCase;

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
// Fixtures
// ---------------------------------------------------------------------------

const VALID_UUID = 'f47ac10b-58cc-4372-a567-0e02b2c3d479';

const mockVendorDTO = {
  id: VALID_UUID,
  name: 'Mikrotik',
  slug: 'mikrotik',
  description: null,
  createdAt: '2024-01-01T00:00:00.000Z',
  updatedAt: '2024-01-01T00:00:00.000Z'
};

const mockListDTO = {
  vendors: [mockVendorDTO],
  total: 1,
  limit: 20,
  offset: 0,
  hasMore: false
};

// ---------------------------------------------------------------------------

describe('VendorController', () => {
  let controller: VendorController;
  let mockCreateUseCase: CreateVendorUseCase;
  let mockGetUseCase: GetVendorUseCase;
  let mockListUseCase: ListVendorsUseCase;
  let mockUpdateUseCase: UpdateVendorUseCase;
  let mockDeleteUseCase: DeleteVendorUseCase;
  let mockLogger: jest.Mocked<ILogger>;

  beforeEach(() => {
    mockCreateUseCase = createMockCreateUseCase();
    mockGetUseCase = createMockGetUseCase();
    mockListUseCase = createMockListUseCase();
    mockUpdateUseCase = createMockUpdateUseCase();
    mockDeleteUseCase = createMockDeleteUseCase();
    mockLogger = createMockLogger();

    controller = new VendorController(
      mockCreateUseCase,
      mockGetUseCase,
      mockListUseCase,
      mockUpdateUseCase,
      mockDeleteUseCase,
      mockLogger
    );
  });

  afterEach(() => {
    jest.clearAllMocks();
  });

  // =========================================================================
  describe('list (GET /api/vendors)', () => {
    // -----------------------------------------------------------------------
    describe('happy path', () => {
      it('should return 200 with success: true and data on success', async () => {
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

      it('should convert limit and offset query strings to numbers before passing to use case', async () => {
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
    });

    // -----------------------------------------------------------------------
    describe('error path — 404', () => {
      it('should return 404 when the use case fails with "not found"', async () => {
        const mockReq = createMockRequest({ query: {} });
        const { res, statusMock, jsonMock } = createMockResponse();

        (mockListUseCase.execute as jest.Mock).mockResolvedValue(
          Result.fail('Vendor not found')
        );

        await controller.list(mockReq as Request, res as Response);

        expect(statusMock).toHaveBeenCalledWith(404);
        expect(jsonMock).toHaveBeenCalledWith({
          success: false,
          error: 'Vendor not found'
        });
      });
    });

    // -----------------------------------------------------------------------
    describe('error path — 500 thrown exception', () => {
      it('should return 500 and call logger.error when use case throws', async () => {
        const thrownError = new Error('Unexpected DB crash');
        const mockReq = createMockRequest({ query: {} });
        const { res, statusMock, jsonMock } = createMockResponse();

        (mockListUseCase.execute as jest.Mock).mockRejectedValue(
          thrownError
        );

        await controller.list(mockReq as Request, res as Response);

        expect(statusMock).toHaveBeenCalledWith(500);
        expect(jsonMock).toHaveBeenCalledWith({
          success: false,
          error: 'Internal server error'
        });
        expect(mockLogger.error).toHaveBeenCalledWith(
          'Unexpected error in VendorController',
          thrownError,
          { error: 'Unexpected DB crash' }
        );
      });
    });
  });

  // =========================================================================
  describe('getById (GET /api/vendors/:id)', () => {
    // -----------------------------------------------------------------------
    describe('happy path', () => {
      it('should return 200 with success: true and data when vendor is found', async () => {
        const mockReq = createMockRequest({
          params: { id: VALID_UUID }
        });
        const { res, statusMock, jsonMock } = createMockResponse();

        (mockGetUseCase.execute as jest.Mock).mockResolvedValue(
          Result.ok(mockVendorDTO)
        );

        await controller.getById(mockReq as Request, res as Response);

        expect(statusMock).toHaveBeenCalledWith(200);
        expect(jsonMock).toHaveBeenCalledWith({
          success: true,
          data: mockVendorDTO
        });
      });

      it('should pass req.params.id to the use case', async () => {
        const mockReq = createMockRequest({
          params: { id: VALID_UUID }
        });
        const { res } = createMockResponse();

        (mockGetUseCase.execute as jest.Mock).mockResolvedValue(
          Result.ok(mockVendorDTO)
        );

        await controller.getById(mockReq as Request, res as Response);

        expect(mockGetUseCase.execute).toHaveBeenCalledWith({
          id: VALID_UUID
        });
      });
    });

    // -----------------------------------------------------------------------
    describe('error path — 404', () => {
      it('should return 404 when the use case fails with "not found"', async () => {
        const mockReq = createMockRequest({
          params: { id: VALID_UUID }
        });
        const { res, statusMock, jsonMock } = createMockResponse();

        (mockGetUseCase.execute as jest.Mock).mockResolvedValue(
          Result.fail(`Vendor not found: ${VALID_UUID}`)
        );

        await controller.getById(mockReq as Request, res as Response);

        expect(statusMock).toHaveBeenCalledWith(404);
        expect(jsonMock).toHaveBeenCalledWith({
          success: false,
          error: `Vendor not found: ${VALID_UUID}`
        });
      });
    });
  });

  // =========================================================================
  describe('create (POST /api/vendors)', () => {
    const validBody = { name: 'Mikrotik', slug: 'mikrotik' };

    // -----------------------------------------------------------------------
    describe('happy path', () => {
      it('should return 201 with success: true and data on successful creation', async () => {
        const mockReq = createMockRequest({ body: validBody });
        const { res, statusMock, jsonMock } = createMockResponse();

        (mockCreateUseCase.execute as jest.Mock).mockResolvedValue(
          Result.ok(mockVendorDTO)
        );

        await controller.create(mockReq as Request, res as Response);

        expect(statusMock).toHaveBeenCalledWith(201);
        expect(jsonMock).toHaveBeenCalledWith({
          success: true,
          data: mockVendorDTO
        });
      });
    });

    // -----------------------------------------------------------------------
    describe('error path — 409 conflict', () => {
      it('should return 409 when the use case fails with "already exists"', async () => {
        const mockReq = createMockRequest({ body: validBody });
        const { res, statusMock, jsonMock } = createMockResponse();

        (mockCreateUseCase.execute as jest.Mock).mockResolvedValue(
          Result.fail(
            'A vendor with this name or slug already exists'
          )
        );

        await controller.create(mockReq as Request, res as Response);

        expect(statusMock).toHaveBeenCalledWith(409);
        expect(jsonMock).toHaveBeenCalledWith({
          success: false,
          error: 'A vendor with this name or slug already exists'
        });
      });
    });

    // -----------------------------------------------------------------------
    describe('error path — 400 bad request', () => {
      it('should return 400 when the use case fails with "required"', async () => {
        const mockReq = createMockRequest({ body: {} });
        const { res, statusMock } = createMockResponse();

        (mockCreateUseCase.execute as jest.Mock).mockResolvedValue(
          Result.fail('Vendor name is required')
        );

        await controller.create(mockReq as Request, res as Response);

        expect(statusMock).toHaveBeenCalledWith(400);
      });
    });
  });

  // =========================================================================
  describe('update (PUT /api/vendors/:id)', () => {
    // -----------------------------------------------------------------------
    describe('happy path', () => {
      it('should return 200 with success: true and data on successful update', async () => {
        const mockReq = createMockRequest({
          params: { id: VALID_UUID },
          body: { name: 'Mikrotik Updated' }
        });
        const { res, statusMock, jsonMock } = createMockResponse();

        (mockUpdateUseCase.execute as jest.Mock).mockResolvedValue(
          Result.ok(mockVendorDTO)
        );

        await controller.update(mockReq as Request, res as Response);

        expect(statusMock).toHaveBeenCalledWith(200);
        expect(jsonMock).toHaveBeenCalledWith({
          success: true,
          data: mockVendorDTO
        });
      });

      it('should merge req.params.id with req.body before passing to use case', async () => {
        const mockReq = createMockRequest({
          params: { id: VALID_UUID },
          body: { name: 'Mikrotik Updated', slug: 'mikrotik-updated' }
        });
        const { res } = createMockResponse();

        (mockUpdateUseCase.execute as jest.Mock).mockResolvedValue(
          Result.ok(mockVendorDTO)
        );

        await controller.update(mockReq as Request, res as Response);

        expect(mockUpdateUseCase.execute).toHaveBeenCalledWith(
          expect.objectContaining({
            id: VALID_UUID,
            name: 'Mikrotik Updated',
            slug: 'mikrotik-updated'
          })
        );
      });
    });

    // -----------------------------------------------------------------------
    describe('error path — 404', () => {
      it('should return 404 when the use case fails with "not found"', async () => {
        const mockReq = createMockRequest({
          params: { id: VALID_UUID },
          body: { name: 'New Name' }
        });
        const { res, statusMock, jsonMock } = createMockResponse();

        (mockUpdateUseCase.execute as jest.Mock).mockResolvedValue(
          Result.fail(`Vendor not found: ${VALID_UUID}`)
        );

        await controller.update(mockReq as Request, res as Response);

        expect(statusMock).toHaveBeenCalledWith(404);
        expect(jsonMock).toHaveBeenCalledWith({
          success: false,
          error: `Vendor not found: ${VALID_UUID}`
        });
      });
    });

    // -----------------------------------------------------------------------
    describe('error path — 409 conflict', () => {
      it('should return 409 when the use case fails with "already exists"', async () => {
        const mockReq = createMockRequest({
          params: { id: VALID_UUID },
          body: { slug: 'mikrotik' }
        });
        const { res, statusMock } = createMockResponse();

        (mockUpdateUseCase.execute as jest.Mock).mockResolvedValue(
          Result.fail(
            'A vendor with this name or slug already exists'
          )
        );

        await controller.update(mockReq as Request, res as Response);

        expect(statusMock).toHaveBeenCalledWith(409);
      });
    });
  });

  // =========================================================================
  describe('delete (DELETE /api/vendors/:id)', () => {
    // -----------------------------------------------------------------------
    describe('happy path', () => {
      it('should return 204 on successful delete', async () => {
        const mockReq = createMockRequest({
          params: { id: VALID_UUID }
        });
        const { res, statusMock, sendMock } = createMockResponse();

        (mockDeleteUseCase.execute as jest.Mock).mockResolvedValue(
          Result.ok<void>()
        );

        await controller.delete(mockReq as Request, res as Response);

        expect(statusMock).toHaveBeenCalledWith(204);
        expect(sendMock).toHaveBeenCalled();
      });
    });

    // -----------------------------------------------------------------------
    describe('error path — 409 conflict', () => {
      it('should return 409 when the use case fails with "Cannot delete vendor"', async () => {
        const mockReq = createMockRequest({
          params: { id: VALID_UUID }
        });
        const { res, statusMock, jsonMock } = createMockResponse();

        (mockDeleteUseCase.execute as jest.Mock).mockResolvedValue(
          Result.fail(
            'Cannot delete vendor: it has associated device models'
          )
        );

        await controller.delete(mockReq as Request, res as Response);

        expect(statusMock).toHaveBeenCalledWith(409);
        expect(jsonMock).toHaveBeenCalledWith({
          success: false,
          error:
            'Cannot delete vendor: it has associated device models'
        });
      });
    });

    // -----------------------------------------------------------------------
    describe('error path — 404', () => {
      it('should return 404 when the use case fails with "not found"', async () => {
        const mockReq = createMockRequest({
          params: { id: VALID_UUID }
        });
        const { res, statusMock, jsonMock } = createMockResponse();

        (mockDeleteUseCase.execute as jest.Mock).mockResolvedValue(
          Result.fail('Vendor not found')
        );

        await controller.delete(mockReq as Request, res as Response);

        expect(statusMock).toHaveBeenCalledWith(404);
        expect(jsonMock).toHaveBeenCalledWith({
          success: false,
          error: 'Vendor not found'
        });
      });
    });
  });
});
