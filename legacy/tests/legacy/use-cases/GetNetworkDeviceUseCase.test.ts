/**import { GetNetworkDeviceUseCase } from '../../../src/application/use-cases/GetNetworkDeviceUseCase';
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

describe('GetNetworkDeviceUseCase', () => {
  // ========================================
  // Mocks
  // ========================================

  let useCase: GetNetworkDeviceUseCase;
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

    useCase = new GetNetworkDeviceUseCase(mockRepository, mockLogger);
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
    it('should retrieve an ACTIVE device by ID', async () => {
      // Arrange
      const device = createMockActiveDevice();
      const request = { id: device.id.toString() };

      mockRepository.findById.mockResolvedValue(Result.ok(device));

      // Act
      const result = await useCase.execute(request);

      // Assert
      expect(result.isSuccess).toBe(true);
      expect(result.value).toBeDefined();
      expect(result.value.id).toBe(device.id.toString());
      expect(result.value.name).toBe('Router-Core-01');
      expect(result.value.ipAddress).toBe('192.168.1.100');
    });

    it('should retrieve a DRAFT device by ID', async () => {
      // Arrange
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

      const request = { id: draftDevice.id.toString() };
      mockRepository.findById.mockResolvedValue(
        Result.ok(draftDevice)
      );

      // Act
      const result = await useCase.execute(request);

      // Assert
      expect(result.isSuccess).toBe(true);
      expect(result.value.activationStatus).toBe('DRAFT');
    });

    it('should return complete device information', async () => {
      // Arrange
      const device = createMockActiveDevice();
      const request = { id: device.id.toString() };

      mockRepository.findById.mockResolvedValue(Result.ok(device));

      // Act
      const result = await useCase.execute(request);

      // Assert
      expect(result.isSuccess).toBe(true);
      expect(result.value.id).toBeDefined();
      expect(result.value.name).toBe('Router-Core-01');
      expect(result.value.deviceType).toBe('ROUTER');
      expect(result.value.status).toBe('ONLINE');
      expect(result.value.ipAddress).toBe('192.168.1.100');
      expect(result.value.macAddress).toBe('AA:BB:CC:DD:EE:FF');
      expect(result.value.location).toBe('Building A');
      expect(result.value.activationStatus).toBe('ACTIVE');
    });

    it('should retrieve soft-deleted device', async () => {
      // Arrange
      const device = createMockActiveDevice();
      device.softDelete('test-user', 'Testing');

      const request = { id: device.id.toString() };
      mockRepository.findById.mockResolvedValue(Result.ok(device));

      // Act
      const result = await useCase.execute(request);

      // Assert
      expect(result.isSuccess).toBe(true);
      expect(result.value.deletedAt).toBeDefined();
      expect(result.value.deletedBy).toBe('test-user');
    });
  });

  // ========================================
  // Input Validation Tests
  // ========================================

  describe('Input Validation', () => {
    it('should fail when device ID is invalid', async () => {
      // Arrange
      const request = { id: 'invalid-uuid' };

      // Act
      const result = await useCase.execute(request);

      // Assert
      expect(result.isFailure).toBe(true);
      expect(result.error).toContain('Invalid device ID');
      expect(mockRepository.findById).not.toHaveBeenCalled();
    });

    it('should fail when device ID is empty', async () => {
      // Arrange
      const request = { id: '' };

      // Act
      const result = await useCase.execute(request);

      // Assert
      expect(result.isFailure).toBe(true);
      expect(result.error).toContain('Invalid device ID');
    });
  });

  // ========================================
  // Business Rules Tests
  // ========================================

  describe('Business Rules', () => {
    it('should fail when device does not exist', async () => {
      // Arrange
      const request = { id: NetworkDeviceId.create().value.toString() };

      mockRepository.findById.mockResolvedValue(Result.ok(null));

      // Act
      const result = await useCase.execute(request);

      // Assert
      expect(result.isFailure).toBe(true);
      expect(result.error).toContain('not found');
    });

    it('should include device ID in not found error', async () => {
      // Arrange
      const deviceId = NetworkDeviceId.create().value.toString();
      const request = { id: deviceId };

      mockRepository.findById.mockResolvedValue(Result.ok(null));

      // Act
      const result = await useCase.execute(request);

      // Assert
      expect(result.isFailure).toBe(true);
      expect(result.error).toContain(deviceId);
    });
  });

  // ========================================
  // Repository Interaction Tests
  // ========================================

  describe('Repository Interactions', () => {
    it('should call repository.findById with correct ID', async () => {
      // Arrange
      const device = createMockActiveDevice();
      const request = { id: device.id.toString() };

      mockRepository.findById.mockResolvedValue(Result.ok(device));

      // Act
      await useCase.execute(request);

      // Assert
      expect(mockRepository.findById).toHaveBeenCalledTimes(1);
      const calledWithId = mockRepository.findById.mock.calls[0][0];
      expect(calledWithId).toBeInstanceOf(NetworkDeviceId);
      expect(calledWithId.toString()).toBe(device.id.toString());
    });

    it('should handle repository error', async () => {
      // Arrange
      const request = { id: NetworkDeviceId.create().value.toString() };

      mockRepository.findById.mockResolvedValue(
        Result.fail('Database connection error')
      );

      // Act
      const result = await useCase.execute(request);

      // Assert
      expect(result.isFailure).toBe(true);
      expect(result.error).toBe('Database connection error');
    });
  });

  // ========================================
  // Edge Cases Tests
  // ========================================

  describe('Edge Cases', () => {
    it('should handle device with null optional fields', async () => {
      // Arrange
      const device = createMockActiveDevice();
      device.updateDescription(null);
      device.updateLocation(null);

      const request = { id: device.id.toString() };
      mockRepository.findById.mockResolvedValue(Result.ok(device));

      // Act
      const result = await useCase.execute(request);

      // Assert
      expect(result.isSuccess).toBe(true);
      expect(result.value.description).toBeNull();
      expect(result.value.location).toBeNull();
    });

    it('should handle device with special characters in fields', async () => {
      // Arrange
      const device = createMockActiveDevice();
      device.updateName('Router (Core) - "Main" [Active]');

      const request = { id: device.id.toString() };
      mockRepository.findById.mockResolvedValue(Result.ok(device));

      // Act
      const result = await useCase.execute(request);

      // Assert
      expect(result.isSuccess).toBe(true);
      expect(result.value.name).toBe('Router (Core) - "Main" [Active]');
    });
  });
});
*/
