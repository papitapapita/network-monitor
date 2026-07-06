// Source: src/presentation/http/controllers/ScanController.ts

import { Request, Response } from 'express';
import { ScanController } from '../../../../src/presentation/http/controllers/ScanController';
import { ScanNetworkSegmentUseCase } from '../../../../src/application/device-inventory/use-cases/ScanNetworkSegmentUseCase';
import { ILogger } from '../../../../src/application/shared/interfaces/ILogger';
import { Result } from '../../../../src/domain/shared/core/Result';

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

/** Minimal ScanNetworkSegmentResponseDTO shape returned by the use case. */
interface ScanNetworkSegmentResponseDTO {
  segment: string;
  hostsDiscovered: number;
  hostsRegistered: number;
  errors: string[];
}

// ---------------------------------------------------------------------------
// Mock factories
// ---------------------------------------------------------------------------

const createMockScanUseCase = () =>
  ({ execute: jest.fn() }) as unknown as ScanNetworkSegmentUseCase;

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

const mockScanResultDTO: ScanNetworkSegmentResponseDTO = {
  segment: '192.168.1.0/24',
  hostsDiscovered: 5,
  hostsRegistered: 3,
  errors: []
};

// ---------------------------------------------------------------------------

describe('ScanController', () => {
  let controller: ScanController;
  let mockScanUseCase: ScanNetworkSegmentUseCase;
  let mockLogger: jest.Mocked<ILogger>;

  beforeEach(() => {
    mockScanUseCase = createMockScanUseCase();
    mockLogger = createMockLogger();

    controller = new ScanController(mockScanUseCase, mockLogger);
  });

  afterEach(() => {
    jest.clearAllMocks();
  });

  // =========================================================================
  describe('scan (POST /api/network/scan)', () => {
    // -----------------------------------------------------------------------
    describe('Happy Path', () => {
      it('should return 200 with success: true and data on a successful scan', async () => {
        const mockReq = createMockRequest({
          body: { segment: '192.168.1.0/24' }
        });
        const { res, statusMock, jsonMock } = createMockResponse();

        (mockScanUseCase.execute as jest.Mock).mockResolvedValue(
          Result.ok(mockScanResultDTO)
        );

        await controller.scan(mockReq as Request, res as Response);

        expect(statusMock).toHaveBeenCalledWith(200);
        expect(jsonMock).toHaveBeenCalledWith({
          success: true,
          data: mockScanResultDTO
        });
      });

      it('should pass the segment from the request body to the use case', async () => {
        const mockReq = createMockRequest({
          body: { segment: '10.0.0.0/8' }
        });
        const { res } = createMockResponse();

        (mockScanUseCase.execute as jest.Mock).mockResolvedValue(
          Result.ok(mockScanResultDTO)
        );

        await controller.scan(mockReq as Request, res as Response);

        expect(mockScanUseCase.execute).toHaveBeenCalledWith({
          segment: '10.0.0.0/8'
        });
      });

      it('should return a result with zero hosts registered when no new hosts are found', async () => {
        const emptyResult: ScanNetworkSegmentResponseDTO = {
          segment: '192.168.1.0/24',
          hostsDiscovered: 0,
          hostsRegistered: 0,
          errors: []
        };
        const mockReq = createMockRequest({
          body: { segment: '192.168.1.0/24' }
        });
        const { res, statusMock, jsonMock } = createMockResponse();

        (mockScanUseCase.execute as jest.Mock).mockResolvedValue(
          Result.ok(emptyResult)
        );

        await controller.scan(mockReq as Request, res as Response);

        expect(statusMock).toHaveBeenCalledWith(200);
        expect(jsonMock).toHaveBeenCalledWith({
          success: true,
          data: emptyResult
        });
      });
    });

    // -----------------------------------------------------------------------
    describe('Error Path — 404 Not Found', () => {
      it('should return 404 when the use case fails with "not found"', async () => {
        const mockReq = createMockRequest({
          body: { segment: '192.168.1.0/24' }
        });
        const { res, statusMock, jsonMock } = createMockResponse();

        (mockScanUseCase.execute as jest.Mock).mockResolvedValue(
          Result.fail('DeviceModel not found: default-model-id')
        );

        await controller.scan(mockReq as Request, res as Response);

        expect(statusMock).toHaveBeenCalledWith(404);
        expect(jsonMock).toHaveBeenCalledWith({
          success: false,
          error: 'DeviceModel not found: default-model-id'
        });
      });
    });

    // -----------------------------------------------------------------------
    describe('Error Path — 400 Bad Request', () => {
      it('should return 400 when the use case fails with "Invalid"', async () => {
        const mockReq = createMockRequest({
          body: { segment: 'not-a-cidr' }
        });
        const { res, statusMock, jsonMock } = createMockResponse();

        (mockScanUseCase.execute as jest.Mock).mockResolvedValue(
          Result.fail('Invalid CIDR notation: not-a-cidr')
        );

        await controller.scan(mockReq as Request, res as Response);

        expect(statusMock).toHaveBeenCalledWith(400);
        expect(jsonMock).toHaveBeenCalledWith({
          success: false,
          error: 'Invalid CIDR notation: not-a-cidr'
        });
      });

      it('should return 400 when the use case fails with lowercase "invalid"', async () => {
        const mockReq = createMockRequest({
          body: { segment: '192.168.1.0/24' }
        });
        const { res, statusMock } = createMockResponse();

        (mockScanUseCase.execute as jest.Mock).mockResolvedValue(
          Result.fail('invalid segment range')
        );

        await controller.scan(mockReq as Request, res as Response);

        expect(statusMock).toHaveBeenCalledWith(400);
      });

      it('should return 400 when the use case fails with "cannot be empty"', async () => {
        const mockReq = createMockRequest({ body: { segment: '' } });
        const { res, statusMock } = createMockResponse();

        (mockScanUseCase.execute as jest.Mock).mockResolvedValue(
          Result.fail('Segment cannot be empty')
        );

        await controller.scan(mockReq as Request, res as Response);

        expect(statusMock).toHaveBeenCalledWith(400);
      });

      it('should return 400 when the use case fails with "must be"', async () => {
        const mockReq = createMockRequest({
          body: { segment: '192.168.1.0/24' }
        });
        const { res, statusMock } = createMockResponse();

        (mockScanUseCase.execute as jest.Mock).mockResolvedValue(
          Result.fail('Segment must be a valid CIDR block')
        );

        await controller.scan(mockReq as Request, res as Response);

        expect(statusMock).toHaveBeenCalledWith(400);
      });

      it('should return 400 when the use case fails with "must not exceed"', async () => {
        const mockReq = createMockRequest({
          body: { segment: '10.0.0.0/1' }
        });
        const { res, statusMock } = createMockResponse();

        (mockScanUseCase.execute as jest.Mock).mockResolvedValue(
          Result.fail('Scan range must not exceed 1024 hosts')
        );

        await controller.scan(mockReq as Request, res as Response);

        expect(statusMock).toHaveBeenCalledWith(400);
      });

      it('should return 400 when the use case fails with "already assigned"', async () => {
        const mockReq = createMockRequest({
          body: { segment: '192.168.1.0/24' }
        });
        const { res, statusMock } = createMockResponse();

        (mockScanUseCase.execute as jest.Mock).mockResolvedValue(
          Result.fail('IP address already assigned to another device')
        );

        await controller.scan(mockReq as Request, res as Response);

        expect(statusMock).toHaveBeenCalledWith(400);
      });

      it('should return 400 when the use case fails with "too large"', async () => {
        const mockReq = createMockRequest({
          body: { segment: '0.0.0.0/0' }
        });
        const { res, statusMock } = createMockResponse();

        (mockScanUseCase.execute as jest.Mock).mockResolvedValue(
          Result.fail('Scan segment too large')
        );

        await controller.scan(mockReq as Request, res as Response);

        expect(statusMock).toHaveBeenCalledWith(400);
      });

      it('should return 400 when the use case fails with "range"', async () => {
        const mockReq = createMockRequest({
          body: { segment: '192.168.1.0/24' }
        });
        const { res, statusMock } = createMockResponse();

        (mockScanUseCase.execute as jest.Mock).mockResolvedValue(
          Result.fail('Segment range exceeds allowed limits')
        );

        await controller.scan(mockReq as Request, res as Response);

        expect(statusMock).toHaveBeenCalledWith(400);
      });

      it('should return 400 when the use case fails with "required"', async () => {
        const mockReq = createMockRequest({ body: {} });
        const { res, statusMock } = createMockResponse();

        (mockScanUseCase.execute as jest.Mock).mockResolvedValue(
          Result.fail('segment is required')
        );

        await controller.scan(mockReq as Request, res as Response);

        expect(statusMock).toHaveBeenCalledWith(400);
      });
    });

    // -----------------------------------------------------------------------
    describe('Error Path — 500 Internal Server Error (use case Result failure)', () => {
      it('should return 500 when the use case fails with an unrecognised message', async () => {
        const mockReq = createMockRequest({
          body: { segment: '192.168.1.0/24' }
        });
        const { res, statusMock, jsonMock } = createMockResponse();

        (mockScanUseCase.execute as jest.Mock).mockResolvedValue(
          Result.fail('Database connection refused')
        );

        await controller.scan(mockReq as Request, res as Response);

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
        const thrownError = new Error('Unexpected network timeout');
        const mockReq = createMockRequest({
          body: { segment: '192.168.1.0/24' }
        });
        const { res, statusMock, jsonMock } = createMockResponse();

        (mockScanUseCase.execute as jest.Mock).mockRejectedValue(thrownError);

        await controller.scan(mockReq as Request, res as Response);

        expect(statusMock).toHaveBeenCalledWith(500);
        expect(jsonMock).toHaveBeenCalledWith({
          success: false,
          error: 'Internal server error'
        });
        expect(mockLogger.error).toHaveBeenCalledWith(
          'Unexpected error in ScanController',
          thrownError,
          { error: 'Unexpected network timeout' }
        );
      });

      it('should not leak sensitive error details in the response body', async () => {
        const sensitiveError = new Error('SELECT * FROM devices; -- injected');
        const mockReq = createMockRequest({
          body: { segment: '192.168.1.0/24' }
        });
        const { res, jsonMock } = createMockResponse();

        (mockScanUseCase.execute as jest.Mock).mockRejectedValue(
          sensitiveError
        );

        await controller.scan(mockReq as Request, res as Response);

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
        const mockReq = createMockRequest({
          body: { segment: '192.168.1.0/24' }
        });
        const { res, statusMock } = createMockResponse();

        (mockScanUseCase.execute as jest.Mock).mockRejectedValue(
          'string exception'
        );

        await controller.scan(mockReq as Request, res as Response);

        expect(statusMock).toHaveBeenCalledWith(500);
        expect(mockLogger.error).toHaveBeenCalledWith(
          'Unexpected error in ScanController',
          'string exception',
          { error: 'string exception' }
        );
      });

      it('should handle a thrown null gracefully', async () => {
        const mockReq = createMockRequest({
          body: { segment: '192.168.1.0/24' }
        });
        const { res, statusMock, jsonMock } = createMockResponse();

        (mockScanUseCase.execute as jest.Mock).mockRejectedValue(null);

        await controller.scan(mockReq as Request, res as Response);

        expect(statusMock).toHaveBeenCalledWith(500);
        expect(jsonMock).toHaveBeenCalledWith({
          success: false,
          error: 'Internal server error'
        });
      });

      it('should handle a numeric thrown value and log it as a string', async () => {
        const mockReq = createMockRequest({
          body: { segment: '192.168.1.0/24' }
        });
        const { res, statusMock } = createMockResponse();

        (mockScanUseCase.execute as jest.Mock).mockRejectedValue(42);

        await controller.scan(mockReq as Request, res as Response);

        expect(statusMock).toHaveBeenCalledWith(500);
        expect(mockLogger.error).toHaveBeenCalledWith(
          'Unexpected error in ScanController',
          42,
          { error: '42' }
        );
      });
    });

    // -----------------------------------------------------------------------
    describe('getErrorStatusCode (exercised through scan)', () => {
      it('should prioritise "not found" over "Invalid" when both appear in the message', async () => {
        const mockReq = createMockRequest({
          body: { segment: '192.168.1.0/24' }
        });
        const { res, statusMock } = createMockResponse();

        (mockScanUseCase.execute as jest.Mock).mockResolvedValue(
          Result.fail('Invalid resource not found in registry')
        );

        await controller.scan(mockReq as Request, res as Response);

        expect(statusMock).toHaveBeenCalledWith(404);
      });

      it('should default to 500 for messages that match no known keyword', async () => {
        const mockReq = createMockRequest({
          body: { segment: '192.168.1.0/24' }
        });
        const { res, statusMock } = createMockResponse();

        (mockScanUseCase.execute as jest.Mock).mockResolvedValue(
          Result.fail('Something completely unknown happened')
        );

        await controller.scan(mockReq as Request, res as Response);

        expect(statusMock).toHaveBeenCalledWith(500);
      });
    });
  });
});
