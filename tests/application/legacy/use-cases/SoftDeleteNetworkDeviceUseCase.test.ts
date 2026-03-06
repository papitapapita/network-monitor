/**import { SoftDeleteNetworkDeviceUseCase } from '../../../src/application/use-cases/SoftDeleteNetworkDeviceUseCase';
import {
  Result,
  NetworkDevice,
  NetworkDeviceId,
  IPAddress,
  MACAddress,
  NetworkDeviceType,
  NetworkDeviceStatus,
  ConnectivityType,
  ManagementProtocol,
  PollingConfiguration,
  NetworkDeviceProps,
  ActivationStatus
} from '../../../src/domain';
import { INetworkDeviceRepository } from '../../../src/domain/repository/INetworkDeviceRepository';
import { ILogger } from '../../../src/application/interfaces/ILogger';
import { SoftDeleteNetworkDeviceRequestDTO } from '../../../src/application/dtos/network-device';

describe('SoftDeleteNetworkDeviceUseCase', () => {
  // ========================================
  // Mocks
  // ========================================

  let useCase: SoftDeleteNetworkDeviceUseCase;
  let mockRepository: jest.Mocked<INetworkDeviceRepository>;
  let mockLogger: jest.Mocked<ILogger>;

  beforeEach(() => {
    mockRepository = {
      save: jest.fn(),
      findById: jest.fn(),
      findByIpAddress: jest.fn(),
      findByMacAddress: jest.fn(),
      findAll: jest.fn(),
      existsByIpAddress: jest.fn(),
      existsByMacAddress: jest.fn(),
      delete: jest.fn(),
      saveMany: jest.fn()
    } as any;

    mockLogger = {
      info: jest.fn(),
      warn: jest.fn(),
      error: jest.fn(),
      debug: jest.fn()
    } as any;

    useCase = new SoftDeleteNetworkDeviceUseCase(
      mockRepository,
      mockLogger
    );
  });

  afterEach(() => {
    jest.clearAllMocks();
  });

  // ========================================
  // Test Data Helpers
  // ========================================

  const createMockActiveDevice = (): NetworkDevice => {
    const deviceId = NetworkDeviceId.create().value;
    const ipAddress = IPAddress.create('192.168.1.100').value;
    const macAddress = MACAddress.create('AA:BB:CC:DD:EE:FF').value;
    const pollingConfig =
      PollingConfiguration.createDefault(deviceId).value;

    const props: NetworkDeviceProps = {
      name: 'Router-Core-01',
      deviceType: NetworkDeviceType.ROUTER,
      status: NetworkDeviceStatus.ONLINE,
      description: 'Main core router',
      ipAddress,
      macAddress,
      connectivityType: ConnectivityType.ETHERNET,
      managementProtocol: ManagementProtocol.SNMP,
      managementPort: 161,
      enabledRemoteAccess: false,
      deviceId: 'device-001',
      pollingConfiguration: pollingConfig,
      location: 'Building A',
      installDate: new Date(),
      createdAt: new Date(),
      updatedAt: new Date()
    };

    const device = NetworkDevice.create(props, deviceId).value;
    // Activate the device
    device.activate('test-user');
    return device;
  };

  // ========================================
  // Success Cases
  // ========================================

  describe('Success Cases', () => {
    it('should soft-delete an ACTIVE device successfully', async () => {
      // Arrange
      const device = createMockActiveDevice();
      const request = {
        id: device.id.toString(),
        requestDTO: {
          reason: 'Device replaced with newer model'
        }
      };

      mockRepository.findById.mockResolvedValue(Result.ok(device));
      mockRepository.save.mockResolvedValue(Result.ok(undefined));

      // Act
      const result = await useCase.execute(request);

      // Assert
      expect(result.isSuccess).toBe(true);
      expect(result.value).toBeDefined();
      expect(result.value.deletedAt).toBeInstanceOf(Date);
      expect(result.value.deletedBy).toBe('system:admin');
      expect(result.value.deletionReason).toBe(
        'Device replaced with newer model'
      );
    });

    it('should allow soft-delete without reason', async () => {
      // Arrange
      const device = createMockActiveDevice();
      const request = {
        id: device.id.toString(),
        requestDTO: {}
      };

      mockRepository.findById.mockResolvedValue(Result.ok(device));
      mockRepository.save.mockResolvedValue(Result.ok(undefined));

      // Act
      const result = await useCase.execute(request);

      // Assert
      expect(result.isSuccess).toBe(true);
      expect(result.value.deletedAt).toBeInstanceOf(Date);
      expect(result.value.deletionReason).toBeUndefined();
    });

    it('should call repository.save() with soft-deleted device', async () => {
      // Arrange
      const device = createMockActiveDevice();
      const request = {
        id: device.id.toString(),
        requestDTO: {
          reason: 'Test reason'
        }
      };

      mockRepository.findById.mockResolvedValue(Result.ok(device));
      mockRepository.save.mockResolvedValue(Result.ok(undefined));

      // Act
      await useCase.execute(request);

      // Assert
      expect(mockRepository.save).toHaveBeenCalledTimes(1);
      const savedDevice = mockRepository.save.mock.calls[0][0];
      expect(savedDevice).toBeInstanceOf(NetworkDevice);
      expect(savedDevice.deletedAt).toBeInstanceOf(Date);
    });

    it('should soft-delete DRAFT device successfully', async () => {
      // Arrange
      const device = createMockActiveDevice();
      // Create a draft device (not activated)
      const deviceId = NetworkDeviceId.create().value;
      const ipAddress = IPAddress.create('192.168.1.101').value;
      const macAddress = MACAddress.create('BB:CC:DD:EE:FF:00').value;
      const pollingConfig =
        PollingConfiguration.createDefault(deviceId).value;

      const draftProps: NetworkDeviceProps = {
        name: null,
        deviceType: NetworkDeviceType.UNKNOWN,
        status: NetworkDeviceStatus.OFFLINE,
        description: null,
        ipAddress,
        macAddress,
        connectivityType: ConnectivityType.ETHERNET,
        managementProtocol: ManagementProtocol.SNMP,
        managementPort: 161,
        enabledRemoteAccess: false,
        deviceId: 'device-002',
        pollingConfiguration: pollingConfig,
        location: null,
        installDate: new Date(),
        createdAt: new Date(),
        updatedAt: new Date()
      };

      const draftDevice = NetworkDevice.create(
        draftProps,
        deviceId
      ).value;

      const request = {
        id: draftDevice.id.toString(),
        requestDTO: {
          reason: 'Duplicate discovered'
        }
      };

      mockRepository.findById.mockResolvedValue(
        Result.ok(draftDevice)
      );
      mockRepository.save.mockResolvedValue(Result.ok(undefined));

      // Act
      const result = await useCase.execute(request);

      // Assert
      expect(result.isSuccess).toBe(true);
      expect(result.value.deletedAt).toBeInstanceOf(Date);
      expect(result.value.activationStatus).toBe(
        ActivationStatus.DRAFT
      );
    });
  });

  // ========================================
  // Validation Tests
  // ========================================

  describe('Input Validation', () => {
    it('should fail when device ID is missing', async () => {
      // Arrange
      const request = {
        id: '',
        requestDTO: {}
      };

      // Act
      const result = await useCase.execute(request);

      // Assert
      expect(result.isFailure).toBe(true);
      expect(result.error).toContain('Device ID is required');
    });

    it('should fail when reason exceeds 500 characters', async () => {
      // Arrange
      const device = createMockActiveDevice();
      const request = {
        id: device.id.toString(),
        requestDTO: {
          reason: 'A'.repeat(501) // 501 characters
        }
      };

      // Act
      const result = await useCase.execute(request);

      // Assert
      expect(result.isFailure).toBe(true);
      expect(result.error).toContain('500 characters');
    });

    it('should accept reason with exactly 500 characters', async () => {
      // Arrange
      const device = createMockActiveDevice();
      const longReason = 'A'.repeat(500); // Exactly 500
      const request = {
        id: device.id.toString(),
        requestDTO: {
          reason: longReason
        }
      };

      mockRepository.findById.mockResolvedValue(Result.ok(device));
      mockRepository.save.mockResolvedValue(Result.ok(undefined));

      // Act
      const result = await useCase.execute(request);

      // Assert
      expect(result.isSuccess).toBe(true);
      expect(result.value.deletionReason).toBe(longReason);
    });
  });

  // ========================================
  // Business Rules Validation Tests
  // ========================================

  describe('Business Rules', () => {
    it('should fail when device does not exist', async () => {
      // Arrange
      const request = {
        id: NetworkDeviceId.create().value.toString(),
        requestDTO: {}
      };

      mockRepository.findById.mockResolvedValue(Result.ok(null));

      // Act
      const result = await useCase.execute(request);

      // Assert
      expect(result.isFailure).toBe(true);
      expect(result.error).toContain('not found');
      expect(mockRepository.save).not.toHaveBeenCalled();
    });

    it('should fail when device is already soft-deleted', async () => {
      // Arrange
      const device = createMockActiveDevice();
      // Manually soft-delete device first
      device.softDelete('first-user', 'First deletion');

      const request = {
        id: device.id.toString(),
        requestDTO: {
          reason: 'Second deletion attempt'
        }
      };

      mockRepository.findById.mockResolvedValue(Result.ok(device));

      // Act
      const result = await useCase.execute(request);

      // Assert
      expect(result.isFailure).toBe(true);
      expect(result.error).toContain('already soft-deleted');
      expect(result.error).toContain('RestoreNetworkDeviceUseCase');
      expect(mockRepository.save).not.toHaveBeenCalled();
    });

    it('should include deletion timestamp in error for already soft-deleted device', async () => {
      // Arrange
      const device = createMockActiveDevice();
      device.softDelete('test-user');
      const deletedAt = device.deletedAt;

      const request = {
        id: device.id.toString(),
        requestDTO: {}
      };

      mockRepository.findById.mockResolvedValue(Result.ok(device));

      // Act
      const result = await useCase.execute(request);

      // Assert
      expect(result.isFailure).toBe(true);
      expect(result.error).toContain(deletedAt!.toISOString());
    });
  });

  // ========================================
  // Repository Interaction Tests
  // ========================================

  describe('Repository Interactions', () => {
    it('should load device by ID', async () => {
      // Arrange
      const device = createMockActiveDevice();
      const request = {
        id: device.id.toString(),
        requestDTO: {}
      };

      mockRepository.findById.mockResolvedValue(Result.ok(device));
      mockRepository.save.mockResolvedValue(Result.ok(undefined));

      // Act
      await useCase.execute(request);

      // Assert
      expect(mockRepository.findById).toHaveBeenCalledTimes(1);
      const calledWithId =
        mockRepository.findById.mock.calls[0][0];
      expect(calledWithId).toBeInstanceOf(NetworkDeviceId);
      expect(calledWithId.toString()).toBe(device.id.toString());
    });

    it('should handle repository findById error', async () => {
      // Arrange
      const request = {
        id: NetworkDeviceId.create().value.toString(),
        requestDTO: {}
      };

      mockRepository.findById.mockResolvedValue(
        Result.fail('Database connection error')
      );

      // Act
      const result = await useCase.execute(request);

      // Assert
      expect(result.isFailure).toBe(true);
      expect(result.error).toContain('Error loading device');
      expect(mockRepository.save).not.toHaveBeenCalled();
    });

    it('should handle repository save error', async () => {
      // Arrange
      const device = createMockActiveDevice();
      const request = {
        id: device.id.toString(),
        requestDTO: {}
      };

      mockRepository.findById.mockResolvedValue(Result.ok(device));
      mockRepository.save.mockResolvedValue(
        Result.fail('Database write error')
      );

      // Act
      const result = await useCase.execute(request);

      // Assert
      expect(result.isFailure).toBe(true);
      expect(result.error).toContain('Failed to save');
    });
  });

  // ========================================
  // Edge Cases
  // ========================================

  describe('Edge Cases', () => {
    it('should handle null reason', async () => {
      // Arrange
      const device = createMockActiveDevice();
      const request = {
        id: device.id.toString(),
        requestDTO: {
          reason: null
        }
      };

      mockRepository.findById.mockResolvedValue(Result.ok(device));
      mockRepository.save.mockResolvedValue(Result.ok(undefined));

      // Act
      const result = await useCase.execute(request);

      // Assert
      expect(result.isSuccess).toBe(true);
      expect(result.value.deletionReason).toBeUndefined();
    });

    it('should handle empty string reason', async () => {
      // Arrange
      const device = createMockActiveDevice();
      const request = {
        id: device.id.toString(),
        requestDTO: {
          reason: ''
        }
      };

      mockRepository.findById.mockResolvedValue(Result.ok(device));
      mockRepository.save.mockResolvedValue(Result.ok(undefined));

      // Act
      const result = await useCase.execute(request);

      // Assert
      expect(result.isSuccess).toBe(true);
    });

    it('should preserve device data after soft-delete', async () => {
      // Arrange
      const device = createMockActiveDevice();
      const originalName = device.name;
      const originalIp = device.ipAddress.toString();

      const request = {
        id: device.id.toString(),
        requestDTO: {}
      };

      mockRepository.findById.mockResolvedValue(Result.ok(device));
      mockRepository.save.mockResolvedValue(Result.ok(undefined));

      // Act
      const result = await useCase.execute(request);

      // Assert
      expect(result.isSuccess).toBe(true);
      expect(result.value.name).toBe(originalName);
      expect(result.value.ipAddress).toBe(originalIp);
    });
  });

  // ========================================
  // Logging Tests
  // ========================================

  describe('Logging', () => {
    it('should log soft-deletion', async () => {
      // Arrange
      const device = createMockActiveDevice();
      const request = {
        id: device.id.toString(),
        requestDTO: {}
      };

      mockRepository.findById.mockResolvedValue(Result.ok(device));
      mockRepository.save.mockResolvedValue(Result.ok(undefined));

      // Act
      await useCase.execute(request);

      // Assert
      expect(mockLogger.info).toHaveBeenCalled();
    });
  });
});
*/
