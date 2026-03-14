import { Request, Response } from 'express';
import { NetworkDeviceController } from '../../../../src/presentation/http/controllers/NetworkDeviceController';
import { CreateNetworkDeviceUseCase } from '../../../../src/application/device-inventory/use-cases/CreateNetworkDeviceUseCase';
import { Result } from '../../../src/domain/device-inventory';
import { ILogger } from '../../../src/application/shared/interfaces/ILogger';

/**
 * NetworkDeviceController Unit Tests
 *
 * Tests the HTTP controller for NetworkDevice operations.
 * Uses mocked use cases to isolate controller logic.
 *
 * Coverage:
 * - create method: 201, 400, 404, 409, 410, 422, 500
 * - getErrorStatusCode: all error mappings
 * - handleUnexpectedError: logging and generic response
 */

// Mock implementations
const createMockCreateUseCase = () =>
  ({
    execute: jest.fn()
  }) as unknown as CreateNetworkDeviceUseCase;

const createMockLogger = (): ILogger => ({
  info: jest.fn(),
  warn: jest.fn(),
  error: jest.fn(),
  debug: jest.fn(),
  fatal: jest.fn(),
  child: jest.fn().mockReturnThis(),
  setLevel: jest.fn()
});

// Helper to create mock Express Request
const createMockRequest = (
  overrides: Partial<Request> = {}
): Partial<Request> => ({
  body: {},
  params: {},
  query: {},
  ...overrides
});

// Helper to create mock Express Response
const createMockResponse = (): {
  res: Partial<Response>;
  jsonMock: jest.Mock;
  statusMock: jest.Mock;
  sendMock: jest.Mock;
} => {
  const jsonMock = jest.fn();
  const sendMock = jest.fn();
  const statusMock = jest.fn().mockReturnValue({
    json: jsonMock,
    send: sendMock
  });

  return {
    res: {
      status: statusMock,
      json: jsonMock
    },
    jsonMock,
    statusMock,
    sendMock
  };
};

describe('NetworkDeviceController', () => {
  let controller: NetworkDeviceController;
  let mockCreateUseCase: CreateNetworkDeviceUseCase;
  let mockLogger: ILogger;

  beforeEach(() => {
    jest.clearAllMocks();
    mockCreateUseCase = createMockCreateUseCase();
    mockLogger = createMockLogger();
    controller = new NetworkDeviceController(
      mockCreateUseCase,
      mockLogger
    );
  });

  describe('create', () => {
    const validCreateDTO = {
      ipAddress: '192.168.1.100',
      macAddress: 'AA:BB:CC:DD:EE:FF',
      deviceId: '123e4567-e89b-12d3-a456-426614174000',
      name: 'Router-01',
      deviceType: 'ROUTER'
    };

    const mockResponseDTO = {
      id: 'device-id-123',
      ipAddress: '192.168.1.100',
      macAddress: 'AA:BB:CC:DD:EE:FF',
      deviceId: '123e4567-e89b-12d3-a456-426614174000',
      name: 'Router-01',
      deviceType: 'ROUTER',
      status: 'OFFLINE',
      activationStatus: 'DRAFT'
    };

    describe('Happy Path', () => {
      it('should return 201 on successful device creation', async () => {
        // Arrange
        const mockReq = createMockRequest({ body: validCreateDTO });
        const { res, statusMock, jsonMock } = createMockResponse();

        (mockCreateUseCase.execute as jest.Mock).mockResolvedValue(
          Result.ok(mockResponseDTO)
        );

        // Act
        await controller.create(mockReq as Request, res as Response);

        // Assert
        expect(mockCreateUseCase.execute).toHaveBeenCalledWith(
          validCreateDTO
        );
        expect(statusMock).toHaveBeenCalledWith(201);
        expect(jsonMock).toHaveBeenCalledWith({
          success: true,
          data: mockResponseDTO
        });
      });

      it('should pass request body directly to use case', async () => {
        // Arrange
        const customDTO = {
          ...validCreateDTO,
          description: 'Main router',
          location: 'Building A',
          activateImmediately: true
        };
        const mockReq = createMockRequest({ body: customDTO });
        const { res } = createMockResponse();

        (mockCreateUseCase.execute as jest.Mock).mockResolvedValue(
          Result.ok(mockResponseDTO)
        );

        // Act
        await controller.create(mockReq as Request, res as Response);

        // Assert
        expect(mockCreateUseCase.execute).toHaveBeenCalledWith(
          customDTO
        );
      });
    });

    describe('Error Path - 400 Bad Request', () => {
      it('should return 400 for Invalid IP address error', async () => {
        // Arrange
        const mockReq = createMockRequest({
          body: { ...validCreateDTO, ipAddress: 'invalid-ip' }
        });
        const { res, statusMock, jsonMock } = createMockResponse();

        (mockCreateUseCase.execute as jest.Mock).mockResolvedValue(
          Result.fail('Invalid IP address format')
        );

        // Act
        await controller.create(mockReq as Request, res as Response);

        // Assert
        expect(statusMock).toHaveBeenCalledWith(400);
        expect(jsonMock).toHaveBeenCalledWith({
          success: false,
          error: 'Invalid IP address format'
        });
      });

      it('should return 400 for validation errors', async () => {
        // Arrange
        const mockReq = createMockRequest({ body: {} });
        const { res, statusMock, jsonMock } = createMockResponse();

        (mockCreateUseCase.execute as jest.Mock).mockResolvedValue(
          Result.fail('validation failed: missing required fields')
        );

        // Act
        await controller.create(mockReq as Request, res as Response);

        // Assert
        expect(statusMock).toHaveBeenCalledWith(400);
        expect(jsonMock).toHaveBeenCalledWith({
          success: false,
          error: 'validation failed: missing required fields'
        });
      });

      it('should return 400 for "At least one" field required error', async () => {
        // Arrange
        const mockReq = createMockRequest({ body: validCreateDTO });
        const { res, statusMock, jsonMock } = createMockResponse();

        (mockCreateUseCase.execute as jest.Mock).mockResolvedValue(
          Result.fail('At least one field must be provided')
        );

        // Act
        await controller.create(mockReq as Request, res as Response);

        // Assert
        expect(statusMock).toHaveBeenCalledWith(400);
        expect(jsonMock).toHaveBeenCalledWith({
          success: false,
          error: 'At least one field must be provided'
        });
      });

      it('should return 400 for "is required" error', async () => {
        // Arrange
        const mockReq = createMockRequest({ body: {} });
        const { res, statusMock, jsonMock } = createMockResponse();

        (mockCreateUseCase.execute as jest.Mock).mockResolvedValue(
          Result.fail('IP address is required')
        );

        // Act
        await controller.create(mockReq as Request, res as Response);

        // Assert
        expect(statusMock).toHaveBeenCalledWith(400);
        expect(jsonMock).toHaveBeenCalledWith({
          success: false,
          error: 'IP address is required'
        });
      });

      it('should return 400 for "cannot be empty" error', async () => {
        // Arrange
        const mockReq = createMockRequest({
          body: { ...validCreateDTO, name: '' }
        });
        const { res, statusMock, jsonMock } = createMockResponse();

        (mockCreateUseCase.execute as jest.Mock).mockResolvedValue(
          Result.fail('Name cannot be empty')
        );

        // Act
        await controller.create(mockReq as Request, res as Response);

        // Assert
        expect(statusMock).toHaveBeenCalledWith(400);
        expect(jsonMock).toHaveBeenCalledWith({
          success: false,
          error: 'Name cannot be empty'
        });
      });

      it('should return 400 for "must not exceed" error', async () => {
        // Arrange
        const mockReq = createMockRequest({
          body: { ...validCreateDTO, name: 'a'.repeat(300) }
        });
        const { res, statusMock, jsonMock } = createMockResponse();

        (mockCreateUseCase.execute as jest.Mock).mockResolvedValue(
          Result.fail('Name must not exceed 255 characters')
        );

        // Act
        await controller.create(mockReq as Request, res as Response);

        // Assert
        expect(statusMock).toHaveBeenCalledWith(400);
        expect(jsonMock).toHaveBeenCalledWith({
          success: false,
          error: 'Name must not exceed 255 characters'
        });
      });
    });

    describe('Error Path - 404 Not Found', () => {
      it('should return 404 for "not found" error', async () => {
        // Arrange
        const mockReq = createMockRequest({ body: validCreateDTO });
        const { res, statusMock, jsonMock } = createMockResponse();

        (mockCreateUseCase.execute as jest.Mock).mockResolvedValue(
          Result.fail('Device not found')
        );

        // Act
        await controller.create(mockReq as Request, res as Response);

        // Assert
        expect(statusMock).toHaveBeenCalledWith(404);
        expect(jsonMock).toHaveBeenCalledWith({
          success: false,
          error: 'Device not found'
        });
      });

      it('should return 404 for resource not found (case insensitive)', async () => {
        // Arrange
        const mockReq = createMockRequest({ body: validCreateDTO });
        const { res, statusMock, jsonMock } = createMockResponse();

        (mockCreateUseCase.execute as jest.Mock).mockResolvedValue(
          Result.fail('Network device with ID xyz not found')
        );

        // Act
        await controller.create(mockReq as Request, res as Response);

        // Assert
        expect(statusMock).toHaveBeenCalledWith(404);
        expect(jsonMock).toHaveBeenCalledWith({
          success: false,
          error: 'Network device with ID xyz not found'
        });
      });
    });

    describe('Error Path - 409 Conflict', () => {
      it('should return 409 for "already exists" error', async () => {
        // Arrange
        const mockReq = createMockRequest({ body: validCreateDTO });
        const { res, statusMock, jsonMock } = createMockResponse();

        (mockCreateUseCase.execute as jest.Mock).mockResolvedValue(
          Result.fail(
            'A device with IP address 192.168.1.100 already exists'
          )
        );

        // Act
        await controller.create(mockReq as Request, res as Response);

        // Assert
        expect(statusMock).toHaveBeenCalledWith(409);
        expect(jsonMock).toHaveBeenCalledWith({
          success: false,
          error:
            'A device with IP address 192.168.1.100 already exists'
        });
      });

      it('should return 409 for "duplicate" error', async () => {
        // Arrange
        const mockReq = createMockRequest({ body: validCreateDTO });
        const { res, statusMock, jsonMock } = createMockResponse();

        (mockCreateUseCase.execute as jest.Mock).mockResolvedValue(
          Result.fail('duplicate MAC address detected')
        );

        // Act
        await controller.create(mockReq as Request, res as Response);

        // Assert
        expect(statusMock).toHaveBeenCalledWith(409);
        expect(jsonMock).toHaveBeenCalledWith({
          success: false,
          error: 'duplicate MAC address detected'
        });
      });

      it('should return 409 for "is now in use" error', async () => {
        // Arrange
        const mockReq = createMockRequest({ body: validCreateDTO });
        const { res, statusMock, jsonMock } = createMockResponse();

        (mockCreateUseCase.execute as jest.Mock).mockResolvedValue(
          Result.fail('IP address is now in use by another device')
        );

        // Act
        await controller.create(mockReq as Request, res as Response);

        // Assert
        expect(statusMock).toHaveBeenCalledWith(409);
        expect(jsonMock).toHaveBeenCalledWith({
          success: false,
          error: 'IP address is now in use by another device'
        });
      });

      it('should return 409 for "Cannot restore" error', async () => {
        // Arrange
        const mockReq = createMockRequest({ body: validCreateDTO });
        const { res, statusMock, jsonMock } = createMockResponse();

        (mockCreateUseCase.execute as jest.Mock).mockResolvedValue(
          Result.fail('Cannot restore device: IP conflict')
        );

        // Act
        await controller.create(mockReq as Request, res as Response);

        // Assert
        expect(statusMock).toHaveBeenCalledWith(409);
        expect(jsonMock).toHaveBeenCalledWith({
          success: false,
          error: 'Cannot restore device: IP conflict'
        });
      });
    });

    describe('Error Path - 410 Gone (REQ-002)', () => {
      it('should return 410 for "grace period has expired" error', async () => {
        // Arrange
        const mockReq = createMockRequest({ body: validCreateDTO });
        const { res, statusMock, jsonMock } = createMockResponse();

        (mockCreateUseCase.execute as jest.Mock).mockResolvedValue(
          Result.fail(
            'cannot restore: grace period has expired for this device'
          )
        );

        // Act
        await controller.create(mockReq as Request, res as Response);

        // Assert
        expect(statusMock).toHaveBeenCalledWith(410);
        expect(jsonMock).toHaveBeenCalledWith({
          success: false,
          error:
            'cannot restore: grace period has expired for this device'
        });
      });

      it('should return 410 for "days ago" error (expired soft delete)', async () => {
        // Arrange
        const mockReq = createMockRequest({ body: validCreateDTO });
        const { res, statusMock, jsonMock } = createMockResponse();

        (mockCreateUseCase.execute as jest.Mock).mockResolvedValue(
          Result.fail(
            'Device was soft-deleted 10 days ago, cannot restore'
          )
        );

        // Act
        await controller.create(mockReq as Request, res as Response);

        // Assert
        expect(statusMock).toHaveBeenCalledWith(410);
        expect(jsonMock).toHaveBeenCalledWith({
          success: false,
          error: 'Device was soft-deleted 10 days ago, cannot restore'
        });
      });
    });

    describe('Error Path - 422 Unprocessable Entity (REQ-002)', () => {
      it('should return 422 for "is already ACTIVE" error', async () => {
        // Arrange
        const mockReq = createMockRequest({ body: validCreateDTO });
        const { res, statusMock, jsonMock } = createMockResponse();

        (mockCreateUseCase.execute as jest.Mock).mockResolvedValue(
          Result.fail('Device is already ACTIVE')
        );

        // Act
        await controller.create(mockReq as Request, res as Response);

        // Assert
        expect(statusMock).toHaveBeenCalledWith(422);
        expect(jsonMock).toHaveBeenCalledWith({
          success: false,
          error: 'Device is already ACTIVE'
        });
      });

      it('should return 422 for "is not soft-deleted" error', async () => {
        // Arrange
        const mockReq = createMockRequest({ body: validCreateDTO });
        const { res, statusMock, jsonMock } = createMockResponse();

        (mockCreateUseCase.execute as jest.Mock).mockResolvedValue(
          Result.fail('Device is not soft-deleted, cannot restore')
        );

        // Act
        await controller.create(mockReq as Request, res as Response);

        // Assert
        expect(statusMock).toHaveBeenCalledWith(422);
        expect(jsonMock).toHaveBeenCalledWith({
          success: false,
          error: 'Device is not soft-deleted, cannot restore'
        });
      });

      it('should return 422 for "Cannot update soft-deleted" error', async () => {
        // Arrange
        const mockReq = createMockRequest({ body: validCreateDTO });
        const { res, statusMock, jsonMock } = createMockResponse();

        (mockCreateUseCase.execute as jest.Mock).mockResolvedValue(
          Result.fail('Cannot update soft-deleted device')
        );

        // Act
        await controller.create(mockReq as Request, res as Response);

        // Assert
        expect(statusMock).toHaveBeenCalledWith(422);
        expect(jsonMock).toHaveBeenCalledWith({
          success: false,
          error: 'Cannot update soft-deleted device'
        });
      });

      it('should return 422 for "Cannot activate soft-deleted" error', async () => {
        // Arrange
        const mockReq = createMockRequest({ body: validCreateDTO });
        const { res, statusMock, jsonMock } = createMockResponse();

        (mockCreateUseCase.execute as jest.Mock).mockResolvedValue(
          Result.fail('Cannot activate soft-deleted device')
        );

        // Act
        await controller.create(mockReq as Request, res as Response);

        // Assert
        expect(statusMock).toHaveBeenCalledWith(422);
        expect(jsonMock).toHaveBeenCalledWith({
          success: false,
          error: 'Cannot activate soft-deleted device'
        });
      });

      it('should return 422 for "is already soft-deleted" error', async () => {
        // Arrange
        const mockReq = createMockRequest({ body: validCreateDTO });
        const { res, statusMock, jsonMock } = createMockResponse();

        (mockCreateUseCase.execute as jest.Mock).mockResolvedValue(
          Result.fail('Device is already soft-deleted')
        );

        // Act
        await controller.create(mockReq as Request, res as Response);

        // Assert
        expect(statusMock).toHaveBeenCalledWith(422);
        expect(jsonMock).toHaveBeenCalledWith({
          success: false,
          error: 'Device is already soft-deleted'
        });
      });
    });

    describe('Error Path - 500 Internal Server Error', () => {
      it('should return 500 for unknown error messages', async () => {
        // Arrange
        const mockReq = createMockRequest({ body: validCreateDTO });
        const { res, statusMock, jsonMock } = createMockResponse();

        (mockCreateUseCase.execute as jest.Mock).mockResolvedValue(
          Result.fail('Database connection failed')
        );

        // Act
        await controller.create(mockReq as Request, res as Response);

        // Assert
        expect(statusMock).toHaveBeenCalledWith(500);
        expect(jsonMock).toHaveBeenCalledWith({
          success: false,
          error: 'Database connection failed'
        });
      });

      it('should return 500 and log on unexpected exception', async () => {
        // Arrange
        const error = new Error('Unexpected database crash');
        const mockReq = createMockRequest({ body: validCreateDTO });
        const { res, statusMock, jsonMock } = createMockResponse();

        (mockCreateUseCase.execute as jest.Mock).mockRejectedValue(
          error
        );

        // Act
        await controller.create(mockReq as Request, res as Response);

        // Assert
        expect(mockLogger.error).toHaveBeenCalledWith(
          'Unexpected error in NetworkDeviceController',
          error,
          { error: 'Unexpected database crash' }
        );
        expect(statusMock).toHaveBeenCalledWith(500);
        expect(jsonMock).toHaveBeenCalledWith({
          success: false,
          error: 'Internal server error'
        });
      });

      it('should handle non-Error exceptions gracefully', async () => {
        // Arrange
        const mockReq = createMockRequest({ body: validCreateDTO });
        const { res, statusMock, jsonMock } = createMockResponse();

        (mockCreateUseCase.execute as jest.Mock).mockRejectedValue(
          'String exception'
        );

        // Act
        await controller.create(mockReq as Request, res as Response);

        // Assert
        expect(mockLogger.error).toHaveBeenCalledWith(
          'Unexpected error in NetworkDeviceController',
          'String exception',
          { error: 'String exception' }
        );
        expect(statusMock).toHaveBeenCalledWith(500);
        expect(jsonMock).toHaveBeenCalledWith({
          success: false,
          error: 'Internal server error'
        });
      });

      it('should not leak internal error details to client', async () => {
        // Arrange
        const sensitiveError = new Error(
          'SELECT * FROM network_devices WHERE id = 1; --sql injection attempt'
        );
        const mockReq = createMockRequest({ body: validCreateDTO });
        const { res, jsonMock } = createMockResponse();

        (mockCreateUseCase.execute as jest.Mock).mockRejectedValue(
          sensitiveError
        );

        // Act
        await controller.create(mockReq as Request, res as Response);

        // Assert
        // Should log the full error server-side
        expect(mockLogger.error).toHaveBeenCalledWith(
          'Unexpected error in NetworkDeviceController',
          sensitiveError,
          expect.any(Object)
        );
        // Should NOT expose the error to the client
        expect(jsonMock).toHaveBeenCalledWith({
          success: false,
          error: 'Internal server error' // Generic message, not the SQL
        });
      });
    });
  });

  describe('getErrorStatusCode (via create method)', () => {
    /**
     * These tests verify the private getErrorStatusCode method
     * by observing the status code returned through the create method.
     */

    it('should prioritize "not found" over other error patterns', async () => {
      // "not found" should take precedence
      const mockReq = createMockRequest({ body: {} });
      const { res, statusMock } = createMockResponse();

      (mockCreateUseCase.execute as jest.Mock).mockResolvedValue(
        Result.fail('Invalid device not found in database')
      );

      await controller.create(mockReq as Request, res as Response);

      // "not found" is checked first, should return 404
      expect(statusMock).toHaveBeenCalledWith(404);
    });

    it('should prioritize conflict errors over validation errors', async () => {
      // "already exists" comes before "Invalid" in the check order
      const mockReq = createMockRequest({ body: {} });
      const { res, statusMock } = createMockResponse();

      (mockCreateUseCase.execute as jest.Mock).mockResolvedValue(
        Result.fail('Device already exists: Invalid operation')
      );

      await controller.create(mockReq as Request, res as Response);

      // "already exists" should match 409, not "Invalid" for 400
      expect(statusMock).toHaveBeenCalledWith(409);
    });
  });

  describe('handleUnexpectedError (via create method)', () => {
    it('should extract error message from Error objects', async () => {
      const error = new Error('Test error message');
      const mockReq = createMockRequest({ body: {} });
      const { res } = createMockResponse();

      (mockCreateUseCase.execute as jest.Mock).mockRejectedValue(
        error
      );

      await controller.create(mockReq as Request, res as Response);

      expect(mockLogger.error).toHaveBeenCalledWith(
        'Unexpected error in NetworkDeviceController',
        error,
        { error: 'Test error message' }
      );
    });

    it('should convert non-Error objects to strings', async () => {
      const mockReq = createMockRequest({ body: {} });
      const { res } = createMockResponse();

      (mockCreateUseCase.execute as jest.Mock).mockRejectedValue(
        12345
      );

      await controller.create(mockReq as Request, res as Response);

      expect(mockLogger.error).toHaveBeenCalledWith(
        'Unexpected error in NetworkDeviceController',
        12345,
        { error: '12345' }
      );
    });

    it('should handle null/undefined exceptions', async () => {
      const mockReq = createMockRequest({ body: {} });
      const { res, statusMock, jsonMock } = createMockResponse();

      (mockCreateUseCase.execute as jest.Mock).mockRejectedValue(
        null
      );

      await controller.create(mockReq as Request, res as Response);

      expect(statusMock).toHaveBeenCalledWith(500);
      expect(jsonMock).toHaveBeenCalledWith({
        success: false,
        error: 'Internal server error'
      });
    });
  });

  describe('Edge Cases', () => {
    it('should handle empty request body', async () => {
      const mockReq = createMockRequest({ body: {} });
      const { res } = createMockResponse();

      (mockCreateUseCase.execute as jest.Mock).mockResolvedValue(
        Result.fail('IP address is required')
      );

      await controller.create(mockReq as Request, res as Response);

      expect(mockCreateUseCase.execute).toHaveBeenCalledWith({});
    });

    it('should handle undefined request body', async () => {
      const mockReq = createMockRequest({ body: undefined });
      const { res } = createMockResponse();

      (mockCreateUseCase.execute as jest.Mock).mockResolvedValue(
        Result.ok({})
      );

      await controller.create(mockReq as Request, res as Response);

      expect(mockCreateUseCase.execute).toHaveBeenCalledWith(
        undefined
      );
    });

    it('should handle result with null error message', async () => {
      const mockReq = createMockRequest({ body: {} });
      const { res, statusMock } = createMockResponse();

      // Simulate a failure result with null error (edge case)
      const failureResult = {
        isFailure: true,
        isSuccess: false,
        error: null,
        value: null
      };

      (mockCreateUseCase.execute as jest.Mock).mockResolvedValue(
        failureResult
      );

      await controller.create(mockReq as Request, res as Response);

      // Should default to 500 when error message is null/undefined
      expect(statusMock).toHaveBeenCalledWith(500);
    });
  });
});
