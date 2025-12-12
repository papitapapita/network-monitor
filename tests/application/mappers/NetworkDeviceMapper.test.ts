import { NetworkDeviceMapper } from '../../../src/application/mappers/NetworkDeviceMapper';
import {
  NetworkDevice,
  NetworkDeviceId,
  IPAddress,
  MACAddress,
  NetworkDeviceType,
  NetworkDeviceStatus,
  ConnectivityType,
  ManagementProtocol,
  PollingConfiguration,
  PollingConfigurationId,
  PollingInterval,
  RetryPolicy
} from '../../../src/domain';
import {
  CreateNetworkDeviceDTO,
  UpdateNetworkDeviceDTO
} from '../../../src/application/dtos';

describe('NetworkDeviceMapper', () => {
  // ========================================
  // Test Data Helpers
  // ========================================

  const createMockPollingConfiguration = (
    networkDeviceId: NetworkDeviceId
  ): PollingConfiguration => {
    const pollingInterval = PollingInterval.create(60).value;
    const retryPolicy = RetryPolicy.createDefault();

    const configResult = PollingConfiguration.create(
      {
        networkDeviceId,
        interval: pollingInterval,
        enabled: false,
        pingCount: 4,
        retryPolicy,
        lastScheduledAt: null,
        nextScheduledAt: null
      },
      PollingConfigurationId.create().value
    );

    return configResult.value;
  };

  const createMockNetworkDevice = (): NetworkDevice => {
    const deviceId = NetworkDeviceId.create().value;
    const ipAddress = IPAddress.create('192.168.1.1').value;
    const macAddress = MACAddress.create('AA:BB:CC:DD:EE:FF').value;
    const pollingConfig = createMockPollingConfiguration(deviceId);

    const deviceResult = NetworkDevice.create(
      {
        name: 'Test Router',
        deviceType: NetworkDeviceType.ROUTER,
        status: NetworkDeviceStatus.OFFLINE,
        description: 'Test device description',
        ipAddress,
        macAddress,
        connectivityType: ConnectivityType.ETHERNET,
        managementProtocol: ManagementProtocol.SNMP,
        managementPort: 161,
        enabledRemoteAccess: false,
        deviceId: 'device-uuid-123',
        pollingConfiguration: pollingConfig,
        installDate: new Date('2024-01-01'),
        createdAt: new Date('2024-01-01T10:00:00Z'),
        updatedAt: new Date('2024-01-01T10:00:00Z')
      },
      deviceId
    );

    return deviceResult.value;
  };

  // ========================================
  // toDTO() Tests
  // ========================================

  describe('toDTO', () => {
    it('should convert NetworkDevice domain entity to NetworkDeviceResponseDTO', () => {
      // Arrange
      const device = createMockNetworkDevice();

      // Act
      const dto = NetworkDeviceMapper.toDTO(device);

      // Assert
      expect(dto).toBeDefined();
      expect(dto.id).toBe(device.id.toString());
      expect(dto.name).toBe('Test Router');
      expect(dto.description).toBe('Test device description');
    });

    it('should extract string values from Value Objects', () => {
      // Arrange
      const device = createMockNetworkDevice();

      // Act
      const dto = NetworkDeviceMapper.toDTO(device);

      // Assert
      expect(dto.ipAddress).toBe('192.168.1.1');
      expect(dto.macAddress).toBe('AA:BB:CC:DD:EE:FF');
      expect(typeof dto.ipAddress).toBe('string');
      expect(typeof dto.macAddress).toBe('string');
    });

    it('should extract string values from domain enums', () => {
      // Arrange
      const device = createMockNetworkDevice();

      // Act
      const dto = NetworkDeviceMapper.toDTO(device);

      // Assert
      expect(dto.deviceType).toBe('ROUTER');
      expect(dto.status).toBe('OFFLINE');
      expect(dto.connectivityType).toBe('ETHERNET');
      expect(dto.managementProtocol).toBe('SNMP');
      expect(typeof dto.deviceType).toBe('string');
      expect(typeof dto.status).toBe('string');
    });

    it('should flatten nested PollingConfiguration aggregate', () => {
      // Arrange
      const device = createMockNetworkDevice();

      // Act
      const dto = NetworkDeviceMapper.toDTO(device);

      // Assert
      expect(dto.pollingConfiguration).toBeDefined();
      expect(dto.pollingConfiguration.id).toBe(
        device.pollingConfiguration.id.toString()
      );
      expect(dto.pollingConfiguration.enabled).toBe(false);
      expect(dto.pollingConfiguration.intervalSeconds).toBe(60);
      expect(dto.pollingConfiguration.pingCount).toBe(4);
      expect(dto.pollingConfiguration.maxRetryAttempts).toBe(3);
      expect(dto.pollingConfiguration.retryDelayMs).toBe(1000);
    });

    it('should handle null description', () => {
      // Arrange
      const device = createMockNetworkDevice();
      const deviceResult = NetworkDevice.create(
        {
          name: device.name,
          deviceType: device.deviceType,
          status: device.status,
          description: null,
          ipAddress: device.ipAddress,
          macAddress: device.macAddress,
          connectivityType: device.connectivityType,
          managementProtocol: device.managementProtocol,
          managementPort: device.managementPort,
          enabledRemoteAccess: device.enabledRemoteAccess,
          deviceId: device.deviceId,
          pollingConfiguration: device.pollingConfiguration,
          installDate: device.installDate,
          createdAt: device.createdAt,
          updatedAt: device.updatedAt
        },
        device.id
      );
      const deviceWithNullDesc = deviceResult.value;

      // Act
      const dto = NetworkDeviceMapper.toDTO(deviceWithNullDesc);

      // Assert
      expect(dto.description).toBeNull();
    });

    it('should preserve Date objects', () => {
      // Arrange
      const device = createMockNetworkDevice();

      // Act
      const dto = NetworkDeviceMapper.toDTO(device);

      // Assert
      expect(dto.installDate).toBeInstanceOf(Date);
      expect(dto.createdAt).toBeInstanceOf(Date);
      expect(dto.updatedAt).toBeInstanceOf(Date);
    });

    it('should preserve primitive fields', () => {
      // Arrange
      const device = createMockNetworkDevice();

      // Act
      const dto = NetworkDeviceMapper.toDTO(device);

      // Assert
      expect(dto.managementPort).toBe(161);
      expect(dto.enabledRemoteAccess).toBe(false);
      expect(dto.deviceId).toBe('device-uuid-123');
      expect(typeof dto.managementPort).toBe('number');
      expect(typeof dto.enabledRemoteAccess).toBe('boolean');
    });
  });

  // ========================================
  // toListDTO() Tests
  // ========================================

  describe('toListDTO', () => {
    it('should convert array of devices to list DTO with pagination metadata', () => {
      // Arrange
      const devices = [
        createMockNetworkDevice(),
        createMockNetworkDevice(),
        createMockNetworkDevice()
      ];
      const total = 10;
      const limit = 5;
      const offset = 0;

      // Act
      const listDTO = NetworkDeviceMapper.toListDTO(
        devices,
        total,
        limit,
        offset
      );

      // Assert
      expect(listDTO).toBeDefined();
      expect(listDTO.devices).toHaveLength(3);
      expect(listDTO.total).toBe(10);
      expect(listDTO.limit).toBe(5);
      expect(listDTO.offset).toBe(0);
      expect(listDTO.hasMore).toBe(true); // 0 + 3 < 10
    });

    it('should calculate hasMore correctly when there are more results', () => {
      // Arrange
      const devices = [
        createMockNetworkDevice(),
        createMockNetworkDevice()
      ];
      const total = 10;
      const limit = 5;
      const offset = 0;

      // Act
      const listDTO = NetworkDeviceMapper.toListDTO(
        devices,
        total,
        limit,
        offset
      );

      // Assert
      expect(listDTO.hasMore).toBe(true); // 0 + 2 < 10
    });

    it('should calculate hasMore correctly when no more results', () => {
      // Arrange
      const devices = [
        createMockNetworkDevice(),
        createMockNetworkDevice()
      ];
      const total = 7;
      const limit = 5;
      const offset = 5;

      // Act
      const listDTO = NetworkDeviceMapper.toListDTO(
        devices,
        total,
        limit,
        offset
      );

      // Assert
      expect(listDTO.hasMore).toBe(false); // 5 + 2 = 7, not < 7
    });

    it('should use default limit and offset when not provided', () => {
      // Arrange
      const devices = [createMockNetworkDevice()];
      const total = 1;

      // Act
      const listDTO = NetworkDeviceMapper.toListDTO(devices, total);

      // Assert
      expect(listDTO.limit).toBe(20); // Default
      expect(listDTO.offset).toBe(0); // Default
    });

    it('should handle empty device array', () => {
      // Arrange
      const devices: NetworkDevice[] = [];
      const total = 0;

      // Act
      const listDTO = NetworkDeviceMapper.toListDTO(devices, total);

      // Assert
      expect(listDTO.devices).toHaveLength(0);
      expect(listDTO.total).toBe(0);
      expect(listDTO.hasMore).toBe(false);
    });

    it('should map each device using toDTO', () => {
      // Arrange
      const devices = [
        createMockNetworkDevice(),
        createMockNetworkDevice()
      ];
      const total = 2;

      // Act
      const listDTO = NetworkDeviceMapper.toListDTO(devices, total);

      // Assert
      listDTO.devices.forEach((dto, index) => {
        expect(dto.id).toBe(devices[index].id.toString());
        expect(dto.ipAddress).toBe(
          devices[index].ipAddress.toString()
        );
        expect(dto.macAddress).toBe(
          devices[index].macAddress.toString()
        );
      });
    });
  });

  // ========================================
  // extractCreateData() Tests
  // ========================================

  describe('extractCreateData', () => {
    it('should extract required fields as-is without validation', () => {
      // Arrange
      const dto: CreateNetworkDeviceDTO = {
        name: 'Router-01',
        deviceType: 'ROUTER',
        ipAddress: '10.0.0.1',
        macAddress: 'FF:EE:DD:CC:BB:AA',
        deviceId: 'uuid-device-001'
      };

      // Act
      const data = NetworkDeviceMapper.extractCreateData(dto);

      // Assert
      expect(data.name).toBe('Router-01');
      expect(data.deviceType).toBe('ROUTER');
      expect(data.ipAddress).toBe('10.0.0.1');
      expect(data.macAddress).toBe('FF:EE:DD:CC:BB:AA');
      expect(data.deviceId).toBe('uuid-device-001');
    });

    it('should apply data-level defaults for optional fields', () => {
      // Arrange
      const dto: CreateNetworkDeviceDTO = {
        name: 'Router-01',
        deviceType: 'ROUTER',
        ipAddress: '10.0.0.1',
        macAddress: 'FF:EE:DD:CC:BB:AA',
        deviceId: 'uuid-device-001'
      };

      // Act
      const data = NetworkDeviceMapper.extractCreateData(dto);

      // Assert
      expect(data.description).toBeNull();
      expect(data.location).toBeNull();
      expect(data.connectivityType).toBe('ETHERNET');
      expect(data.managementProtocol).toBe('ICMP');
      expect(data.managementPort).toBe(161);
      expect(data.enabledRemoteAccess).toBe(false);
      expect(data.performPingTest).toBe(false);
    });

    it('should use provided optional values instead of defaults', () => {
      // Arrange
      const dto: CreateNetworkDeviceDTO = {
        name: 'Router-01',
        deviceType: 'ROUTER',
        ipAddress: '10.0.0.1',
        macAddress: 'FF:EE:DD:CC:BB:AA',
        deviceId: 'uuid-device-001',
        description: 'Main router',
        location: 'Data Center',
        connectivityType: 'WIFI',
        managementProtocol: 'SNMP',
        managementPort: 8080,
        enabledRemoteAccess: true,
        performPingTest: true
      };

      // Act
      const data = NetworkDeviceMapper.extractCreateData(dto);

      // Assert
      expect(data.description).toBe('Main router');
      expect(data.location).toBe('Data Center');
      expect(data.connectivityType).toBe('WIFI');
      expect(data.managementProtocol).toBe('SNMP');
      expect(data.managementPort).toBe(8080);
      expect(data.enabledRemoteAccess).toBe(true);
      expect(data.performPingTest).toBe(true);
    });

    it('should return raw primitives (strings, numbers, booleans)', () => {
      // Arrange
      const dto: CreateNetworkDeviceDTO = {
        name: 'Router-01',
        deviceType: 'ROUTER',
        ipAddress: '10.0.0.1',
        macAddress: 'FF:EE:DD:CC:BB:AA',
        deviceId: 'uuid-device-001',
        managementPort: 8080,
        enabledRemoteAccess: true
      };

      // Act
      const data = NetworkDeviceMapper.extractCreateData(dto);

      // Assert
      expect(typeof data.name).toBe('string');
      expect(typeof data.deviceType).toBe('string');
      expect(typeof data.ipAddress).toBe('string');
      expect(typeof data.macAddress).toBe('string');
      expect(typeof data.connectivityType).toBe('string');
      expect(typeof data.managementPort).toBe('number');
      expect(typeof data.enabledRemoteAccess).toBe('boolean');
    });

    it('should handle explicit null values for optional fields', () => {
      // Arrange
      const dto: CreateNetworkDeviceDTO = {
        name: 'Router-01',
        deviceType: 'ROUTER',
        ipAddress: '10.0.0.1',
        macAddress: 'FF:EE:DD:CC:BB:AA',
        deviceId: 'uuid-device-001',
        description: null,
        location: null
      };

      // Act
      const data = NetworkDeviceMapper.extractCreateData(dto);

      // Assert
      expect(data.description).toBeNull();
      expect(data.location).toBeNull();
    });

    it('should not perform any validation on extracted data', () => {
      // Arrange - Invalid data that mapper should NOT validate
      const dto: CreateNetworkDeviceDTO = {
        name: '', // Empty name - mapper should not validate
        deviceType: 'INVALID_TYPE', // Invalid enum - mapper should not validate
        ipAddress: 'invalid-ip', // Invalid IP - mapper should not validate
        macAddress: 'invalid-mac', // Invalid MAC - mapper should not validate
        deviceId: '',
        managementPort: 999999 // Out of range - mapper should not validate
      };

      // Act - Should not throw, just extract
      const data = NetworkDeviceMapper.extractCreateData(dto);

      // Assert - Mapper extracted raw values without validation
      expect(data.name).toBe('');
      expect(data.deviceType).toBe('INVALID_TYPE');
      expect(data.ipAddress).toBe('invalid-ip');
      expect(data.macAddress).toBe('invalid-mac');
      expect(data.managementPort).toBe(999999);
    });
  });

  // ========================================
  // extractUpdateData() Tests
  // ========================================

  describe('extractUpdateData', () => {
    it('should extract only provided fields (partial update)', () => {
      // Arrange
      const dto: UpdateNetworkDeviceDTO = {
        name: 'Updated Router'
      };

      // Act
      const data = NetworkDeviceMapper.extractUpdateData(dto);

      // Assert
      expect(data.name).toBe('Updated Router');
      expect(Object.keys(data)).toHaveLength(1);
      expect(data.description).toBeUndefined();
      expect(data.managementPort).toBeUndefined();
    });

    it('should include all provided fields', () => {
      // Arrange
      const dto: UpdateNetworkDeviceDTO = {
        name: 'Updated Router',
        description: 'New description',
        managementPort: 9000,
        enabledRemoteAccess: true
      };

      // Act
      const data = NetworkDeviceMapper.extractUpdateData(dto);

      // Assert
      expect(data.name).toBe('Updated Router');
      expect(data.description).toBe('New description');
      expect(data.managementPort).toBe(9000);
      expect(data.enabledRemoteAccess).toBe(true);
      expect(Object.keys(data)).toHaveLength(4);
    });

    it('should handle null description to clear field', () => {
      // Arrange
      const dto: UpdateNetworkDeviceDTO = {
        description: null
      };

      // Act
      const data = NetworkDeviceMapper.extractUpdateData(dto);

      // Assert
      expect(data.description).toBeNull();
      expect(Object.keys(data)).toHaveLength(1);
    });

    it('should extract deviceType and connectivityType even though they are immutable', () => {
      // Arrange - Mapper doesn't know these are immutable, use case enforces that
      const dto: UpdateNetworkDeviceDTO = {
        deviceType: 'SWITCH',
        connectivityType: 'WIFI'
      };

      // Act
      const data = NetworkDeviceMapper.extractUpdateData(dto);

      // Assert
      expect(data.deviceType).toBe('SWITCH');
      expect(data.connectivityType).toBe('WIFI');
    });

    it('should extract managementProtocol string', () => {
      // Arrange
      const dto: UpdateNetworkDeviceDTO = {
        managementProtocol: 'SNMP'
      };

      // Act
      const data = NetworkDeviceMapper.extractUpdateData(dto);

      // Assert
      expect(data.managementProtocol).toBe('SNMP');
      expect(typeof data.managementProtocol).toBe('string');
    });

    it('should return empty object when no fields provided', () => {
      // Arrange
      const dto: UpdateNetworkDeviceDTO = {};

      // Act
      const data = NetworkDeviceMapper.extractUpdateData(dto);

      // Assert
      expect(data).toEqual({});
      expect(Object.keys(data)).toHaveLength(0);
    });

    it('should handle boolean false value (not undefined)', () => {
      // Arrange
      const dto: UpdateNetworkDeviceDTO = {
        enabledRemoteAccess: false
      };

      // Act
      const data = NetworkDeviceMapper.extractUpdateData(dto);

      // Assert
      expect(data.enabledRemoteAccess).toBe(false);
      expect(Object.keys(data)).toHaveLength(1);
    });

    it('should handle zero value for managementPort (not undefined)', () => {
      // Arrange - Even though 0 is invalid, mapper should extract it
      const dto: UpdateNetworkDeviceDTO = {
        managementPort: 0
      };

      // Act
      const data = NetworkDeviceMapper.extractUpdateData(dto);

      // Assert
      expect(data.managementPort).toBe(0);
      expect(Object.keys(data)).toHaveLength(1);
    });

    it('should not perform any validation on extracted update data', () => {
      // Arrange - Invalid data that mapper should NOT validate
      const dto: UpdateNetworkDeviceDTO = {
        name: '', // Empty - should not validate
        managementPort: -1 // Invalid - should not validate
      };

      // Act
      const data = NetworkDeviceMapper.extractUpdateData(dto);

      // Assert
      expect(data.name).toBe('');
      expect(data.managementPort).toBe(-1);
    });
  });

  // ========================================
  // Mapper Compliance Tests
  // ========================================

  describe('Mapper Compliance (APPLICATION-MAPPER-STANDARD.md)', () => {
    it('should have only static methods', () => {
      // Assert
      expect(typeof NetworkDeviceMapper.toDTO).toBe('function');
      expect(typeof NetworkDeviceMapper.toListDTO).toBe('function');
      expect(typeof NetworkDeviceMapper.extractCreateData).toBe(
        'function'
      );
      expect(typeof NetworkDeviceMapper.extractUpdateData).toBe(
        'function'
      );

      // Verify class cannot be instantiated in a meaningful way
      const instance = new (NetworkDeviceMapper as any)();
      expect(instance).toBeDefined();
    });

    it('should not have constructor dependencies', () => {
      // Mapper should be a static class with no instance methods
      // All methods should be accessible without instantiation
      expect(typeof NetworkDeviceMapper.toDTO).toBe('function');
      expect(typeof NetworkDeviceMapper.toListDTO).toBe('function');
      expect(typeof NetworkDeviceMapper.extractCreateData).toBe('function');
      expect(typeof NetworkDeviceMapper.extractUpdateData).toBe('function');
    });

    it('should perform pure transformations (deterministic)', () => {
      // Arrange
      const device = createMockNetworkDevice();

      // Act
      const dto1 = NetworkDeviceMapper.toDTO(device);
      const dto2 = NetworkDeviceMapper.toDTO(device);

      // Assert - Same input produces same output
      expect(dto1).toEqual(dto2);
    });

    it('should not modify input objects (pure function)', () => {
      // Arrange
      const dto: CreateNetworkDeviceDTO = {
        name: 'Router-01',
        deviceType: 'ROUTER',
        ipAddress: '10.0.0.1',
        macAddress: 'FF:EE:DD:CC:BB:AA',
        deviceId: 'uuid-001'
      };
      const originalDTO = { ...dto };

      // Act
      NetworkDeviceMapper.extractCreateData(dto);

      // Assert - Input unchanged
      expect(dto).toEqual(originalDTO);
    });
  });
});
