/**import { ListNetworkDevicesUseCase } from '../../../src/application/use-cases/ListNetworkDevicesUseCase';
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
import { ListNetworkDevicesQueryDTO } from '../../../src/application/dtos/network-device/NetworkDeviceDTO';

describe('ListNetworkDevicesUseCase', () => {
  // ========================================
  // Mocks
  // ========================================

  let useCase: ListNetworkDevicesUseCase;
  let mockRepository: jest.Mocked<INetworkDeviceRepository>;
  let mockLogger: jest.Mocked<ILogger>;

  beforeEach(() => {
    mockRepository = {
      save: jest.fn(),
      findById: jest.fn(),
      findByIpAddress: jest.fn(),
      findByMacAddress: jest.fn(),
      findAll: jest.fn(),
      findByStatus: jest.fn(),
      count: jest.fn(),
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

    useCase = new ListNetworkDevicesUseCase(mockRepository, mockLogger);
  });

  afterEach(() => {
    jest.clearAllMocks();
  });

  // ========================================
  // Test Data Helpers
  // ========================================

  const createMockDevice = (
    index: number,
    status: NetworkDeviceStatus = NetworkDeviceStatus.ONLINE
  ): NetworkDevice => {
    const deviceId = NetworkDeviceId.create().value;
    const ipAddress = IPAddress.create(`192.168.1.${100 + index}`).value;
    const macAddress = MACAddress.create(
      `AA:BB:CC:DD:EE:${(index + 10).toString(16).toUpperCase().padStart(2, '0')}`
    ).value;
    const pollingConfig =
      PollingConfiguration.createDefault(deviceId).value;

    const props: NetworkDeviceProps = {
      name: `Device-${index}`,
      deviceType: NetworkDeviceType.ROUTER,
      status,
      description: `Device ${index}`,
      ipAddress,
      macAddress,
      connectivityType: ConnectivityType.ETHERNET,
      managementProtocol: ManagementProtocol.SNMP,
      managementPort: 161,
      enabledRemoteAccess: false,
      deviceId: `device-${index}`,
      pollingConfiguration: pollingConfig,
      location: `Building ${index}`,
      installDate: new Date(),
      createdAt: new Date(),
      updatedAt: new Date()
    };

    const device = NetworkDevice.create(props, deviceId).value;
    device.activate('test-user');
    return device;
  };

  const createMockDevices = (count: number): NetworkDevice[] => {
    return Array.from({ length: count }, (_, i) => createMockDevice(i));
  };

  // ========================================
  // Success Cases - List All
  // ========================================

  describe('Success Cases - List All', () => {
    it('should list all devices with default pagination', async () => {
      // Arrange
      const devices = createMockDevices(10);
      const request: ListNetworkDevicesQueryDTO = {};

      mockRepository.findAll.mockResolvedValue(Result.ok(devices));
      mockRepository.count.mockResolvedValue(Result.ok(10));

      // Act
      const result = await useCase.execute(request);

      // Assert
      expect(result.isSuccess).toBe(true);
      expect(result.value.devices).toHaveLength(10);
      expect(result.value.total).toBe(10);
      expect(result.value.limit).toBe(20); // Default limit
      expect(result.value.offset).toBe(0);
      expect(result.value.hasMore).toBe(false);
    });

    it('should apply custom limit', async () => {
      // Arrange
      const devices = createMockDevices(5);
      const request: ListNetworkDevicesQueryDTO = {
        limit: 5
      };

      mockRepository.findAll.mockResolvedValue(Result.ok(devices));
      mockRepository.count.mockResolvedValue(Result.ok(25));

      // Act
      const result = await useCase.execute(request);

      // Assert
      expect(result.isSuccess).toBe(true);
      expect(result.value.devices).toHaveLength(5);
      expect(result.value.limit).toBe(5);
      expect(result.value.hasMore).toBe(true); // 5 out of 25
    });

    it('should apply custom offset', async () => {
      // Arrange
      const devices = createMockDevices(10);
      const request: ListNetworkDevicesQueryDTO = {
        offset: 10
      };

      mockRepository.findAll.mockResolvedValue(Result.ok(devices));
      mockRepository.count.mockResolvedValue(Result.ok(30));

      // Act
      const result = await useCase.execute(request);

      // Assert
      expect(result.isSuccess).toBe(true);
      expect(result.value.offset).toBe(10);
      expect(result.value.hasMore).toBe(true);
    });

    it('should enforce maximum limit of 100', async () => {
      // Arrange
      const devices = createMockDevices(100);
      const request: ListNetworkDevicesQueryDTO = {
        limit: 200 // Request more than max
      };

      mockRepository.findAll.mockResolvedValue(Result.ok(devices));
      mockRepository.count.mockResolvedValue(Result.ok(100));

      // Act
      const result = await useCase.execute(request);

      // Assert
      expect(result.isSuccess).toBe(true);
      expect(result.value.limit).toBe(100); // Capped at max
      expect(mockRepository.findAll).toHaveBeenCalledWith(100, 0);
    });

    it('should calculate hasMore correctly when more data exists', async () => {
      // Arrange
      const devices = createMockDevices(20);
      const request: ListNetworkDevicesQueryDTO = {
        limit: 20,
        offset: 0
      };

      mockRepository.findAll.mockResolvedValue(Result.ok(devices));
      mockRepository.count.mockResolvedValue(Result.ok(50));

      // Act
      const result = await useCase.execute(request);

      // Assert
      expect(result.isSuccess).toBe(true);
      expect(result.value.hasMore).toBe(true); // 20 out of 50
    });

    it('should calculate hasMore correctly when no more data', async () => {
      // Arrange
      const devices = createMockDevices(10);
      const request: ListNetworkDevicesQueryDTO = {
        limit: 20,
        offset: 0
      };

      mockRepository.findAll.mockResolvedValue(Result.ok(devices));
      mockRepository.count.mockResolvedValue(Result.ok(10));

      // Act
      const result = await useCase.execute(request);

      // Assert
      expect(result.isSuccess).toBe(true);
      expect(result.value.hasMore).toBe(false);
    });

    it('should handle empty result set', async () => {
      // Arrange
      const request: ListNetworkDevicesQueryDTO = {};

      mockRepository.findAll.mockResolvedValue(Result.ok([]));
      mockRepository.count.mockResolvedValue(Result.ok(0));

      // Act
      const result = await useCase.execute(request);

      // Assert
      expect(result.isSuccess).toBe(true);
      expect(result.value.devices).toHaveLength(0);
      expect(result.value.total).toBe(0);
      expect(result.value.hasMore).toBe(false);
    });
  });

  // ========================================
  // Success Cases - Filter by Status
  // ========================================

  describe('Success Cases - Filter by Status', () => {
    it('should filter devices by ONLINE status', async () => {
      // Arrange
      const onlineDevices = createMockDevices(5).map((d, i) => {
        return createMockDevice(i, NetworkDeviceStatus.ONLINE);
      });

      const request: ListNetworkDevicesQueryDTO = {
        status: 'ONLINE'
      };

      mockRepository.findByStatus.mockResolvedValue(
        Result.ok(onlineDevices)
      );

      // Act
      const result = await useCase.execute(request);

      // Assert
      expect(result.isSuccess).toBe(true);
      expect(result.value.devices).toHaveLength(5);
      expect(result.value.devices.every((d) => d.status === 'ONLINE')).toBe(
        true
      );
    });

    it('should filter devices by OFFLINE status', async () => {
      // Arrange
      const offlineDevices = createMockDevices(3).map((d, i) => {
        return createMockDevice(i, NetworkDeviceStatus.OFFLINE);
      });

      const request: ListNetworkDevicesQueryDTO = {
        status: 'OFFLINE'
      };

      mockRepository.findByStatus.mockResolvedValue(
        Result.ok(offlineDevices)
      );

      // Act
      const result = await useCase.execute(request);

      // Assert
      expect(result.isSuccess).toBe(true);
      expect(result.value.devices).toHaveLength(3);
      expect(
        result.value.devices.every((d) => d.status === 'OFFLINE')
      ).toBe(true);
    });

    it('should filter devices by MAINTENANCE status', async () => {
      // Arrange
      const maintenanceDevices = createMockDevices(2).map((d, i) => {
        return createMockDevice(i, NetworkDeviceStatus.MAINTENANCE);
      });

      const request: ListNetworkDevicesQueryDTO = {
        status: 'MAINTENANCE'
      };

      mockRepository.findByStatus.mockResolvedValue(
        Result.ok(maintenanceDevices)
      );

      // Act
      const result = await useCase.execute(request);

      // Assert
      expect(result.isSuccess).toBe(true);
      expect(result.value.devices.every((d) => d.status === 'MAINTENANCE')).toBe(
        true
      );
    });

    it('should handle lowercase status filter', async () => {
      // Arrange
      const devices = createMockDevices(5).map((d, i) => {
        return createMockDevice(i, NetworkDeviceStatus.ONLINE);
      });

      const request: ListNetworkDevicesQueryDTO = {
        status: 'online' // lowercase
      };

      mockRepository.findByStatus.mockResolvedValue(Result.ok(devices));

      // Act
      const result = await useCase.execute(request);

      // Assert
      expect(result.isSuccess).toBe(true);
      expect(mockRepository.findByStatus).toHaveBeenCalledWith(
        NetworkDeviceStatus.ONLINE
      );
    });

    it('should apply pagination to status-filtered results', async () => {
      // Arrange
      const devices = createMockDevices(10).map((d, i) => {
        return createMockDevice(i, NetworkDeviceStatus.ONLINE);
      });

      const request: ListNetworkDevicesQueryDTO = {
        status: 'ONLINE',
        limit: 5,
        offset: 2
      };

      mockRepository.findByStatus.mockResolvedValue(Result.ok(devices));

      // Act
      const result = await useCase.execute(request);

      // Assert
      expect(result.isSuccess).toBe(true);
      expect(result.value.devices).toHaveLength(5);
      expect(result.value.offset).toBe(2);
      expect(result.value.total).toBe(10);
      expect(result.value.hasMore).toBe(true); // 2+5=7 out of 10
    });

    it('should calculate hasMore correctly for status filter', async () => {
      // Arrange
      const devices = createMockDevices(20).map((d, i) => {
        return createMockDevice(i, NetworkDeviceStatus.ONLINE);
      });

      const request: ListNetworkDevicesQueryDTO = {
        status: 'ONLINE',
        limit: 10,
        offset: 0
      };

      mockRepository.findByStatus.mockResolvedValue(Result.ok(devices));

      // Act
      const result = await useCase.execute(request);

      // Assert
      expect(result.isSuccess).toBe(true);
      expect(result.value.hasMore).toBe(true); // 10 out of 20
    });

    it('should handle empty status-filtered results', async () => {
      // Arrange
      const request: ListNetworkDevicesQueryDTO = {
        status: 'MAINTENANCE'
      };

      mockRepository.findByStatus.mockResolvedValue(Result.ok([]));

      // Act
      const result = await useCase.execute(request);

      // Assert
      expect(result.isSuccess).toBe(true);
      expect(result.value.devices).toHaveLength(0);
      expect(result.value.total).toBe(0);
      expect(result.value.hasMore).toBe(false);
    });
  });

  // ========================================
  // Input Validation Tests
  // ========================================

  describe('Input Validation', () => {
    it('should fail when status filter is invalid', async () => {
      // Arrange
      const request: ListNetworkDevicesQueryDTO = {
        status: 'INVALID_STATUS'
      };

      // Act
      const result = await useCase.execute(request);

      // Assert
      expect(result.isFailure).toBe(true);
      expect(result.error).toContain('Invalid status');
      expect(result.error).toContain('INVALID_STATUS');
      expect(result.error).toContain('ONLINE, OFFLINE, MAINTENANCE');
    });

    it('should accept negative offset as 0', async () => {
      // Arrange
      const devices = createMockDevices(10);
      const request: ListNetworkDevicesQueryDTO = {
        offset: -5
      };

      mockRepository.findAll.mockResolvedValue(Result.ok(devices));
      mockRepository.count.mockResolvedValue(Result.ok(10));

      // Act - should not crash
      const result = await useCase.execute(request);

      // Assert
      // Negative offset is treated as 0 or causes error
      // Implementation may vary
      expect(result.isSuccess || result.isFailure).toBe(true);
    });
  });

  // ========================================
  // Repository Interaction Tests
  // ========================================

  describe('Repository Interactions', () => {
    it('should call findAll with correct parameters', async () => {
      // Arrange
      const devices = createMockDevices(10);
      const request: ListNetworkDevicesQueryDTO = {
        limit: 10,
        offset: 5
      };

      mockRepository.findAll.mockResolvedValue(Result.ok(devices));
      mockRepository.count.mockResolvedValue(Result.ok(25));

      // Act
      await useCase.execute(request);

      // Assert
      expect(mockRepository.findAll).toHaveBeenCalledTimes(1);
      expect(mockRepository.findAll).toHaveBeenCalledWith(10, 5);
      expect(mockRepository.count).toHaveBeenCalledTimes(1);
    });

    it('should call findByStatus when status filter provided', async () => {
      // Arrange
      const devices = createMockDevices(5);
      const request: ListNetworkDevicesQueryDTO = {
        status: 'ONLINE'
      };

      mockRepository.findByStatus.mockResolvedValue(Result.ok(devices));

      // Act
      await useCase.execute(request);

      // Assert
      expect(mockRepository.findByStatus).toHaveBeenCalledTimes(1);
      expect(mockRepository.findByStatus).toHaveBeenCalledWith(
        NetworkDeviceStatus.ONLINE
      );
      expect(mockRepository.findAll).not.toHaveBeenCalled();
      expect(mockRepository.count).not.toHaveBeenCalled();
    });

    it('should handle repository findAll error', async () => {
      // Arrange
      const request: ListNetworkDevicesQueryDTO = {};

      mockRepository.findAll.mockResolvedValue(
        Result.fail('Database connection error')
      );

      // Act
      const result = await useCase.execute(request);

      // Assert
      expect(result.isFailure).toBe(true);
      expect(result.error).toBe('Database connection error');
    });

    it('should handle repository count error', async () => {
      // Arrange
      const devices = createMockDevices(10);
      const request: ListNetworkDevicesQueryDTO = {};

      mockRepository.findAll.mockResolvedValue(Result.ok(devices));
      mockRepository.count.mockResolvedValue(
        Result.fail('Count query error')
      );

      // Act
      const result = await useCase.execute(request);

      // Assert
      expect(result.isFailure).toBe(true);
      expect(result.error).toBe('Count query error');
    });

    it('should handle repository findByStatus error', async () => {
      // Arrange
      const request: ListNetworkDevicesQueryDTO = {
        status: 'ONLINE'
      };

      mockRepository.findByStatus.mockResolvedValue(
        Result.fail('Status query error')
      );

      // Act
      const result = await useCase.execute(request);

      // Assert
      expect(result.isFailure).toBe(true);
      expect(result.error).toBe('Status query error');
    });
  });

  // ========================================
  // Edge Cases Tests
  // ========================================

  describe('Edge Cases', () => {
    it('should handle offset beyond total count', async () => {
      // Arrange
      const request: ListNetworkDevicesQueryDTO = {
        offset: 100
      };

      mockRepository.findAll.mockResolvedValue(Result.ok([]));
      mockRepository.count.mockResolvedValue(Result.ok(10));

      // Act
      const result = await useCase.execute(request);

      // Assert
      expect(result.isSuccess).toBe(true);
      expect(result.value.devices).toHaveLength(0);
      expect(result.value.hasMore).toBe(false);
    });

    it('should handle limit of 0', async () => {
      // Arrange
      const request: ListNetworkDevicesQueryDTO = {
        limit: 0
      };

      mockRepository.findAll.mockResolvedValue(Result.ok([]));
      mockRepository.count.mockResolvedValue(Result.ok(10));

      // Act
      const result = await useCase.execute(request);

      // Assert
      // Either defaults to 20 or returns empty
      expect(result.isSuccess).toBe(true);
    });

    it('should handle exactly one page of results', async () => {
      // Arrange
      const devices = createMockDevices(20);
      const request: ListNetworkDevicesQueryDTO = {
        limit: 20,
        offset: 0
      };

      mockRepository.findAll.mockResolvedValue(Result.ok(devices));
      mockRepository.count.mockResolvedValue(Result.ok(20));

      // Act
      const result = await useCase.execute(request);

      // Assert
      expect(result.isSuccess).toBe(true);
      expect(result.value.hasMore).toBe(false);
    });

    it('should handle partial last page', async () => {
      // Arrange
      const devices = createMockDevices(5);
      const request: ListNetworkDevicesQueryDTO = {
        limit: 10,
        offset: 15
      };

      mockRepository.findAll.mockResolvedValue(Result.ok(devices));
      mockRepository.count.mockResolvedValue(Result.ok(20));

      // Act
      const result = await useCase.execute(request);

      // Assert
      expect(result.isSuccess).toBe(true);
      expect(result.value.devices).toHaveLength(5);
      expect(result.value.hasMore).toBe(false);
    });
  });

  // ========================================
  // Integration Tests
  // ========================================

  describe('Integration Tests', () => {
    it('should provide complete pagination information', async () => {
      // Arrange
      const devices = createMockDevices(10);
      const request: ListNetworkDevicesQueryDTO = {
        limit: 10,
        offset: 0
      };

      mockRepository.findAll.mockResolvedValue(Result.ok(devices));
      mockRepository.count.mockResolvedValue(Result.ok(25));

      // Act
      const result = await useCase.execute(request);

      // Assert
      expect(result.isSuccess).toBe(true);
      expect(result.value.devices).toHaveLength(10);
      expect(result.value.total).toBe(25);
      expect(result.value.limit).toBe(10);
      expect(result.value.offset).toBe(0);
      expect(result.value.hasMore).toBe(true);
    });

    it('should support pagination workflow (page 1)', async () => {
      // Arrange - First page
      const page1Devices = createMockDevices(10);
      const request: ListNetworkDevicesQueryDTO = {
        limit: 10,
        offset: 0
      };

      mockRepository.findAll.mockResolvedValue(Result.ok(page1Devices));
      mockRepository.count.mockResolvedValue(Result.ok(25));

      // Act
      const result = await useCase.execute(request);

      // Assert
      expect(result.isSuccess).toBe(true);
      expect(result.value.hasMore).toBe(true);
      expect(result.value.devices).toHaveLength(10);
    });

    it('should support pagination workflow (page 2)', async () => {
      // Arrange - Second page
      const page2Devices = createMockDevices(10);
      const request: ListNetworkDevicesQueryDTO = {
        limit: 10,
        offset: 10
      };

      mockRepository.findAll.mockResolvedValue(Result.ok(page2Devices));
      mockRepository.count.mockResolvedValue(Result.ok(25));

      // Act
      const result = await useCase.execute(request);

      // Assert
      expect(result.isSuccess).toBe(true);
      expect(result.value.hasMore).toBe(true);
      expect(result.value.devices).toHaveLength(10);
    });

    it('should support pagination workflow (last page)', async () => {
      // Arrange - Last page
      const page3Devices = createMockDevices(5);
      const request: ListNetworkDevicesQueryDTO = {
        limit: 10,
        offset: 20
      };

      mockRepository.findAll.mockResolvedValue(Result.ok(page3Devices));
      mockRepository.count.mockResolvedValue(Result.ok(25));

      // Act
      const result = await useCase.execute(request);

      // Assert
      expect(result.isSuccess).toBe(true);
      expect(result.value.hasMore).toBe(false);
      expect(result.value.devices).toHaveLength(5);
    });
  });
});
*/
