/**import { RestoreNetworkDeviceUseCase } from '../../../src/application/use-cases/RestoreNetworkDeviceUseCase';
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
import { RestoreNetworkDeviceRequestDTO } from '../../../src/application/dtos/network-device';

describe('RestoreNetworkDeviceUseCase', () => {
  // ========================================
  // Mocks
  // ========================================

  let useCase: RestoreNetworkDeviceUseCase;
  let mockRepository: jest.Mocked<INetworkDeviceRepository>;
  let mockLogger: jest.Mocked<ILogger>;

  beforeEach(() => {
    mockRepository = {
      save: jest.fn(),
      findById: jest.fn(),
      findByIdIncludingDeleted: jest.fn(),
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

    useCase = new RestoreNetworkDeviceUseCase(
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

  const createMockSoftDeletedDevice = (): NetworkDevice => {
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
    // Soft-delete the device
    device.softDelete('admin', 'Test deletion');
    return device;
  };

  // ========================================
  // Success Cases
  // ========================================

  describe('Success Cases', () => {
    it('should restore a soft-deleted device successfully', async () => {
      // Arrange
      const device = createMockSoftDeletedDevice();
      const request = {
        id: device.id.toString(),
        requestDTO: {}
      };

      mockRepository.findByIdIncludingDeleted.mockResolvedValue(
        Result.ok(device)
      );
      mockRepository.findByIpAddress.mockResolvedValue(
        Result.ok(null)
      ); // No conflict
      mockRepository.findByMacAddress.mockResolvedValue(
        Result.ok(null)
      ); // No conflict
      mockRepository.save.mockResolvedValue(Result.ok(undefined));

      // Act
      const result = await useCase.execute(request);

      // Assert
      expect(result.isSuccess).toBe(true);
      expect(result.value).toBeDefined();
      expect(result.value.deletedAt).toBeNull();
      expect(result.value.deletedBy).toBeNull();
      expect(result.value.deletionReason).toBeUndefined();
    });

    it('should restore device to previous ACTIVE status', async () => {
      // Arrange
      const device = createMockSoftDeletedDevice();
      expect(device.activationStatus).toBe(ActivationStatus.ACTIVE);

      const request = {
        id: device.id.toString(),
        requestDTO: {}
      };

      mockRepository.findByIdIncludingDeleted.mockResolvedValue(
        Result.ok(device)
      );
      mockRepository.findByIpAddress.mockResolvedValue(
        Result.ok(null)
      );
      mockRepository.findByMacAddress.mockResolvedValue(
        Result.ok(null)
      );
      mockRepository.save.mockResolvedValue(Result.ok(undefined));

      // Act
      const result = await useCase.execute(request);

      // Assert
      expect(result.isSuccess).toBe(true);
      expect(result.value.activationStatus).toBe(
        ActivationStatus.ACTIVE
      );
    });

    it('should preserve device data after restoration', async () => {
      // Arrange
      const device = createMockSoftDeletedDevice();
      const originalName = device.name;
      const originalIp = device.ipAddress.toString();

      const request = {
        id: device.id.toString(),
        requestDTO: {}
      };

      mockRepository.findByIdIncludingDeleted.mockResolvedValue(
        Result.ok(device)
      );
      mockRepository.findByIpAddress.mockResolvedValue(
        Result.ok(null)
      );
      mockRepository.findByMacAddress.mockResolvedValue(
        Result.ok(null)
      );
      mockRepository.save.mockResolvedValue(Result.ok(undefined));

      // Act
      const result = await useCase.execute(request);

      // Assert
      expect(result.isSuccess).toBe(true);
      expect(result.value.name).toBe(originalName);
      expect(result.value.ipAddress).toBe(originalIp);
    });

    it('should call repository.save() with restored device', async () => {
      // Arrange
      const device = createMockSoftDeletedDevice();
      const request = {
        id: device.id.toString(),
        requestDTO: {}
      };

      mockRepository.findByIdIncludingDeleted.mockResolvedValue(
        Result.ok(device)
      );
      mockRepository.findByIpAddress.mockResolvedValue(
        Result.ok(null)
      );
      mockRepository.findByMacAddress.mockResolvedValue(
        Result.ok(null)
      );
      mockRepository.save.mockResolvedValue(Result.ok(undefined));

      // Act
      await useCase.execute(request);

      // Assert
      expect(mockRepository.save).toHaveBeenCalledTimes(1);
      const savedDevice = mockRepository.save.mock.calls[0][0];
      expect(savedDevice).toBeInstanceOf(NetworkDevice);
      expect(savedDevice.deletedAt).toBeNull();
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

      mockRepository.findByIdIncludingDeleted.mockResolvedValue(
        Result.ok(null)
      );

      // Act
      const result = await useCase.execute(request);

      // Assert
      expect(result.isFailure).toBe(true);
      expect(result.error).toContain('not found');
      expect(mockRepository.save).not.toHaveBeenCalled();
    });

    it('should fail when device is not soft-deleted', async () => {
      // Arrange
      const deviceId = NetworkDeviceId.create().value;
      const ipAddress = IPAddress.create('192.168.1.100').value;
      const macAddress =
        MACAddress.create('AA:BB:CC:DD:EE:FF').value;
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

      const activeDevice = NetworkDevice.create(props, deviceId).value;
      // NOT soft-deleted

      const request = {
        id: activeDevice.id.toString(),
        requestDTO: {}
      };

      mockRepository.findByIdIncludingDeleted.mockResolvedValue(
        Result.ok(activeDevice)
      );

      // Act
      const result = await useCase.execute(request);

      // Assert
      expect(result.isFailure).toBe(true);
      expect(result.error).toContain('not soft-deleted');
      expect(mockRepository.save).not.toHaveBeenCalled();
    });

    it('should fail when 7-day grace period has expired', async () => {
      // Arrange
      const device = createMockSoftDeletedDevice();

      // Manually set deletedAt to 8 days ago
      const eightDaysAgo = new Date();
      eightDaysAgo.setDate(eightDaysAgo.getDate() - 8);
      (device as any).props.deletedAt = eightDaysAgo;

      const request = {
        id: device.id.toString(),
        requestDTO: {}
      };

      mockRepository.findByIdIncludingDeleted.mockResolvedValue(
        Result.ok(device)
      );

      // Act
      const result = await useCase.execute(request);

      // Assert
      expect(result.isFailure).toBe(true);
      expect(result.error).toContain('7-day grace period');
      expect(result.error).toContain('expired');
      expect(mockRepository.save).not.toHaveBeenCalled();
    });

    it('should succeed when device deleted exactly 7 days ago', async () => {
      // Arrange
      const device = createMockSoftDeletedDevice();

      // Set deletedAt to exactly 7 days ago
      const sevenDaysAgo = new Date();
      sevenDaysAgo.setDate(sevenDaysAgo.getDate() - 7);
      (device as any).props.deletedAt = sevenDaysAgo;

      const request = {
        id: device.id.toString(),
        requestDTO: {}
      };

      mockRepository.findByIdIncludingDeleted.mockResolvedValue(
        Result.ok(device)
      );
      mockRepository.findByIpAddress.mockResolvedValue(
        Result.ok(null)
      );
      mockRepository.findByMacAddress.mockResolvedValue(
        Result.ok(null)
      );
      mockRepository.save.mockResolvedValue(Result.ok(undefined));

      // Act
      const result = await useCase.execute(request);

      // Assert
      expect(result.isSuccess).toBe(true);
    });

    it('should fail when IP address now in use by another device', async () => {
      // Arrange
      const device = createMockSoftDeletedDevice();

      // Create a conflicting device with same IP
      const conflictingDeviceId = NetworkDeviceId.create().value;
      const conflictingDevice = NetworkDevice.create(
        {
          name: 'Conflicting Device',
          deviceType: NetworkDeviceType.SWITCH,
          status: NetworkDeviceStatus.ONLINE,
          description: null,
          ipAddress: device.ipAddress, // Same IP!
          macAddress: MACAddress.create('BB:CC:DD:EE:FF:00').value,
          connectivityType: ConnectivityType.ETHERNET,
          managementProtocol: ManagementProtocol.SNMP,
          managementPort: 161,
          enabledRemoteAccess: false,
          deviceId: 'device-002',
          pollingConfiguration:
            PollingConfiguration.createDefault(
              conflictingDeviceId
            ).value,
          location: null,
          installDate: new Date(),
          createdAt: new Date(),
          updatedAt: new Date()
        },
        conflictingDeviceId
      ).value;

      const request = {
        id: device.id.toString(),
        requestDTO: {}
      };

      mockRepository.findByIdIncludingDeleted.mockResolvedValue(
        Result.ok(device)
      );
      mockRepository.findByIpAddress.mockResolvedValue(
        Result.ok(conflictingDevice)
      ); // Conflict!

      // Act
      const result = await useCase.execute(request);

      // Assert
      expect(result.isFailure).toBe(true);
      expect(result.error).toContain('IP address');
      expect(result.error).toContain('in use');
      expect(result.error).toContain(
        conflictingDevice.id.toString()
      );
      expect(mockRepository.save).not.toHaveBeenCalled();
    });

    it('should fail when MAC address now in use by another device', async () => {
      // Arrange
      const device = createMockSoftDeletedDevice();

      // Create a conflicting device with same MAC
      const conflictingDeviceId = NetworkDeviceId.create().value;
      const conflictingDevice = NetworkDevice.create(
        {
          name: 'Conflicting Device',
          deviceType: NetworkDeviceType.SWITCH,
          status: NetworkDeviceStatus.ONLINE,
          description: null,
          ipAddress: IPAddress.create('192.168.1.200').value,
          macAddress: device.macAddress, // Same MAC!
          connectivityType: ConnectivityType.ETHERNET,
          managementProtocol: ManagementProtocol.SNMP,
          managementPort: 161,
          enabledRemoteAccess: false,
          deviceId: 'device-002',
          pollingConfiguration:
            PollingConfiguration.createDefault(
              conflictingDeviceId
            ).value,
          location: null,
          installDate: new Date(),
          createdAt: new Date(),
          updatedAt: new Date()
        },
        conflictingDeviceId
      ).value;

      const request = {
        id: device.id.toString(),
        requestDTO: {}
      };

      mockRepository.findByIdIncludingDeleted.mockResolvedValue(
        Result.ok(device)
      );
      mockRepository.findByIpAddress.mockResolvedValue(
        Result.ok(null)
      );
      mockRepository.findByMacAddress.mockResolvedValue(
        Result.ok(conflictingDevice)
      ); // Conflict!

      // Act
      const result = await useCase.execute(request);

      // Assert
      expect(result.isFailure).toBe(true);
      expect(result.error).toContain('MAC address');
      expect(result.error).toContain('in use');
      expect(result.error).toContain(
        conflictingDevice.id.toString()
      );
      expect(mockRepository.save).not.toHaveBeenCalled();
    });
  });

  // ========================================
  // Repository Interaction Tests
  // ========================================

  describe('Repository Interactions', () => {
    it('should load device by ID including deleted ones', async () => {
      // Arrange
      const device = createMockSoftDeletedDevice();
      const request = {
        id: device.id.toString(),
        requestDTO: {}
      };

      mockRepository.findByIdIncludingDeleted.mockResolvedValue(
        Result.ok(device)
      );
      mockRepository.findByIpAddress.mockResolvedValue(
        Result.ok(null)
      );
      mockRepository.findByMacAddress.mockResolvedValue(
        Result.ok(null)
      );
      mockRepository.save.mockResolvedValue(Result.ok(undefined));

      // Act
      await useCase.execute(request);

      // Assert
      expect(
        mockRepository.findByIdIncludingDeleted
      ).toHaveBeenCalledTimes(1);
      const calledWithId =
        mockRepository.findByIdIncludingDeleted.mock.calls[0][0];
      expect(calledWithId).toBeInstanceOf(NetworkDeviceId);
      expect(calledWithId.toString()).toBe(device.id.toString());
    });

    it('should check for IP conflicts', async () => {
      // Arrange
      const device = createMockSoftDeletedDevice();
      const request = {
        id: device.id.toString(),
        requestDTO: {}
      };

      mockRepository.findByIdIncludingDeleted.mockResolvedValue(
        Result.ok(device)
      );
      mockRepository.findByIpAddress.mockResolvedValue(
        Result.ok(null)
      );
      mockRepository.findByMacAddress.mockResolvedValue(
        Result.ok(null)
      );
      mockRepository.save.mockResolvedValue(Result.ok(undefined));

      // Act
      await useCase.execute(request);

      // Assert
      expect(mockRepository.findByIpAddress).toHaveBeenCalledTimes(1);
      const calledWithIp =
        mockRepository.findByIpAddress.mock.calls[0][0];
      expect(calledWithIp).toBeInstanceOf(IPAddress);
      expect(calledWithIp.toString()).toBe(
        device.ipAddress.toString()
      );
    });

    it('should check for MAC conflicts', async () => {
      // Arrange
      const device = createMockSoftDeletedDevice();
      const request = {
        id: device.id.toString(),
        requestDTO: {}
      };

      mockRepository.findByIdIncludingDeleted.mockResolvedValue(
        Result.ok(device)
      );
      mockRepository.findByIpAddress.mockResolvedValue(
        Result.ok(null)
      );
      mockRepository.findByMacAddress.mockResolvedValue(
        Result.ok(null)
      );
      mockRepository.save.mockResolvedValue(Result.ok(undefined));

      // Act
      await useCase.execute(request);

      // Assert
      expect(
        mockRepository.findByMacAddress
      ).toHaveBeenCalledTimes(1);
      const calledWithMac =
        mockRepository.findByMacAddress.mock.calls[0][0];
      expect(calledWithMac).toBeInstanceOf(MACAddress);
      expect(calledWithMac.toString()).toBe(
        device.macAddress.toString()
      );
    });

    it('should handle repository findByIdIncludingDeleted error', async () => {
      // Arrange
      const request = {
        id: NetworkDeviceId.create().value.toString(),
        requestDTO: {}
      };

      mockRepository.findByIdIncludingDeleted.mockResolvedValue(
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
      const device = createMockSoftDeletedDevice();
      const request = {
        id: device.id.toString(),
        requestDTO: {}
      };

      mockRepository.findByIdIncludingDeleted.mockResolvedValue(
        Result.ok(device)
      );
      mockRepository.findByIpAddress.mockResolvedValue(
        Result.ok(null)
      );
      mockRepository.findByMacAddress.mockResolvedValue(
        Result.ok(null)
      );
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
    it('should succeed when device deleted 1 day ago', async () => {
      // Arrange
      const device = createMockSoftDeletedDevice();

      // Set deletedAt to 1 day ago
      const oneDayAgo = new Date();
      oneDayAgo.setDate(oneDayAgo.getDate() - 1);
      (device as any).props.deletedAt = oneDayAgo;

      const request = {
        id: device.id.toString(),
        requestDTO: {}
      };

      mockRepository.findByIdIncludingDeleted.mockResolvedValue(
        Result.ok(device)
      );
      mockRepository.findByIpAddress.mockResolvedValue(
        Result.ok(null)
      );
      mockRepository.findByMacAddress.mockResolvedValue(
        Result.ok(null)
      );
      mockRepository.save.mockResolvedValue(Result.ok(undefined));

      // Act
      const result = await useCase.execute(request);

      // Assert
      expect(result.isSuccess).toBe(true);
    });

    it('should fail when device deleted 7.1 days ago', async () => {
      // Arrange
      const device = createMockSoftDeletedDevice();

      // Set deletedAt to 7.1 days ago
      const sevenPointOneDaysAgo = new Date();
      sevenPointOneDaysAgo.setTime(
        sevenPointOneDaysAgo.getTime() - 7.1 * 24 * 60 * 60 * 1000
      );
      (device as any).props.deletedAt = sevenPointOneDaysAgo;

      const request = {
        id: device.id.toString(),
        requestDTO: {}
      };

      mockRepository.findByIdIncludingDeleted.mockResolvedValue(
        Result.ok(device)
      );

      // Act
      const result = await useCase.execute(request);

      // Assert
      expect(result.isFailure).toBe(true);
      expect(result.error).toContain('grace period');
    });
  });

  // ========================================
  // Logging Tests
  // ========================================

  describe('Logging', () => {
    it('should log restoration', async () => {
      // Arrange
      const device = createMockSoftDeletedDevice();
      const request = {
        id: device.id.toString(),
        requestDTO: {}
      };

      mockRepository.findByIdIncludingDeleted.mockResolvedValue(
        Result.ok(device)
      );
      mockRepository.findByIpAddress.mockResolvedValue(
        Result.ok(null)
      );
      mockRepository.findByMacAddress.mockResolvedValue(
        Result.ok(null)
      );
      mockRepository.save.mockResolvedValue(Result.ok(undefined));

      // Act
      await useCase.execute(request);

      // Assert
      expect(mockLogger.info).toHaveBeenCalled();
    });
  });
});
*/
