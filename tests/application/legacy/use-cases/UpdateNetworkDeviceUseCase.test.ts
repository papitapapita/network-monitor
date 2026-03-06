/**import { UpdateNetworkDeviceUseCase } from '../../../src/application/use-cases/UpdateNetworkDeviceUseCase';
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
  NetworkDeviceProps
} from '../../../src/domain';
import { INetworkDeviceRepository } from '../../../src/domain/repository/INetworkDeviceRepository';
import { ILogger } from '../../../src/application/interfaces/ILogger';
import { UpdateNetworkDeviceRequest } from '../../../src/application/use-cases/UpdateNetworkDeviceUseCase';

describe('UpdateNetworkDeviceUseCase', () => {
  // ========================================
  // Mocks
  // ========================================

  let useCase: UpdateNetworkDeviceUseCase;
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

    useCase = new UpdateNetworkDeviceUseCase(mockRepository, mockLogger);
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
    device.activate('test-user');
    return device;
  };

  // ========================================
  // Success Cases
  // ========================================

  describe('Success Cases', () => {
    it('should update name only', async () => {
      // Arrange
      const device = createMockActiveDevice();
      const request: UpdateNetworkDeviceRequest = {
        id: device.id.toString(),
        name: 'Router-Core-01-Updated'
      };

      mockRepository.findById.mockResolvedValue(Result.ok(device));
      mockRepository.save.mockResolvedValue(Result.ok(undefined));

      // Act
      const result = await useCase.execute(request);

      // Assert
      expect(result.isSuccess).toBe(true);
      expect(result.value.name).toBe('Router-Core-01-Updated');
      expect(mockRepository.save).toHaveBeenCalledTimes(1);
    });

    it('should update description only', async () => {
      // Arrange
      const device = createMockActiveDevice();
      const request: UpdateNetworkDeviceRequest = {
        id: device.id.toString(),
        description: 'Updated description'
      };

      mockRepository.findById.mockResolvedValue(Result.ok(device));
      mockRepository.save.mockResolvedValue(Result.ok(undefined));

      // Act
      const result = await useCase.execute(request);

      // Assert
      expect(result.isSuccess).toBe(true);
      expect(result.value.description).toBe('Updated description');
    });

    it('should update location only (REQ-002)', async () => {
      // Arrange
      const device = createMockActiveDevice();
      const request: UpdateNetworkDeviceRequest = {
        id: device.id.toString(),
        location: 'Building B Floor 3'
      };

      mockRepository.findById.mockResolvedValue(Result.ok(device));
      mockRepository.save.mockResolvedValue(Result.ok(undefined));

      // Act
      const result = await useCase.execute(request);

      // Assert
      expect(result.isSuccess).toBe(true);
      expect(result.value.location).toBe('Building B Floor 3');
    });

    it('should update management protocol only', async () => {
      // Arrange
      const device = createMockActiveDevice();
      const request: UpdateNetworkDeviceRequest = {
        id: device.id.toString(),
        managementProtocol: 'SSH'
      };

      mockRepository.findById.mockResolvedValue(Result.ok(device));
      mockRepository.save.mockResolvedValue(Result.ok(undefined));

      // Act
      const result = await useCase.execute(request);

      // Assert
      expect(result.isSuccess).toBe(true);
      expect(result.value.managementProtocol).toBe('SSH');
    });

    it('should update management port only', async () => {
      // Arrange
      const device = createMockActiveDevice();
      const request: UpdateNetworkDeviceRequest = {
        id: device.id.toString(),
        managementPort: 22
      };

      mockRepository.findById.mockResolvedValue(Result.ok(device));
      mockRepository.save.mockResolvedValue(Result.ok(undefined));

      // Act
      const result = await useCase.execute(request);

      // Assert
      expect(result.isSuccess).toBe(true);
      expect(result.value.managementPort).toBe(22);
    });

    it('should update enabledRemoteAccess only', async () => {
      // Arrange
      const device = createMockActiveDevice();
      const request: UpdateNetworkDeviceRequest = {
        id: device.id.toString(),
        enabledRemoteAccess: true
      };

      mockRepository.findById.mockResolvedValue(Result.ok(device));
      mockRepository.save.mockResolvedValue(Result.ok(undefined));

      // Act
      const result = await useCase.execute(request);

      // Assert
      expect(result.isSuccess).toBe(true);
      expect(result.value.enabledRemoteAccess).toBe(true);
    });

    it('should update multiple fields at once', async () => {
      // Arrange
      const device = createMockActiveDevice();
      const request: UpdateNetworkDeviceRequest = {
        id: device.id.toString(),
        name: 'Updated-Router',
        description: 'Updated description',
        location: 'Building C',
        managementProtocol: 'SSH',
        managementPort: 22,
        enabledRemoteAccess: true
      };

      mockRepository.findById.mockResolvedValue(Result.ok(device));
      mockRepository.save.mockResolvedValue(Result.ok(undefined));

      // Act
      const result = await useCase.execute(request);

      // Assert
      expect(result.isSuccess).toBe(true);
      expect(result.value.name).toBe('Updated-Router');
      expect(result.value.description).toBe('Updated description');
      expect(result.value.location).toBe('Building C');
      expect(result.value.managementProtocol).toBe('SSH');
      expect(result.value.managementPort).toBe(22);
      expect(result.value.enabledRemoteAccess).toBe(true);
    });

    it('should trim whitespace from name', async () => {
      // Arrange
      const device = createMockActiveDevice();
      const request: UpdateNetworkDeviceRequest = {
        id: device.id.toString(),
        name: '  Router-Trimmed  '
      };

      mockRepository.findById.mockResolvedValue(Result.ok(device));
      mockRepository.save.mockResolvedValue(Result.ok(undefined));

      // Act
      const result = await useCase.execute(request);

      // Assert
      expect(result.isSuccess).toBe(true);
      expect(result.value.name).toBe('Router-Trimmed');
    });
  });

  // ========================================
  // Input Validation Tests
  // ========================================

  describe('Input Validation', () => {
    it('should fail when no fields provided', async () => {
      // Arrange
      const device = createMockActiveDevice();
      const request: UpdateNetworkDeviceRequest = {
        id: device.id.toString()
      };

      // Act
      const result = await useCase.execute(request);

      // Assert
      expect(result.isFailure).toBe(true);
      expect(result.error).toContain(
        'At least one field must be provided'
      );
      expect(mockRepository.findById).not.toHaveBeenCalled();
    });

    it('should fail when device ID is invalid', async () => {
      // Arrange
      const request: UpdateNetworkDeviceRequest = {
        id: 'invalid-uuid',
        name: 'Updated'
      };

      // Act
      const result = await useCase.execute(request);

      // Assert
      expect(result.isFailure).toBe(true);
      expect(result.error).toContain('Invalid device ID');
    });

    it('should fail when name is empty', async () => {
      // Arrange
      const device = createMockActiveDevice();
      const request: UpdateNetworkDeviceRequest = {
        id: device.id.toString(),
        name: ''
      };

      mockRepository.findById.mockResolvedValue(Result.ok(device));

      // Act
      const result = await useCase.execute(request);

      // Assert
      expect(result.isFailure).toBe(true);
      expect(result.error).toContain('name cannot be empty');
    });

    it('should fail when name is only whitespace', async () => {
      // Arrange
      const device = createMockActiveDevice();
      const request: UpdateNetworkDeviceRequest = {
        id: device.id.toString(),
        name: '   '
      };

      mockRepository.findById.mockResolvedValue(Result.ok(device));

      // Act
      const result = await useCase.execute(request);

      // Assert
      expect(result.isFailure).toBe(true);
      expect(result.error).toContain('name cannot be empty');
    });

    it('should fail when name exceeds 255 characters', async () => {
      // Arrange
      const device = createMockActiveDevice();
      const request: UpdateNetworkDeviceRequest = {
        id: device.id.toString(),
        name: 'A'.repeat(256)
      };

      mockRepository.findById.mockResolvedValue(Result.ok(device));

      // Act
      const result = await useCase.execute(request);

      // Assert
      expect(result.isFailure).toBe(true);
      expect(result.error).toContain('255 characters');
      expect(result.error).toContain('256');
    });

    it('should accept name with exactly 255 characters', async () => {
      // Arrange
      const device = createMockActiveDevice();
      const longName = 'A'.repeat(255);
      const request: UpdateNetworkDeviceRequest = {
        id: device.id.toString(),
        name: longName
      };

      mockRepository.findById.mockResolvedValue(Result.ok(device));
      mockRepository.save.mockResolvedValue(Result.ok(undefined));

      // Act
      const result = await useCase.execute(request);

      // Assert
      expect(result.isSuccess).toBe(true);
      expect(result.value.name).toBe(longName);
    });

    it('should fail when description exceeds 1000 characters', async () => {
      // Arrange
      const device = createMockActiveDevice();
      const request: UpdateNetworkDeviceRequest = {
        id: device.id.toString(),
        description: 'A'.repeat(1001)
      };

      mockRepository.findById.mockResolvedValue(Result.ok(device));

      // Act
      const result = await useCase.execute(request);

      // Assert
      expect(result.isFailure).toBe(true);
      expect(result.error).toContain('1000 characters');
      expect(result.error).toContain('1001');
    });

    it('should accept description with exactly 1000 characters', async () => {
      // Arrange
      const device = createMockActiveDevice();
      const longDesc = 'A'.repeat(1000);
      const request: UpdateNetworkDeviceRequest = {
        id: device.id.toString(),
        description: longDesc
      };

      mockRepository.findById.mockResolvedValue(Result.ok(device));
      mockRepository.save.mockResolvedValue(Result.ok(undefined));

      // Act
      const result = await useCase.execute(request);

      // Assert
      expect(result.isSuccess).toBe(true);
      expect(result.value.description).toBe(longDesc);
    });

    it('should fail when location exceeds 500 characters (REQ-002)', async () => {
      // Arrange
      const device = createMockActiveDevice();
      const request: UpdateNetworkDeviceRequest = {
        id: device.id.toString(),
        location: 'A'.repeat(501)
      };

      mockRepository.findById.mockResolvedValue(Result.ok(device));

      // Act
      const result = await useCase.execute(request);

      // Assert
      expect(result.isFailure).toBe(true);
      expect(result.error).toContain('500 characters');
      expect(result.error).toContain('501');
    });

    it('should accept location with exactly 500 characters', async () => {
      // Arrange
      const device = createMockActiveDevice();
      const longLocation = 'A'.repeat(500);
      const request: UpdateNetworkDeviceRequest = {
        id: device.id.toString(),
        location: longLocation
      };

      mockRepository.findById.mockResolvedValue(Result.ok(device));
      mockRepository.save.mockResolvedValue(Result.ok(undefined));

      // Act
      const result = await useCase.execute(request);

      // Assert
      expect(result.isSuccess).toBe(true);
      expect(result.value.location).toBe(longLocation);
    });

    it('should fail when management port is less than 1', async () => {
      // Arrange
      const device = createMockActiveDevice();
      const request: UpdateNetworkDeviceRequest = {
        id: device.id.toString(),
        managementPort: 0
      };

      mockRepository.findById.mockResolvedValue(Result.ok(device));

      // Act
      const result = await useCase.execute(request);

      // Assert
      expect(result.isFailure).toBe(true);
      expect(result.error).toContain('between 1 and 65535');
    });

    it('should fail when management port exceeds 65535', async () => {
      // Arrange
      const device = createMockActiveDevice();
      const request: UpdateNetworkDeviceRequest = {
        id: device.id.toString(),
        managementPort: 65536
      };

      mockRepository.findById.mockResolvedValue(Result.ok(device));

      // Act
      const result = await useCase.execute(request);

      // Assert
      expect(result.isFailure).toBe(true);
      expect(result.error).toContain('between 1 and 65535');
    });

    it('should fail when management port is not an integer', async () => {
      // Arrange
      const device = createMockActiveDevice();
      const request: UpdateNetworkDeviceRequest = {
        id: device.id.toString(),
        managementPort: 22.5
      };

      mockRepository.findById.mockResolvedValue(Result.ok(device));

      // Act
      const result = await useCase.execute(request);

      // Assert
      expect(result.isFailure).toBe(true);
      expect(result.error).toContain('between 1 and 65535');
    });

    it('should accept management port at boundary 1', async () => {
      // Arrange
      const device = createMockActiveDevice();
      const request: UpdateNetworkDeviceRequest = {
        id: device.id.toString(),
        managementPort: 1
      };

      mockRepository.findById.mockResolvedValue(Result.ok(device));
      mockRepository.save.mockResolvedValue(Result.ok(undefined));

      // Act
      const result = await useCase.execute(request);

      // Assert
      expect(result.isSuccess).toBe(true);
      expect(result.value.managementPort).toBe(1);
    });

    it('should accept management port at boundary 65535', async () => {
      // Arrange
      const device = createMockActiveDevice();
      const request: UpdateNetworkDeviceRequest = {
        id: device.id.toString(),
        managementPort: 65535
      };

      mockRepository.findById.mockResolvedValue(Result.ok(device));
      mockRepository.save.mockResolvedValue(Result.ok(undefined));

      // Act
      const result = await useCase.execute(request);

      // Assert
      expect(result.isSuccess).toBe(true);
      expect(result.value.managementPort).toBe(65535);
    });
  });

  // ========================================
  // Business Rules Tests
  // ========================================

  describe('Business Rules', () => {
    it('should fail when device does not exist', async () => {
      // Arrange
      const request: UpdateNetworkDeviceRequest = {
        id: NetworkDeviceId.create().value.toString(),
        name: 'Updated'
      };

      mockRepository.findById.mockResolvedValue(Result.ok(null));

      // Act
      const result = await useCase.execute(request);

      // Assert
      expect(result.isFailure).toBe(true);
      expect(result.error).toContain('not found');
      expect(mockRepository.save).not.toHaveBeenCalled();
    });

    it('should fail when device is soft-deleted', async () => {
      // Arrange
      const device = createMockActiveDevice();
      device.softDelete('test-user');

      const request: UpdateNetworkDeviceRequest = {
        id: device.id.toString(),
        name: 'Updated'
      };

      mockRepository.findById.mockResolvedValue(Result.ok(device));

      // Act
      const result = await useCase.execute(request);

      // Assert
      expect(result.isFailure).toBe(true);
      expect(result.error).toContain('soft-deleted');
      expect(result.error).toContain('RestoreNetworkDeviceUseCase');
      expect(mockRepository.save).not.toHaveBeenCalled();
    });

    it('should fail when trying to change deviceType (immutable)', async () => {
      // Arrange
      const device = createMockActiveDevice();
      const request: UpdateNetworkDeviceRequest = {
        id: device.id.toString(),
        deviceType: 'SWITCH'
      };

      mockRepository.findById.mockResolvedValue(Result.ok(device));

      // Act
      const result = await useCase.execute(request);

      // Assert
      expect(result.isFailure).toBe(true);
      expect(result.error).toContain('Device type cannot be changed');
      expect(result.error).toContain('Create a new device instead');
      expect(mockRepository.save).not.toHaveBeenCalled();
    });

    it('should fail when trying to change connectivityType (immutable)', async () => {
      // Arrange
      const device = createMockActiveDevice();
      const request: UpdateNetworkDeviceRequest = {
        id: device.id.toString(),
        connectivityType: 'FIBER_OPTIC'
      };

      mockRepository.findById.mockResolvedValue(Result.ok(device));

      // Act
      const result = await useCase.execute(request);

      // Assert
      expect(result.isFailure).toBe(true);
      expect(result.error).toContain(
        'Connectivity type cannot be changed'
      );
      expect(result.error).toContain('Create a new device instead');
      expect(mockRepository.save).not.toHaveBeenCalled();
    });
  });

  // ========================================
  // Repository Interaction Tests
  // ========================================

  describe('Repository Interactions', () => {
    it('should load device by ID', async () => {
      // Arrange
      const device = createMockActiveDevice();
      const request: UpdateNetworkDeviceRequest = {
        id: device.id.toString(),
        name: 'Updated'
      };

      mockRepository.findById.mockResolvedValue(Result.ok(device));
      mockRepository.save.mockResolvedValue(Result.ok(undefined));

      // Act
      await useCase.execute(request);

      // Assert
      expect(mockRepository.findById).toHaveBeenCalledTimes(1);
      const calledWithId = mockRepository.findById.mock.calls[0][0];
      expect(calledWithId).toBeInstanceOf(NetworkDeviceId);
      expect(calledWithId.toString()).toBe(device.id.toString());
    });

    it('should save updated device', async () => {
      // Arrange
      const device = createMockActiveDevice();
      const request: UpdateNetworkDeviceRequest = {
        id: device.id.toString(),
        name: 'Updated'
      };

      mockRepository.findById.mockResolvedValue(Result.ok(device));
      mockRepository.save.mockResolvedValue(Result.ok(undefined));

      // Act
      await useCase.execute(request);

      // Assert
      expect(mockRepository.save).toHaveBeenCalledTimes(1);
      const savedDevice = mockRepository.save.mock.calls[0][0];
      expect(savedDevice).toBeInstanceOf(NetworkDevice);
    });

    it('should handle repository findById error', async () => {
      // Arrange
      const request: UpdateNetworkDeviceRequest = {
        id: NetworkDeviceId.create().value.toString(),
        name: 'Updated'
      };

      mockRepository.findById.mockResolvedValue(
        Result.fail('Database connection error')
      );

      // Act
      const result = await useCase.execute(request);

      // Assert
      expect(result.isFailure).toBe(true);
      expect(result.error).toBe('Database connection error');
      expect(mockRepository.save).not.toHaveBeenCalled();
    });

    it('should handle repository save error', async () => {
      // Arrange
      const device = createMockActiveDevice();
      const request: UpdateNetworkDeviceRequest = {
        id: device.id.toString(),
        name: 'Updated'
      };

      mockRepository.findById.mockResolvedValue(Result.ok(device));
      mockRepository.save.mockResolvedValue(
        Result.fail('Database write error')
      );

      // Act
      const result = await useCase.execute(request);

      // Assert
      expect(result.isFailure).toBe(true);
      expect(result.error).toBe('Database write error');
    });
  });

  // ========================================
  // Enum Mapping Tests
  // ========================================

  describe('Enum Mapping', () => {
    it('should map SNMP management protocol', async () => {
      // Arrange
      const device = createMockActiveDevice();
      const request: UpdateNetworkDeviceRequest = {
        id: device.id.toString(),
        managementProtocol: 'SNMP'
      };

      mockRepository.findById.mockResolvedValue(Result.ok(device));
      mockRepository.save.mockResolvedValue(Result.ok(undefined));

      // Act
      const result = await useCase.execute(request);

      // Assert
      expect(result.isSuccess).toBe(true);
      expect(result.value.managementProtocol).toBe('SNMP');
    });

    it('should map SSH management protocol', async () => {
      // Arrange
      const device = createMockActiveDevice();
      const request: UpdateNetworkDeviceRequest = {
        id: device.id.toString(),
        managementProtocol: 'SSH'
      };

      mockRepository.findById.mockResolvedValue(Result.ok(device));
      mockRepository.save.mockResolvedValue(Result.ok(undefined));

      // Act
      const result = await useCase.execute(request);

      // Assert
      expect(result.isSuccess).toBe(true);
      expect(result.value.managementProtocol).toBe('SSH');
    });

    it('should map lowercase protocol to uppercase', async () => {
      // Arrange
      const device = createMockActiveDevice();
      const request: UpdateNetworkDeviceRequest = {
        id: device.id.toString(),
        managementProtocol: 'ssh'
      };

      mockRepository.findById.mockResolvedValue(Result.ok(device));
      mockRepository.save.mockResolvedValue(Result.ok(undefined));

      // Act
      const result = await useCase.execute(request);

      // Assert
      expect(result.isSuccess).toBe(true);
      expect(result.value.managementProtocol).toBe('SSH');
    });

    it('should map unknown protocol to OTHER', async () => {
      // Arrange
      const device = createMockActiveDevice();
      const request: UpdateNetworkDeviceRequest = {
        id: device.id.toString(),
        managementProtocol: 'UNKNOWN_PROTOCOL'
      };

      mockRepository.findById.mockResolvedValue(Result.ok(device));
      mockRepository.save.mockResolvedValue(Result.ok(undefined));

      // Act
      const result = await useCase.execute(request);

      // Assert
      expect(result.isSuccess).toBe(true);
      expect(result.value.managementProtocol).toBe('OTHER');
    });
  });

  // ========================================
  // Edge Cases Tests
  // ========================================

  describe('Edge Cases', () => {
    it('should allow setting description to null', async () => {
      // Arrange
      const device = createMockActiveDevice();
      const request: UpdateNetworkDeviceRequest = {
        id: device.id.toString(),
        description: null as any
      };

      mockRepository.findById.mockResolvedValue(Result.ok(device));
      mockRepository.save.mockResolvedValue(Result.ok(undefined));

      // Act
      const result = await useCase.execute(request);

      // Assert
      expect(result.isSuccess).toBe(true);
      expect(result.value.description).toBeNull();
    });

    it('should allow setting location to null', async () => {
      // Arrange
      const device = createMockActiveDevice();
      const request: UpdateNetworkDeviceRequest = {
        id: device.id.toString(),
        location: null as any
      };

      mockRepository.findById.mockResolvedValue(Result.ok(device));
      mockRepository.save.mockResolvedValue(Result.ok(undefined));

      // Act
      const result = await useCase.execute(request);

      // Assert
      expect(result.isSuccess).toBe(true);
      expect(result.value.location).toBeNull();
    });

    it('should preserve other fields when updating only one field', async () => {
      // Arrange
      const device = createMockActiveDevice();
      const originalDescription = device.description;
      const originalLocation = device.location;

      const request: UpdateNetworkDeviceRequest = {
        id: device.id.toString(),
        name: 'New-Name'
      };

      mockRepository.findById.mockResolvedValue(Result.ok(device));
      mockRepository.save.mockResolvedValue(Result.ok(undefined));

      // Act
      const result = await useCase.execute(request);

      // Assert
      expect(result.isSuccess).toBe(true);
      expect(result.value.name).toBe('New-Name');
      expect(result.value.description).toBe(originalDescription);
      expect(result.value.location).toBe(originalLocation);
    });

    it('should handle enabledRemoteAccess set to false', async () => {
      // Arrange
      const device = createMockActiveDevice();
      const request: UpdateNetworkDeviceRequest = {
        id: device.id.toString(),
        enabledRemoteAccess: false
      };

      mockRepository.findById.mockResolvedValue(Result.ok(device));
      mockRepository.save.mockResolvedValue(Result.ok(undefined));

      // Act
      const result = await useCase.execute(request);

      // Assert
      expect(result.isSuccess).toBe(true);
      expect(result.value.enabledRemoteAccess).toBe(false);
    });
  });

  // ========================================
  // Logging Tests
  // ========================================

  describe('Logging', () => {
    it('should log successful update', async () => {
      // Arrange
      const device = createMockActiveDevice();
      const request: UpdateNetworkDeviceRequest = {
        id: device.id.toString(),
        name: 'Updated'
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
