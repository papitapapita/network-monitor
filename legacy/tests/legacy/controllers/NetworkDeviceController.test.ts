import { Request, Response } from 'express';
import { NetworkDeviceController } from '../../../src/presentation/http/controllers/NetworkDeviceController';
import { CreateNetworkDeviceUseCase } from '../../../src/application/device-inventory/use-cases/CreateNetworkDeviceUseCase';
import { GetNetworkDeviceUseCase } from '../../../src/application/device-inventory/use-cases/GetNetworkDeviceUseCase';
import { GetNetworkDeviceByIpUseCase } from '../../../src/application/device-inventory/use-cases/GetNetworkDeviceByIpUseCase';
import { UpdateNetworkDeviceUseCase } from '../../../src/application/device-inventory/use-cases/UpdateNetworkDeviceUseCase';
import { DeleteNetworkDeviceUseCase } from '../../../src/application/device-inventory/use-cases/DeleteNetworkDeviceUseCase';
import { ListNetworkDevicesUseCase } from '../../../src/application/device-inventory/use-cases/ListNetworkDevicesUseCase';
import { ActivateNetworkDeviceUseCase } from '../../../src/application/device-inventory/use-cases/ActivateNetworkDeviceUseCase';
import { SoftDeleteNetworkDeviceUseCase } from '../../../src/application/device-inventory/use-cases/SoftDeleteNetworkDeviceUseCase';
import { RestoreNetworkDeviceUseCase } from '../../../src/application/device-inventory/use-cases/RestoreNetworkDeviceUseCase';
import { ILogger } from '../../../../src/application/shared/interfaces/ILogger';
import { Result } from '../../../../src/domain/shared';
import { NetworkDeviceResponseDTO } from '../../../src/application/dtos/network-device/NetworkDeviceDTO';

describe('NetworkDeviceController Integration Tests', () => {
  // ========================================
  // Mocks
  // ========================================

  let controller: NetworkDeviceController;
  let mockCreateUseCase: jest.Mocked<CreateNetworkDeviceUseCase>;
  let mockGetUseCase: jest.Mocked<GetNetworkDeviceUseCase>;
  let mockGetByIpUseCase: jest.Mocked<GetNetworkDeviceByIpUseCase>;
  let mockUpdateUseCase: jest.Mocked<UpdateNetworkDeviceUseCase>;
  let mockDeleteUseCase: jest.Mocked<DeleteNetworkDeviceUseCase>;
  let mockListUseCase: jest.Mocked<ListNetworkDevicesUseCase>;
  let mockActivateUseCase: jest.Mocked<ActivateNetworkDeviceUseCase>;
  let mockSoftDeleteUseCase: jest.Mocked<SoftDeleteNetworkDeviceUseCase>;
  let mockRestoreUseCase: jest.Mocked<RestoreNetworkDeviceUseCase>;
  let mockLogger: jest.Mocked<ILogger>;

  let mockReq: Partial<Request>;
  let mockRes: Partial<Response>;
  let jsonMock: jest.Mock;
  let statusMock: jest.Mock;
  let sendMock: jest.Mock;

  beforeEach(() => {
    // Mock use cases
    mockCreateUseCase = { execute: jest.fn() } as any;
    mockGetUseCase = { execute: jest.fn() } as any;
    mockGetByIpUseCase = { execute: jest.fn() } as any;
    mockUpdateUseCase = { execute: jest.fn() } as any;
    mockDeleteUseCase = { execute: jest.fn() } as any;
    mockListUseCase = { execute: jest.fn() } as any;
    mockActivateUseCase = { execute: jest.fn() } as any;
    mockSoftDeleteUseCase = { execute: jest.fn() } as any;
    mockRestoreUseCase = { execute: jest.fn() } as any;

    mockLogger = {
      info: jest.fn(),
      warn: jest.fn(),
      error: jest.fn(),
      debug: jest.fn()
    } as any;

    controller = new NetworkDeviceController(
      mockCreateUseCase,
      mockGetUseCase,
      mockGetByIpUseCase,
      mockUpdateUseCase,
      mockDeleteUseCase,
      mockListUseCase,
      mockActivateUseCase,
      mockSoftDeleteUseCase,
      mockRestoreUseCase,
      mockLogger
    );

    // Mock Express Request and Response
    jsonMock = jest.fn();
    statusMock = jest
      .fn()
      .mockReturnValue({ json: jsonMock, send: jest.fn() });
    sendMock = jest.fn();

    mockReq = {
      body: {},
      params: {},
      query: {}
    };

    mockRes = {
      status: statusMock,
      json: jsonMock,
      send: sendMock
    };
  });

  afterEach(() => {
    jest.clearAllMocks();
  });

  // ========================================
  // Helper Functions
  // ========================================

  const createMockDeviceResponse = (): NetworkDeviceResponseDTO => ({
    id: '123e4567-e89b-12d3-a456-426614174000',
    name: 'Router-Core-01',
    deviceType: 'ROUTER',
    status: 'ONLINE',
    description: 'Main core router',
    ipAddress: '192.168.1.100',
    macAddress: 'AA:BB:CC:DD:EE:FF',
    connectivityType: 'ETHERNET',
    managementProtocol: 'SNMP',
    managementPort: 161,
    enabledRemoteAccess: false,
    deviceId: 'device-001',
    location: 'Building A',
    activationStatus: 'ACTIVE',
    activatedAt: new Date().toISOString(),
    activatedBy: 'test-user',
    createdAt: new Date().toISOString(),
    updatedAt: new Date().toISOString(),
    deletedAt: null,
    deletedBy: null,
    deletionReason: null,
    pollingConfiguration: {
      id: '123e4567-e89b-12d3-a456-426614174001',
      deviceId: '123e4567-e89b-12d3-a456-426614174000',
      intervalSeconds: 60,
      retryAttempts: 3,
      enabled: true
    }
  });

  // ========================================
  // POST /api/network-devices - Create
  // ========================================

  describe('POST /api/network-devices - Create', () => {
    it('should create device successfully and return 201', async () => {
      // Arrange
      const deviceResponse = createMockDeviceResponse();
      mockReq.body = {
        ipAddress: '192.168.1.100',
        macAddress: 'AA:BB:CC:DD:EE:FF',
        deviceId: 'device-001',
        activateImmediately: false
      };

      mockCreateUseCase.execute.mockResolvedValue(
        Result.ok(deviceResponse)
      );

      // Act
      await controller.create(
        mockReq as Request,
        mockRes as Response
      );

      // Assert
      expect(mockCreateUseCase.execute).toHaveBeenCalledWith(
        mockReq.body
      );
      expect(statusMock).toHaveBeenCalledWith(201);
      expect(jsonMock).toHaveBeenCalledWith({
        success: true,
        data: deviceResponse
      });
    });

    it('should return 409 for duplicate IP address', async () => {
      // Arrange
      mockReq.body = {
        ipAddress: '192.168.1.100',
        macAddress: 'AA:BB:CC:DD:EE:FF',
        deviceId: 'device-001'
      };

      mockCreateUseCase.execute.mockResolvedValue(
        Result.fail('Device with IP 192.168.1.100 already exists')
      );

      // Act
      await controller.create(
        mockReq as Request,
        mockRes as Response
      );

      // Assert
      expect(statusMock).toHaveBeenCalledWith(409);
      expect(jsonMock).toHaveBeenCalledWith({
        success: false,
        error: expect.stringContaining('already exists')
      });
    });

    it('should return 400 for validation errors', async () => {
      // Arrange
      mockReq.body = {
        ipAddress: 'invalid-ip',
        macAddress: 'AA:BB:CC:DD:EE:FF'
      };

      mockCreateUseCase.execute.mockResolvedValue(
        Result.fail('Invalid IP address format')
      );

      // Act
      await controller.create(
        mockReq as Request,
        mockRes as Response
      );

      // Assert
      expect(statusMock).toHaveBeenCalledWith(400);
      expect(jsonMock).toHaveBeenCalledWith({
        success: false,
        error: expect.stringContaining('Invalid')
      });
    });
  });

  // ========================================
  // GET /api/network-devices - List
  // ========================================

  describe('GET /api/network-devices - List', () => {
    it('should list devices with default pagination', async () => {
      // Arrange
      const listResponse = {
        devices: [createMockDeviceResponse()],
        total: 1,
        limit: 20,
        offset: 0,
        hasMore: false
      };

      mockListUseCase.execute.mockResolvedValue(
        Result.ok(listResponse)
      );

      // Act
      await controller.list(mockReq as Request, mockRes as Response);

      // Assert
      expect(statusMock).toHaveBeenCalledWith(200);
      expect(jsonMock).toHaveBeenCalledWith({
        success: true,
        data: listResponse
      });
    });

    it('should apply custom limit and offset', async () => {
      // Arrange
      mockReq.query = { limit: '10', offset: '5' };
      const listResponse = {
        devices: [createMockDeviceResponse()],
        total: 25,
        limit: 10,
        offset: 5,
        hasMore: true
      };

      mockListUseCase.execute.mockResolvedValue(
        Result.ok(listResponse)
      );

      // Act
      await controller.list(mockReq as Request, mockRes as Response);

      // Assert
      expect(mockListUseCase.execute).toHaveBeenCalledWith({
        limit: 10,
        offset: 5,
        status: undefined,
        deviceType: undefined,
        activationStatus: undefined
      });
      expect(statusMock).toHaveBeenCalledWith(200);
    });

    it('should filter by status', async () => {
      // Arrange
      mockReq.query = { status: 'ONLINE' };
      const listResponse = {
        devices: [createMockDeviceResponse()],
        total: 1,
        limit: 20,
        offset: 0,
        hasMore: false
      };

      mockListUseCase.execute.mockResolvedValue(
        Result.ok(listResponse)
      );

      // Act
      await controller.list(mockReq as Request, mockRes as Response);

      // Assert
      expect(mockListUseCase.execute).toHaveBeenCalledWith(
        expect.objectContaining({ status: 'ONLINE' })
      );
    });
  });

  // ========================================
  // GET /api/network-devices/:id - Get by ID
  // ========================================

  describe('GET /api/network-devices/:id - Get by ID', () => {
    it('should get device by ID successfully', async () => {
      // Arrange
      const deviceResponse = createMockDeviceResponse();
      mockReq.params = { id: '123e4567-e89b-12d3-a456-426614174000' };

      mockGetUseCase.execute.mockResolvedValue(
        Result.ok(deviceResponse)
      );

      // Act
      await controller.getById(
        mockReq as Request,
        mockRes as Response
      );

      // Assert
      expect(mockGetUseCase.execute).toHaveBeenCalledWith({
        id: '123e4567-e89b-12d3-a456-426614174000'
      });
      expect(statusMock).toHaveBeenCalledWith(200);
      expect(jsonMock).toHaveBeenCalledWith({
        success: true,
        data: deviceResponse
      });
    });

    it('should return 404 when device not found', async () => {
      // Arrange
      mockReq.params = { id: '123e4567-e89b-12d3-a456-426614174000' };

      mockGetUseCase.execute.mockResolvedValue(
        Result.fail(
          'Network device with ID 123e4567-e89b-12d3-a456-426614174000 not found'
        )
      );

      // Act
      await controller.getById(
        mockReq as Request,
        mockRes as Response
      );

      // Assert
      expect(statusMock).toHaveBeenCalledWith(404);
      expect(jsonMock).toHaveBeenCalledWith({
        success: false,
        error: expect.stringContaining('not found')
      });
    });

    it('should return 400 for invalid ID format', async () => {
      // Arrange
      mockReq.params = { id: 'invalid-uuid' };

      mockGetUseCase.execute.mockResolvedValue(
        Result.fail('Invalid device ID: invalid-uuid')
      );

      // Act
      await controller.getById(
        mockReq as Request,
        mockRes as Response
      );

      // Assert
      expect(statusMock).toHaveBeenCalledWith(400);
    });
  });

  // ========================================
  // GET /api/network-devices/by-ip - Get by IP
  // ========================================

  describe('GET /api/network-devices/by-ip - Get by IP', () => {
    it('should get device by IP successfully', async () => {
      // Arrange
      const deviceResponse = createMockDeviceResponse();
      mockReq.query = { ip: '192.168.1.100' };

      mockGetByIpUseCase.execute.mockResolvedValue(
        Result.ok(deviceResponse)
      );

      // Act
      await controller.getByIp(
        mockReq as Request,
        mockRes as Response
      );

      // Assert
      expect(mockGetByIpUseCase.execute).toHaveBeenCalledWith({
        ipAddress: '192.168.1.100'
      });
      expect(statusMock).toHaveBeenCalledWith(200);
    });

    it('should return 404 when device with IP not found', async () => {
      // Arrange
      mockReq.query = { ip: '192.168.1.200' };

      mockGetByIpUseCase.execute.mockResolvedValue(
        Result.fail('Network device with IP 192.168.1.200 not found')
      );

      // Act
      await controller.getByIp(
        mockReq as Request,
        mockRes as Response
      );

      // Assert
      expect(statusMock).toHaveBeenCalledWith(404);
    });
  });

  // ========================================
  // PUT /api/network-devices/:id - Update
  // ========================================

  describe('PUT /api/network-devices/:id - Update', () => {
    it('should update device successfully', async () => {
      // Arrange
      const updatedDevice = createMockDeviceResponse();
      updatedDevice.name = 'Router-Core-01-Updated';

      mockReq.params = { id: '123e4567-e89b-12d3-a456-426614174000' };
      mockReq.body = { name: 'Router-Core-01-Updated' };

      mockUpdateUseCase.execute.mockResolvedValue(
        Result.ok(updatedDevice)
      );

      // Act
      await controller.update(
        mockReq as Request,
        mockRes as Response
      );

      // Assert
      expect(mockUpdateUseCase.execute).toHaveBeenCalledWith({
        id: '123e4567-e89b-12d3-a456-426614174000',
        name: 'Router-Core-01-Updated'
      });
      expect(statusMock).toHaveBeenCalledWith(200);
      expect(jsonMock).toHaveBeenCalledWith({
        success: true,
        data: updatedDevice
      });
    });

    it('should return 422 when updating soft-deleted device', async () => {
      // Arrange
      mockReq.params = { id: '123e4567-e89b-12d3-a456-426614174000' };
      mockReq.body = { name: 'Updated' };

      mockUpdateUseCase.execute.mockResolvedValue(
        Result.fail(
          'Cannot update soft-deleted device. Restore it first using RestoreNetworkDeviceUseCase.'
        )
      );

      // Act
      await controller.update(
        mockReq as Request,
        mockRes as Response
      );

      // Assert
      expect(statusMock).toHaveBeenCalledWith(422);
    });
  });

  // ========================================
  // DELETE /api/network-devices/:id - Hard Delete
  // ========================================

  describe('DELETE /api/network-devices/:id - Hard Delete', () => {
    it('should delete device successfully and return 204', async () => {
      // Arrange
      mockReq.params = { id: '123e4567-e89b-12d3-a456-426614174000' };

      mockDeleteUseCase.execute.mockResolvedValue(
        Result.ok(undefined)
      );

      // Act
      await controller.delete(
        mockReq as Request,
        mockRes as Response
      );

      // Assert
      expect(mockDeleteUseCase.execute).toHaveBeenCalledWith({
        id: '123e4567-e89b-12d3-a456-426614174000'
      });
      expect(statusMock).toHaveBeenCalledWith(204);
    });

    it('should return 404 when device not found', async () => {
      // Arrange
      mockReq.params = { id: '123e4567-e89b-12d3-a456-426614174000' };

      mockDeleteUseCase.execute.mockResolvedValue(
        Result.fail(
          'Network device with ID 123e4567-e89b-12d3-a456-426614174000 not found'
        )
      );

      // Act
      await controller.delete(
        mockReq as Request,
        mockRes as Response
      );

      // Assert
      expect(statusMock).toHaveBeenCalledWith(404);
    });
  });

  // ========================================
  // POST /api/network-devices/:id/activate - Activate
  // ========================================

  describe('POST /api/network-devices/:id/activate - Activate', () => {
    it('should activate DRAFT device successfully', async () => {
      // Arrange
      const activatedDevice = createMockDeviceResponse();
      activatedDevice.activationStatus = 'ACTIVE';

      mockReq.params = { id: '123e4567-e89b-12d3-a456-426614174000' };
      mockReq.body = {
        name: 'Router-Core-01',
        deviceType: 'ROUTER'
      };

      mockActivateUseCase.execute.mockResolvedValue(
        Result.ok(activatedDevice)
      );

      // Act
      await controller.activate(
        mockReq as Request,
        mockRes as Response
      );

      // Assert
      expect(mockActivateUseCase.execute).toHaveBeenCalledWith({
        id: '123e4567-e89b-12d3-a456-426614174000',
        requestDTO: mockReq.body
      });
      expect(statusMock).toHaveBeenCalledWith(200);
      expect(jsonMock).toHaveBeenCalledWith({
        success: true,
        data: activatedDevice
      });
    });

    it('should return 422 when device is already ACTIVE', async () => {
      // Arrange
      mockReq.params = { id: '123e4567-e89b-12d3-a456-426614174000' };
      mockReq.body = {
        name: 'Router-Core-01',
        deviceType: 'ROUTER'
      };

      mockActivateUseCase.execute.mockResolvedValue(
        Result.fail('Device is already ACTIVE')
      );

      // Act
      await controller.activate(
        mockReq as Request,
        mockRes as Response
      );

      // Assert
      expect(statusMock).toHaveBeenCalledWith(422);
      expect(jsonMock).toHaveBeenCalledWith({
        success: false,
        error: expect.stringContaining('already ACTIVE')
      });
    });

    it('should return 422 when activating soft-deleted device', async () => {
      // Arrange
      mockReq.params = { id: '123e4567-e89b-12d3-a456-426614174000' };
      mockReq.body = {
        name: 'Router-Core-01',
        deviceType: 'ROUTER'
      };

      mockActivateUseCase.execute.mockResolvedValue(
        Result.fail(
          'Cannot activate soft-deleted device. Restore it first.'
        )
      );

      // Act
      await controller.activate(
        mockReq as Request,
        mockRes as Response
      );

      // Assert
      expect(statusMock).toHaveBeenCalledWith(422);
    });
  });

  // ========================================
  // DELETE /api/network-devices/:id/soft - Soft Delete
  // ========================================

  describe('DELETE /api/network-devices/:id/soft - Soft Delete', () => {
    it('should soft-delete device successfully', async () => {
      // Arrange
      const softDeletedDevice = createMockDeviceResponse();
      softDeletedDevice.deletedAt = new Date().toISOString();
      softDeletedDevice.deletedBy = 'system:admin';

      mockReq.params = { id: '123e4567-e89b-12d3-a456-426614174000' };
      mockReq.body = { reason: 'Device replaced' };

      mockSoftDeleteUseCase.execute.mockResolvedValue(
        Result.ok(softDeletedDevice)
      );

      // Act
      await controller.softDelete(
        mockReq as Request,
        mockRes as Response
      );

      // Assert
      expect(mockSoftDeleteUseCase.execute).toHaveBeenCalledWith({
        id: '123e4567-e89b-12d3-a456-426614174000',
        requestDTO: mockReq.body
      });
      expect(statusMock).toHaveBeenCalledWith(200);
      expect(jsonMock).toHaveBeenCalledWith({
        success: true,
        data: softDeletedDevice
      });
    });

    it('should return 422 when device is already soft-deleted', async () => {
      // Arrange
      mockReq.params = { id: '123e4567-e89b-12d3-a456-426614174000' };

      mockSoftDeleteUseCase.execute.mockResolvedValue(
        Result.fail('Device is already soft-deleted')
      );

      // Act
      await controller.softDelete(
        mockReq as Request,
        mockRes as Response
      );

      // Assert
      expect(statusMock).toHaveBeenCalledWith(422);
    });
  });

  // ========================================
  // POST /api/network-devices/:id/restore - Restore
  // ========================================

  describe('POST /api/network-devices/:id/restore - Restore', () => {
    it('should restore soft-deleted device successfully', async () => {
      // Arrange
      const restoredDevice = createMockDeviceResponse();
      restoredDevice.deletedAt = null;
      restoredDevice.deletedBy = null;

      mockReq.params = { id: '123e4567-e89b-12d3-a456-426614174000' };
      mockReq.body = {};

      mockRestoreUseCase.execute.mockResolvedValue(
        Result.ok(restoredDevice)
      );

      // Act
      await controller.restore(
        mockReq as Request,
        mockRes as Response
      );

      // Assert
      expect(mockRestoreUseCase.execute).toHaveBeenCalledWith({
        id: '123e4567-e89b-12d3-a456-426614174000',
        requestDTO: {}
      });
      expect(statusMock).toHaveBeenCalledWith(200);
      expect(jsonMock).toHaveBeenCalledWith({
        success: true,
        data: restoredDevice
      });
    });

    it('should return 410 when grace period has expired', async () => {
      // Arrange
      mockReq.params = { id: '123e4567-e89b-12d3-a456-426614174000' };

      mockRestoreUseCase.execute.mockResolvedValue(
        Result.fail(
          'Cannot restore device. The 7-day grace period has expired (deleted 8 days ago)'
        )
      );

      // Act
      await controller.restore(
        mockReq as Request,
        mockRes as Response
      );

      // Assert
      expect(statusMock).toHaveBeenCalledWith(410);
      expect(jsonMock).toHaveBeenCalledWith({
        success: false,
        error: expect.stringContaining('grace period has expired')
      });
    });

    it('should return 409 when IP/MAC conflict exists', async () => {
      // Arrange
      mockReq.params = { id: '123e4567-e89b-12d3-a456-426614174000' };

      mockRestoreUseCase.execute.mockResolvedValue(
        Result.fail(
          'Cannot restore device. IP address 192.168.1.100 is now in use by another device'
        )
      );

      // Act
      await controller.restore(
        mockReq as Request,
        mockRes as Response
      );

      // Assert
      expect(statusMock).toHaveBeenCalledWith(409);
    });

    it('should return 422 when device is not soft-deleted', async () => {
      // Arrange
      mockReq.params = { id: '123e4567-e89b-12d3-a456-426614174000' };

      mockRestoreUseCase.execute.mockResolvedValue(
        Result.fail('Device is not soft-deleted')
      );

      // Act
      await controller.restore(
        mockReq as Request,
        mockRes as Response
      );

      // Assert
      expect(statusMock).toHaveBeenCalledWith(422);
    });
  });

  // ========================================
  // Error Handling Tests
  // ========================================

  describe('Error Handling', () => {
    it('should handle unexpected errors with 500 status', async () => {
      // Arrange
      mockReq.body = { ipAddress: '192.168.1.100' };
      mockCreateUseCase.execute.mockRejectedValue(
        new Error('Unexpected database error')
      );

      // Act
      await controller.create(
        mockReq as Request,
        mockRes as Response
      );

      // Assert
      expect(statusMock).toHaveBeenCalledWith(500);
      expect(jsonMock).toHaveBeenCalledWith({
        success: false,
        error: 'Internal server error'
      });
      expect(mockLogger.error).toHaveBeenCalled();
    });

    it('should log unexpected errors', async () => {
      // Arrange
      mockReq.body = { ipAddress: '192.168.1.100' };
      const error = new Error('Database connection lost');
      mockCreateUseCase.execute.mockRejectedValue(error);

      // Act
      await controller.create(
        mockReq as Request,
        mockRes as Response
      );

      // Assert
      expect(mockLogger.error).toHaveBeenCalledWith(
        'Unexpected error in NetworkDeviceController',
        error,
        expect.any(Object)
      );
    });
  });
});
