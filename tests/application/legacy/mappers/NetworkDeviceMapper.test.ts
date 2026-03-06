import { NetworkDeviceMapper } from '../../../src/application/device-inventory/mappers/NetworkDeviceMapper';
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
  RetryPolicy,
  ActivationStatus
} from '../../../src/domain/device-inventory';
import {
  CreateNetworkDeviceDTO,
  UpdateNetworkDeviceDTO,
  ActivateNetworkDeviceRequestDTO,
  SoftDeleteNetworkDeviceRequestDTO,
  RestoreNetworkDeviceRequestDTO
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
        deviceType: NetworkDeviceType.createRouter(),
        status: NetworkDeviceStatus.createOffline(),
        description: 'Test device description',
        ipAddress,
        macAddress,
        connectivityType: ConnectivityType.createEthernet(),
        managementProtocol: ManagementProtocol.createSnmp(),
        managementPort: 161,
        enabledRemoteAccess: false,
        deviceId: 'device-uuid-123',
        pollingConfiguration: pollingConfig,
        installDate: new Date('2024-01-01'),
        createdAt: new Date('2024-01-01T10:00:00Z'),
        updatedAt: new Date('2024-01-01T10:00:00Z'),
        activationStatus: ActivationStatus.ACTIVE,
        activatedAt: null,
        activatedBy: null,
        deletedAt: null,
        deletedBy: null,
        replacedByDeviceId: null,
        replacedAt: null
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
      expect(dto.pollingConfiguration.networkDeviceId).toBe(
        device.id.toString()
      );
      expect(dto.pollingConfiguration.enabled).toBe(false);
      expect(dto.pollingConfiguration.intervalSeconds).toBe(60);
      expect(dto.pollingConfiguration.pingCount).toBe(4);
      expect(dto.pollingConfiguration.retryPolicy).toBeDefined();
      expect(dto.pollingConfiguration.retryPolicy.maxAttempts).toBe(
        3
      );
      expect(dto.pollingConfiguration.retryPolicy.baseDelayMs).toBe(
        1000
      );
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
          updatedAt: device.updatedAt,
          activationStatus: ActivationStatus.ACTIVE,
          activatedAt: null,
          activatedBy: null,
          deletedAt: null,
          deletedBy: null,
          replacedByDeviceId: null,
          replacedAt: null
        },
        device.id
      );
      const deviceWithNullDesc = deviceResult.value;

      // Act
      const dto = NetworkDeviceMapper.toDTO(deviceWithNullDesc);

      // Assert
      expect(dto.description).toBeNull();
    });

    it('should transform Date objects into strings', () => {
      // Arrange
      const device = createMockNetworkDevice();

      // Act
      const dto = NetworkDeviceMapper.toDTO(device);

      // Assert
      expect(typeof dto.installDate).toBe('string');
      expect(typeof dto.createdAt).toBe('string');
      expect(typeof dto.updatedAt).toBe('string');
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

    // ========================================
    // REQ-002: Lifecycle Management Fields
    // ========================================

    it('should map activationStatus to string', () => {
      // Arrange
      const device = createMockNetworkDevice();

      // Act
      const dto = NetworkDeviceMapper.toDTO(device);

      // Assert
      expect(dto.activationStatus).toBe('ACTIVE');
      expect(typeof dto.activationStatus).toBe('string');
    });

    it('should map DRAFT activationStatus correctly', () => {
      // Arrange
      const deviceId = NetworkDeviceId.create().value;
      const ipAddress = IPAddress.create('192.168.1.1').value;
      const macAddress = MACAddress.create('AA:BB:CC:DD:EE:FF').value;
      const pollingConfig = createMockPollingConfiguration(deviceId);

      const deviceResult = NetworkDevice.create(
        {
          name: 'Draft Device',
          deviceType: NetworkDeviceType.createRouter(),
          status: NetworkDeviceStatus.createOffline(),
          description: null,
          ipAddress,
          macAddress,
          connectivityType: ConnectivityType.createEthernet(),
          managementProtocol: ManagementProtocol.createSnmp(),
          managementPort: 161,
          enabledRemoteAccess: false,
          deviceId: 'device-uuid-draft',
          pollingConfiguration: pollingConfig,
          installDate: new Date('2024-01-01'),
          createdAt: new Date('2024-01-01T10:00:00Z'),
          updatedAt: new Date('2024-01-01T10:00:00Z'),
          activationStatus: ActivationStatus.DRAFT,
          activatedAt: null,
          activatedBy: null,
          deletedAt: null,
          deletedBy: null,
          replacedByDeviceId: null,
          replacedAt: null
        },
        deviceId
      );
      const draftDevice = deviceResult.value;

      // Act
      const dto = NetworkDeviceMapper.toDTO(draftDevice);

      // Assert
      expect(dto.activationStatus).toBe('DRAFT');
      expect(dto.activatedAt).toBeNull();
      expect(dto.activatedBy).toBeNull();
    });

    it('should map activation workflow fields when device is activated', () => {
      // Arrange
      const deviceId = NetworkDeviceId.create().value;
      const ipAddress = IPAddress.create('192.168.1.1').value;
      const macAddress = MACAddress.create('AA:BB:CC:DD:EE:FF').value;
      const pollingConfig = createMockPollingConfiguration(deviceId);
      const activatedAt = new Date('2024-01-15T10:30:00Z');

      const deviceResult = NetworkDevice.create(
        {
          name: 'Activated Device',
          deviceType: NetworkDeviceType.createRouter(),
          status: NetworkDeviceStatus.createOnline(),
          description: 'Fully activated device',
          ipAddress,
          macAddress,
          connectivityType: ConnectivityType.createEthernet(),
          managementProtocol: ManagementProtocol.createSnmp(),
          managementPort: 161,
          enabledRemoteAccess: true,
          deviceId: 'device-uuid-activated',
          pollingConfiguration: pollingConfig,
          installDate: new Date('2024-01-01'),
          createdAt: new Date('2024-01-01T10:00:00Z'),
          updatedAt: new Date('2024-01-15T10:30:00Z'),
          activationStatus: ActivationStatus.ACTIVE,
          activatedAt: activatedAt,
          activatedBy: 'admin@example.com',
          deletedAt: null,
          deletedBy: null,
          replacedByDeviceId: null,
          replacedAt: null
        },
        deviceId
      );
      const activatedDevice = deviceResult.value;

      // Act
      const dto = NetworkDeviceMapper.toDTO(activatedDevice);

      // Assert
      expect(dto.activationStatus).toBe('ACTIVE');
      expect(dto.activatedAt).toBe('2024-01-15T10:30:00.000Z');
      expect(dto.activatedBy).toBe('admin@example.com');
    });

    it('should map soft delete fields when device is deleted', () => {
      // Arrange
      const deviceId = NetworkDeviceId.create().value;
      const ipAddress = IPAddress.create('192.168.1.1').value;
      const macAddress = MACAddress.create('AA:BB:CC:DD:EE:FF').value;
      const pollingConfig = createMockPollingConfiguration(deviceId);
      const deletedAt = new Date('2024-01-20T14:00:00Z');

      const deviceResult = NetworkDevice.create(
        {
          name: 'Deleted Device',
          deviceType: NetworkDeviceType.createRouter(),
          status: NetworkDeviceStatus.createOffline(),
          description: 'Soft deleted device',
          ipAddress,
          macAddress,
          connectivityType: ConnectivityType.createEthernet(),
          managementProtocol: ManagementProtocol.createSnmp(),
          managementPort: 161,
          enabledRemoteAccess: false,
          deviceId: 'device-uuid-deleted',
          pollingConfiguration: pollingConfig,
          installDate: new Date('2024-01-01'),
          createdAt: new Date('2024-01-01T10:00:00Z'),
          updatedAt: new Date('2024-01-20T14:00:00Z'),
          activationStatus: ActivationStatus.ACTIVE,
          activatedAt: new Date('2024-01-05T10:00:00Z'),
          activatedBy: 'admin@example.com',
          deletedAt: deletedAt,
          deletedBy: 'cleanup-service',
          replacedByDeviceId: null,
          replacedAt: null
        },
        deviceId
      );
      const deletedDevice = deviceResult.value;

      // Act
      const dto = NetworkDeviceMapper.toDTO(deletedDevice);

      // Assert
      expect(dto.deletedAt).toBe('2024-01-20T14:00:00.000Z');
      expect(dto.deletedBy).toBe('cleanup-service');
    });

    it('should map replacement fields when device is replaced', () => {
      // Arrange
      const deviceId = NetworkDeviceId.create().value;
      const replacementDeviceId = NetworkDeviceId.create().value;
      const ipAddress = IPAddress.create('192.168.1.1').value;
      const macAddress = MACAddress.create('AA:BB:CC:DD:EE:FF').value;
      const pollingConfig = createMockPollingConfiguration(deviceId);
      const replacedAt = new Date('2024-01-25T09:00:00Z');

      const deviceResult = NetworkDevice.create(
        {
          name: 'Replaced Device',
          deviceType: NetworkDeviceType.createRouter(),
          status: NetworkDeviceStatus.createOffline(),
          description: 'Device replaced with newer model',
          ipAddress,
          macAddress,
          connectivityType: ConnectivityType.createEthernet(),
          managementProtocol: ManagementProtocol.createSnmp(),
          managementPort: 161,
          enabledRemoteAccess: false,
          deviceId: 'device-uuid-replaced',
          pollingConfiguration: pollingConfig,
          installDate: new Date('2024-01-01'),
          createdAt: new Date('2024-01-01T10:00:00Z'),
          updatedAt: new Date('2024-01-25T09:00:00Z'),
          activationStatus: ActivationStatus.ACTIVE,
          activatedAt: new Date('2024-01-05T10:00:00Z'),
          activatedBy: 'admin@example.com',
          deletedAt: null,
          deletedBy: null,
          replacedByDeviceId: replacementDeviceId,
          replacedAt: replacedAt
        },
        deviceId
      );
      const replacedDevice = deviceResult.value;

      // Act
      const dto = NetworkDeviceMapper.toDTO(replacedDevice);

      // Assert
      expect(dto.replacedByDeviceId).toBe(
        replacementDeviceId.toString()
      );
      expect(dto.replacedAt).toBe('2024-01-25T09:00:00.000Z');
    });

    it('should handle null lifecycle fields correctly', () => {
      // Arrange
      const device = createMockNetworkDevice();

      // Act
      const dto = NetworkDeviceMapper.toDTO(device);

      // Assert - Default mock device has null lifecycle fields
      expect(dto.activatedAt).toBeNull();
      expect(dto.activatedBy).toBeNull();
      expect(dto.deletedAt).toBeNull();
      expect(dto.deletedBy).toBeNull();
      expect(dto.replacedByDeviceId).toBeNull();
      expect(dto.replacedAt).toBeNull();
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

    it('should apply null for optional fields and false for activateImmediately', () => {
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
      expect(data.connectivityType).toBeNull();
      expect(data.managementProtocol).toBeNull();
      expect(data.managementPort).toBeNull();
      expect(data.enabledRemoteAccess).toBeNull();
      expect(data.performPingTest).toBeNull();
      // REQ-002: activateImmediately defaults to false (DRAFT status)
      expect(data.activateImmediately).toBe(false);
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
        connectivityType: 'WIFI',
        managementProtocol: 'SNMP',
        managementPort: 8080,
        enabledRemoteAccess: true,
        performPingTest: true,
        activateImmediately: true // REQ-002: Activate immediately
      };

      // Act
      const data = NetworkDeviceMapper.extractCreateData(dto);

      // Assert
      expect(data.description).toBe('Main router');
      expect(data.connectivityType).toBe('WIFI');
      expect(data.managementProtocol).toBe('SNMP');
      expect(data.managementPort).toBe(8080);
      expect(data.enabledRemoteAccess).toBe(true);
      expect(data.performPingTest).toBe(true);
      // REQ-002: activateImmediately should be extracted when true
      expect(data.activateImmediately).toBe(true);
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
        enabledRemoteAccess: true,

        performPingTest: false,
        description: 'Test device',
        connectivityType: 'ETHERNET',
        managementProtocol: 'SSH',
        activateImmediately: false
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
      expect(typeof data.performPingTest).toBe('boolean');
      expect(typeof data.description).toBe('string');
      expect(typeof data.connectivityType).toBe('string');
      expect(typeof data.managementProtocol).toBe('string');
      expect(typeof data.activateImmediately).toBe('boolean');
    });

    it('should handle explicit null values for optional fields', () => {
      // Arrange
      const dto: CreateNetworkDeviceDTO = {
        name: 'Router-01',
        deviceType: 'ROUTER',
        ipAddress: '10.0.0.1',
        macAddress: 'FF:EE:DD:CC:BB:AA',
        deviceId: 'uuid-device-001',
        description: null
      };

      // Act
      const data = NetworkDeviceMapper.extractCreateData(dto);

      // Assert
      expect(data.description).toBeNull();
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
  // extractActivateData() Tests
  // ========================================

  describe('extractActivateData', () => {
    it('should extract all fields from activation DTO', () => {
      // Arrange
      const dto: ActivateNetworkDeviceRequestDTO = {
        id: '550e8400-e29b-41d4-a716-446655440000',
        name: 'Activated Router',
        deviceType: 'ROUTER',
        description: 'Now fully configured',
        connectivityType: 'FIBER_OPTIC',
        managementProtocol: 'SNMP',
        managementPort: 161,
        enabledRemoteAccess: true
      };

      // Act
      const data = NetworkDeviceMapper.extractActivateData(dto);

      // Assert
      expect(data.id).toBe('550e8400-e29b-41d4-a716-446655440000');
      expect(data.name).toBe('Activated Router');
      expect(data.deviceType).toBe('ROUTER');
      expect(data.description).toBe('Now fully configured');
      expect(data.connectivityType).toBe('FIBER_OPTIC');
      expect(data.managementProtocol).toBe('SNMP');
      expect(data.managementPort).toBe(161);
      expect(data.enabledRemoteAccess).toBe(true);
    });

    it('should apply null defaults for optional enrichment fields', () => {
      // Arrange
      const dto: ActivateNetworkDeviceRequestDTO = {
        id: '550e8400-e29b-41d4-a716-446655440000',
        name: 'Router-01',
        deviceType: 'ROUTER'
      };

      // Act
      const data = NetworkDeviceMapper.extractActivateData(dto);

      // Assert
      expect(data.id).toBe('550e8400-e29b-41d4-a716-446655440000');
      expect(data.name).toBe('Router-01');
      expect(data.deviceType).toBe('ROUTER');
      expect(data.description).toBeNull();
      expect(data.connectivityType).toBeNull();
      expect(data.managementProtocol).toBeNull();
      expect(data.managementPort).toBeNull();
      expect(data.enabledRemoteAccess).toBeNull();
    });

    it('should preserve explicit null values', () => {
      // Arrange
      const dto: ActivateNetworkDeviceRequestDTO = {
        id: '550e8400-e29b-41d4-a716-446655440000',
        name: 'Router-01',
        deviceType: 'ROUTER',
        description: null
      };

      // Act
      const data = NetworkDeviceMapper.extractActivateData(dto);

      // Assert
      expect(data.description).toBeNull();
    });

    it('should extract all types correctly', () => {
      // Arrange
      const dto: ActivateNetworkDeviceRequestDTO = {
        id: '550e8400-e29b-41d4-a716-446655440000',
        name: 'Router-01',
        deviceType: 'ROUTER',
        managementPort: 8080,
        enabledRemoteAccess: false
      };

      // Act
      const data = NetworkDeviceMapper.extractActivateData(dto);

      // Assert
      expect(typeof data.id).toBe('string');
      expect(typeof data.name).toBe('string');
      expect(typeof data.deviceType).toBe('string');
      expect(typeof data.managementPort).toBe('number');
      expect(typeof data.enabledRemoteAccess).toBe('boolean');
    });

    it('should not perform validation on extracted data', () => {
      // Arrange - Invalid data that mapper should NOT validate
      const dto: ActivateNetworkDeviceRequestDTO = {
        id: 'invalid-uuid',
        name: '', // Empty - should not validate
        deviceType: 'INVALID_TYPE' // Invalid enum - should not validate
      };

      // Act - Should not throw
      const data = NetworkDeviceMapper.extractActivateData(dto);

      // Assert - Mapper extracted raw values without validation
      expect(data.id).toBe('invalid-uuid');
      expect(data.name).toBe('');
      expect(data.deviceType).toBe('INVALID_TYPE');
    });
  });

  // ========================================
  // extractSoftDeleteData() Tests
  // ========================================

  describe('extractSoftDeleteData', () => {
    it('should extract device ID and reason from soft delete DTO', () => {
      // Arrange
      const dto: SoftDeleteNetworkDeviceRequestDTO = {
        id: '550e8400-e29b-41d4-a716-446655440000',
        reason: 'Device replaced with newer model'
      };

      // Act
      const data = NetworkDeviceMapper.extractSoftDeleteData(dto);

      // Assert
      expect(data.id).toBe('550e8400-e29b-41d4-a716-446655440000');
      expect(data.reason).toBe('Device replaced with newer model');
    });

    it('should apply null default when reason is not provided', () => {
      // Arrange
      const dto: SoftDeleteNetworkDeviceRequestDTO = {
        id: '550e8400-e29b-41d4-a716-446655440000'
      };

      // Act
      const data = NetworkDeviceMapper.extractSoftDeleteData(dto);

      // Assert
      expect(data.id).toBe('550e8400-e29b-41d4-a716-446655440000');
      expect(data.reason).toBeNull();
    });

    it('should handle empty string reason', () => {
      // Arrange
      const dto: SoftDeleteNetworkDeviceRequestDTO = {
        id: '550e8400-e29b-41d4-a716-446655440000',
        reason: ''
      };

      // Act
      const data = NetworkDeviceMapper.extractSoftDeleteData(dto);

      // Assert
      expect(data.id).toBe('550e8400-e29b-41d4-a716-446655440000');
      expect(data.reason).toBe('');
    });

    it('should handle long reason text without validation', () => {
      // Arrange - Very long reason (mapper should not validate length)
      const longReason = 'A'.repeat(1000);
      const dto: SoftDeleteNetworkDeviceRequestDTO = {
        id: '550e8400-e29b-41d4-a716-446655440000',
        reason: longReason
      };

      // Act
      const data = NetworkDeviceMapper.extractSoftDeleteData(dto);

      // Assert
      expect(data.reason).toBe(longReason);
      expect(data.reason?.length).toBe(1000);
    });

    it('should extract all types correctly', () => {
      // Arrange
      const dto: SoftDeleteNetworkDeviceRequestDTO = {
        id: '550e8400-e29b-41d4-a716-446655440000',
        reason: 'Test reason'
      };

      // Act
      const data = NetworkDeviceMapper.extractSoftDeleteData(dto);

      // Assert
      expect(typeof data.id).toBe('string');
      expect(typeof data.reason).toBe('string');
    });
  });

  // ========================================
  // extractRestoreData() Tests
  // ========================================

  describe('extractRestoreData', () => {
    it('should extract device ID from restore DTO', () => {
      // Arrange
      const dto: RestoreNetworkDeviceRequestDTO = {
        id: '550e8400-e29b-41d4-a716-446655440000'
      };

      // Act
      const data = NetworkDeviceMapper.extractRestoreData(dto);

      // Assert
      expect(data.id).toBe('550e8400-e29b-41d4-a716-446655440000');
      expect(Object.keys(data)).toHaveLength(1);
    });

    it('should extract string ID type', () => {
      // Arrange
      const dto: RestoreNetworkDeviceRequestDTO = {
        id: '550e8400-e29b-41d4-a716-446655440000'
      };

      // Act
      const data = NetworkDeviceMapper.extractRestoreData(dto);

      // Assert
      expect(typeof data.id).toBe('string');
    });

    it('should not perform validation on extracted ID', () => {
      // Arrange - Invalid UUID that mapper should NOT validate
      const dto: RestoreNetworkDeviceRequestDTO = {
        id: 'invalid-uuid-format'
      };

      // Act - Should not throw
      const data = NetworkDeviceMapper.extractRestoreData(dto);

      // Assert - Mapper extracted raw value without validation
      expect(data.id).toBe('invalid-uuid-format');
    });

    it('should handle empty string ID without validation', () => {
      // Arrange
      const dto: RestoreNetworkDeviceRequestDTO = {
        id: ''
      };

      // Act
      const data = NetworkDeviceMapper.extractRestoreData(dto);

      // Assert
      expect(data.id).toBe('');
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
      expect(typeof NetworkDeviceMapper.extractCreateData).toBe(
        'function'
      );
      expect(typeof NetworkDeviceMapper.extractUpdateData).toBe(
        'function'
      );
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
