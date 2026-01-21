import {
  ActivateNetworkDeviceUseCase,
  ILogger,
  ActivateNetworkDeviceRequestDTO
} from '../../../src/application';
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
  ActivationStatus,
  INetworkDeviceRepository,
  PollingConfigurationId
} from '../../../src/domain';

describe('ActivateNetworkDeviceUseCase', () => {
  // ========================================
  // Mocks
  // ========================================

  let useCase: ActivateNetworkDeviceUseCase;
  let mockRepository: jest.Mocked<INetworkDeviceRepository>;
  let mockLogger: jest.Mocked<ILogger>;

  beforeEach(() => {
    // Mock repository
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

    // Mock logger
    mockLogger = {
      info: jest.fn(),
      warn: jest.fn(),
      error: jest.fn(),
      debug: jest.fn(),
      fatal: jest.fn(),
      child: jest.fn().mockReturnThis(),
      setLevel: jest.fn()
    } as any;

    useCase = new ActivateNetworkDeviceUseCase(
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

  const createMockDraftDevice = (): NetworkDevice => {
    const deviceId = NetworkDeviceId.create().value;
    const ipAddress = IPAddress.create('192.168.1.100').value;
    const macAddress = MACAddress.create('AA:BB:CC:DD:EE:FF').value;
    const pollingConfig = PollingConfiguration.createDefault(
      deviceId,
      PollingConfigurationId.create().value
    ).value;

    const props: NetworkDeviceProps = {
      name: 'device-001', // DRAFT - no name yet
      deviceType: NetworkDeviceType.createUnknown(), // DRAFT - unknown type
      status: NetworkDeviceStatus.createOffline(),
      description: null,
      ipAddress,
      macAddress,
      connectivityType: ConnectivityType.ETHERNET,
      managementProtocol: ManagementProtocol.SNMP,
      managementPort: 161,
      enabledRemoteAccess: false,
      deviceId: 'device-001',
      pollingConfiguration: pollingConfig,
      installDate: new Date(),
      createdAt: new Date(),
      updatedAt: new Date(),
      activationStatus: ActivationStatus.DRAFT,
      activatedAt: null,
      activatedBy: null,

      // REQ-002: null,
      deletedAt: null,
      deletedBy: null,

      // REQ-002: null,
      replacedByDeviceId: null,
      replacedAt: null
    };

    return NetworkDevice.create(props, deviceId).value;
  };

  const createValidActivateRequest = (
    deviceId: string
  ): ActivateNetworkDeviceRequestDTO => ({
    id: deviceId,
    name: 'Router-Core-01',
    deviceType: 'ROUTER',
    description: 'Main core router',
    connectivityType: 'ETHERNET',
    managementProtocol: 'SNMP',
    managementPort: 161,
    enabledRemoteAccess: false
  });

  // ========================================
  // Success Cases
  // ========================================

  describe('Success Cases', () => {
    it('should activate a DRAFT device successfully', async () => {
      // Arrange
      const device = createMockDraftDevice();
      const request = createValidActivateRequest(
        device.id.toString()
      );

      mockRepository.findById.mockResolvedValue(Result.ok(device));
      mockRepository.save.mockResolvedValue(Result.ok(device));

      // Act
      const result = await useCase.execute(request);

      // Assert
      expect(result.isSuccess).toBe(true);
      expect(result.value).toBeDefined();
      expect(result.value.activationStatus).toBe(
        ActivationStatus.ACTIVE
      );
      expect(result.value.activatedBy).toBe('system:admin');
    });

    it('should update device name during activation', async () => {
      // Arrange
      const device = createMockDraftDevice();
      const request = createValidActivateRequest(
        device.id.toString()
      );

      mockRepository.findById.mockResolvedValue(Result.ok(device));
      mockRepository.save.mockResolvedValue(Result.ok(device));

      // Act
      const result = await useCase.execute(request);

      // Assert
      expect(result.isSuccess).toBe(true);
      expect(result.value.name).toBe('Router-Core-01');
    });

    it('should update device type during activation', async () => {
      // Arrange
      const device = createMockDraftDevice();
      const request = createValidActivateRequest(
        device.id.toString()
      );

      mockRepository.findById.mockResolvedValue(Result.ok(device));
      mockRepository.save.mockResolvedValue(Result.ok(device));

      // Act
      const result = await useCase.execute(request);

      // Assert
      expect(result.isSuccess).toBe(true);
      expect(result.value.deviceType).toBe('ROUTER');
    });

    it('should update description during activation', async () => {
      // Arrange
      const device = createMockDraftDevice();
      const request = createValidActivateRequest(
        device.id.toString()
      );

      mockRepository.findById.mockResolvedValue(Result.ok(device));
      mockRepository.save.mockResolvedValue(Result.ok(device));

      // Act
      const result = await useCase.execute(request);

      // Assert
      expect(result.isSuccess).toBe(true);
      expect(result.value.description).toBe('Main core router');
    });

    it('should update connectivity type during activation', async () => {
      // Arrange
      const device = createMockDraftDevice();
      const request = {
        ...createValidActivateRequest(device.id.toString()),
        connectivityType: 'FIBER_OPTIC'
      };

      mockRepository.findById.mockResolvedValue(Result.ok(device));
      mockRepository.save.mockResolvedValue(Result.ok(device));

      // Act
      const result = await useCase.execute(request);

      // Assert
      expect(result.isSuccess).toBe(true);
      expect(result.value.connectivityType).toBe('FIBER_OPTIC');
    });

    it('should update management protocol during activation', async () => {
      // Arrange
      const device = createMockDraftDevice();
      const request = {
        ...createValidActivateRequest(device.id.toString()),
        managementProtocol: 'SSH'
      };

      mockRepository.findById.mockResolvedValue(Result.ok(device));
      mockRepository.save.mockResolvedValue(Result.ok(device));

      // Act
      const result = await useCase.execute(request);

      // Assert
      expect(result.isSuccess).toBe(true);
      expect(result.value.managementProtocol).toBe('SSH');
    });

    it('should update management port during activation', async () => {
      // Arrange
      const device = createMockDraftDevice();
      const request = {
        ...createValidActivateRequest(device.id.toString()),
        managementPort: 22
      };

      mockRepository.findById.mockResolvedValue(Result.ok(device));
      mockRepository.save.mockResolvedValue(Result.ok(device));

      // Act
      const result = await useCase.execute(request);

      // Assert
      expect(result.isSuccess).toBe(true);
      expect(result.value.managementPort).toBe(22);
    });

    it('should update remote access during activation', async () => {
      // Arrange
      const device = createMockDraftDevice();
      const request = {
        ...createValidActivateRequest(device.id.toString()),
        enabledRemoteAccess: true
      };

      mockRepository.findById.mockResolvedValue(Result.ok(device));
      mockRepository.save.mockResolvedValue(Result.ok(device));

      // Act
      const result = await useCase.execute(request);

      // Assert
      expect(result.isSuccess).toBe(true);
      expect(result.value.enabledRemoteAccess).toBe(true);
    });

    it('should call repository.save() with activated device', async () => {
      // Arrange
      const device = createMockDraftDevice();
      const request = createValidActivateRequest(
        device.id.toString()
      );

      mockRepository.findById.mockResolvedValue(Result.ok(device));
      mockRepository.save.mockResolvedValue(Result.ok(device));

      // Act
      await useCase.execute(request);

      // Assert
      expect(mockRepository.save).toHaveBeenCalledTimes(1);
      const savedDevice = mockRepository.save.mock.calls[0][0];
      expect(savedDevice).toBeInstanceOf(NetworkDevice);
      expect(savedDevice.activationStatus).toBe(
        ActivationStatus.ACTIVE
      );
    });
  });

  // ========================================
  // Validation Tests
  // ========================================

  describe('Input Validation', () => {
    it('should fail when device ID is missing', async () => {
      // Arrange
      const request = createValidActivateRequest('');

      // Act
      const result = await useCase.execute(request);

      // Assert
      expect(result.isFailure).toBe(true);
      expect(result.error).toContain('Device ID is required');
    });

    it('should fail when name is missing', async () => {
      // Arrange
      const device = createMockDraftDevice();
      const request = {
        ...createValidActivateRequest(device.id.toString()),
        name: ''
      };

      // Act
      const result = await useCase.execute(request);

      // Assert
      expect(result.isFailure).toBe(true);
      expect(result.error).toContain('name is required');
    });

    it('should fail when deviceType is missing', async () => {
      // Arrange
      const device = createMockDraftDevice();
      const request = {
        ...createValidActivateRequest(device.id.toString()),
        deviceType: ''
      };

      // Act
      const result = await useCase.execute(request);

      // Assert
      expect(result.isFailure).toBe(true);
      expect(result.error).toContain('Device type is required');
    });

    it('should fail when device ID is invalid', async () => {
      // Arrange
      const request = createValidActivateRequest('invalid-uuid');

      mockRepository.findById.mockResolvedValue(
        Result.fail('Invalid UUID format')
      );

      // Act
      const result = await useCase.execute(request);

      // Assert
      expect(result.isFailure).toBe(true);
      expect(result.error).toContain('Invalid device ID');
    });
  });

  // ========================================
  // Business Rules Validation Tests
  // ========================================

  describe('Business Rules', () => {
    it('should fail when device does not exist', async () => {
      // Arrange
      const request = createValidActivateRequest(
        NetworkDeviceId.create().value.toString()
      );

      mockRepository.findById.mockResolvedValue(Result.ok(null));

      // Act
      const result = await useCase.execute(request);

      // Assert
      expect(result.isFailure).toBe(true);
      expect(result.error).toContain('not found');
      expect(mockRepository.save).not.toHaveBeenCalled();
    });

    it('should fail when device is already ACTIVE', async () => {
      // Arrange
      const networkDevice = createMockDraftDevice();
      // Manually activate device first
      networkDevice.activate('test-user');

      const request = createValidActivateRequest(
        networkDevice.id.toString()
      );

      mockRepository.findById.mockResolvedValue(
        Result.ok(networkDevice)
      );

      // Act
      const result = await useCase.execute(request);

      // Assert
      expect(result.isFailure).toBe(true);
      expect(result.error).toContain('already');
      expect(result.error).toContain('ACTIVE');
      expect(mockRepository.save).not.toHaveBeenCalled();
    });

    it('should fail when device is soft-deleted', async () => {
      // Arrange
      const device = createMockDraftDevice();
      // Manually soft-delete device
      device.markForDeletion('test-user');

      const request = createValidActivateRequest(
        device.id.toString()
      );

      mockRepository.findById.mockResolvedValue(Result.ok(device));

      // Act
      const result = await useCase.execute(request);

      // Assert
      expect(result.isFailure).toBe(true);
      expect(result.error).toContain('soft-deleted');
      expect(result.error).toContain('Restore it first');
      expect(mockRepository.save).not.toHaveBeenCalled();
    });

    it('should only activate DRAFT devices', async () => {
      // Arrange
      const device = createMockDraftDevice();
      expect(device.activationStatus).toBe(ActivationStatus.DRAFT);

      const request = createValidActivateRequest(
        device.id.toString()
      );

      mockRepository.findById.mockResolvedValue(Result.ok(device));
      mockRepository.save.mockResolvedValue(Result.ok(device));

      // Act
      const result = await useCase.execute(request);

      // Assert
      expect(result.isSuccess).toBe(true);
      expect(result.value.activationStatus).toBe(
        ActivationStatus.ACTIVE
      );
    });
  });

  // ========================================
  // Enum Mapping Tests
  // ========================================

  describe('Enum Mapping', () => {
    it('should map valid deviceType to enum (case-insensitive)', async () => {
      // Arrange
      const device = createMockDraftDevice();
      const request = {
        ...createValidActivateRequest(device.id.toString()),
        deviceType: 'switch' // Lowercase
      };

      mockRepository.findById.mockResolvedValue(Result.ok(device));
      mockRepository.save.mockResolvedValue(Result.ok(device));

      // Act
      const result = await useCase.execute(request);

      // Assert
      expect(result.isSuccess).toBe(true);
      expect(result.value.deviceType).toBe('SWITCH');
    });

    it('should map ACCESS_POINT with AP alias', async () => {
      // Arrange
      const device = createMockDraftDevice();
      const request = {
        ...createValidActivateRequest(device.id.toString()),
        deviceType: 'AP'
      };

      mockRepository.findById.mockResolvedValue(Result.ok(device));
      mockRepository.save.mockResolvedValue(Result.ok(device));

      // Act
      const result = await useCase.execute(request);

      // Assert
      expect(result.isSuccess).toBe(true);
      expect(result.value.deviceType).toBe('ACCESS_POINT');
    });

    it('should fallback to UNKNOWN for invalid deviceType', async () => {
      // Arrange
      const device = createMockDraftDevice();
      const request = {
        ...createValidActivateRequest(device.id.toString()),
        deviceType: 'INVALID_TYPE'
      };

      mockRepository.findById.mockResolvedValue(Result.ok(device));
      mockRepository.save.mockResolvedValue(Result.ok(device));

      // Act
      const result = await useCase.execute(request);

      // Assert
      expect(result.isSuccess).toBe(true);
      expect(result.value.deviceType).toBe('UNKNOWN');
    });

    it('should map FIBER_OPTIC with FIBER alias', async () => {
      // Arrange
      const device = createMockDraftDevice();
      const request = {
        ...createValidActivateRequest(device.id.toString()),
        connectivityType: 'FIBER'
      };

      mockRepository.findById.mockResolvedValue(Result.ok(device));
      mockRepository.save.mockResolvedValue(Result.ok(device));

      // Act
      const result = await useCase.execute(request);

      // Assert
      expect(result.isSuccess).toBe(true);
      expect(result.value.connectivityType).toBe('FIBER_OPTIC');
    });

    it('should map WIRELESS with WIFI alias', async () => {
      // Arrange
      const device = createMockDraftDevice();
      const request = {
        ...createValidActivateRequest(device.id.toString()),
        connectivityType: 'WIFI'
      };

      mockRepository.findById.mockResolvedValue(Result.ok(device));
      mockRepository.save.mockResolvedValue(Result.ok(device));

      // Act
      const result = await useCase.execute(request);

      // Assert
      expect(result.isSuccess).toBe(true);
      expect(result.value.connectivityType).toBe('WIRELESS');
    });

    it('should fallback to OTHER for invalid connectivityType', async () => {
      // Arrange
      const device = createMockDraftDevice();
      const request = {
        ...createValidActivateRequest(device.id.toString()),
        connectivityType: 'INVALID'
      };

      mockRepository.findById.mockResolvedValue(Result.ok(device));
      mockRepository.save.mockResolvedValue(Result.ok(device));

      // Act
      const result = await useCase.execute(request);

      // Assert
      expect(result.isSuccess).toBe(true);
      expect(result.value.connectivityType).toBe('OTHER');
    });

    it('should fallback to OTHER for invalid managementProtocol', async () => {
      // Arrange
      const device = createMockDraftDevice();
      const request = {
        ...createValidActivateRequest(device.id.toString()),
        managementProtocol: 'INVALID'
      };

      mockRepository.findById.mockResolvedValue(Result.ok(device));
      mockRepository.save.mockResolvedValue(Result.ok(device));

      // Act
      const result = await useCase.execute(request);

      // Assert
      expect(result.isSuccess).toBe(true);
      expect(result.value.managementProtocol).toBe('OTHER');
    });
  });

  // ========================================
  // Repository Interaction Tests
  // ========================================

  describe('Repository Interactions', () => {
    it('should load device by ID', async () => {
      // Arrange
      const device = createMockDraftDevice();
      const request = createValidActivateRequest(
        device.id.toString()
      );

      mockRepository.findById.mockResolvedValue(Result.ok(device));
      mockRepository.save.mockResolvedValue(Result.ok(device));

      // Act
      await useCase.execute(request);

      // Assert
      expect(mockRepository.findById).toHaveBeenCalledTimes(1);
      const calledWithId = mockRepository.findById.mock.calls[0][0];
      expect(calledWithId).toBeInstanceOf(NetworkDeviceId);
      expect(calledWithId.toString()).toBe(device.id.toString());
    });

    it('should handle repository findById error', async () => {
      // Arrange
      const request = createValidActivateRequest(
        NetworkDeviceId.create().value.toString()
      );

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
      const device = createMockDraftDevice();
      const request = createValidActivateRequest(
        device.id.toString()
      );

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
    it('should handle null description during activation', async () => {
      // Arrange
      const device = createMockDraftDevice();
      const request = {
        ...createValidActivateRequest(device.id.toString()),
        description: null
      };

      mockRepository.findById.mockResolvedValue(Result.ok(device));
      mockRepository.save.mockResolvedValue(Result.ok(device));

      // Act
      const result = await useCase.execute(request);

      // Assert
      expect(result.isSuccess).toBe(true);
      expect(result.value.description).toBeNull();
    });

    it('should handle all enum types correctly', async () => {
      // Arrange
      const device = createMockDraftDevice();
      const request = {
        id: device.id.toString(),
        name: 'Test Device',
        deviceType: 'FIREWALL',
        connectivityType: 'SATELLITE',
        managementProtocol: 'HTTPS',
        managementPort: 443,
        enabledRemoteAccess: true
      };

      mockRepository.findById.mockResolvedValue(Result.ok(device));
      mockRepository.save.mockResolvedValue(Result.ok(device));

      // Act
      const result = await useCase.execute(request);

      // Assert
      expect(result.isSuccess).toBe(true);
      expect(result.value.deviceType).toBe('FIREWALL');
      expect(result.value.connectivityType).toBe('SATELLITE');
      expect(result.value.managementProtocol).toBe('HTTPS');
      expect(result.value.managementPort).toBe(443);
      expect(result.value.enabledRemoteAccess).toBe(true);
    });
  });

  // ========================================
  // Logging Tests
  // ========================================

  describe('Logging', () => {
    it('should log activation', async () => {
      // Arrange
      const device = createMockDraftDevice();
      const request = createValidActivateRequest(
        device.id.toString()
      );

      mockRepository.findById.mockResolvedValue(Result.ok(device));
      mockRepository.save.mockResolvedValue(Result.ok(device));

      // Act
      await useCase.execute(request);

      // Assert
      expect(mockLogger.info).toHaveBeenCalled();
    });
  });
});
