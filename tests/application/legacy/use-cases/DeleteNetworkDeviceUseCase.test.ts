import {
  DeleteNetworkDeviceUseCase,
  ILogger,
  DeleteNetworkDeviceDTO
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
  INetworkDeviceRepository,
  PollingConfigurationId,
  ActivationStatus
} from '../../../../src/domain/device-inventory';

describe('DeleteNetworkDeviceUseCase', () => {
  // ========================================
  // Mocks
  // ========================================

  let useCase: DeleteNetworkDeviceUseCase;
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

    useCase = new DeleteNetworkDeviceUseCase(
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
    const pollingConfigId = PollingConfigurationId.create().value;
    const macAddress = MACAddress.create('AA:BB:CC:DD:EE:FF').value;
    const pollingConfig = PollingConfiguration.createDefault(
      deviceId,
      pollingConfigId
    ).value;

    const props: NetworkDeviceProps = {
      name: 'Router-Core-01',
      deviceType: NetworkDeviceType.createRouter(),
      status: NetworkDeviceStatus.createOnline(),
      description: 'Main core router',
      ipAddress,
      macAddress,
      connectivityType: ConnectivityType.createEthernet(),
      managementProtocol: ManagementProtocol.createSnmp(),
      managementPort: 161,
      enabledRemoteAccess: false,
      deviceId: 'device-001',
      pollingConfiguration: pollingConfig,
      activationStatus: ActivationStatus.DRAFT,
      installDate: new Date(),
      createdAt: new Date(),
      updatedAt: new Date(),
      deletedAt: null,
      deletedBy: null,
      activatedAt: null,
      activatedBy: null,
      replacedByDeviceId: null,
      replacedAt: null
    };

    const device = NetworkDevice.create(props, deviceId).value;
    device.activate('test-user');
    return device;
  };

  // ========================================
  // Success Cases
  // ========================================

  describe('Success Cases', () => {
    it('should delete an ACTIVE device successfully', async () => {
      // Arrange
      const device = createMockActiveDevice();
      const request: DeleteNetworkDeviceDTO = {
        id: device.id.toString()
      };

      mockRepository.findById.mockResolvedValue(Result.ok(device));
      mockRepository.save.mockResolvedValue(Result.ok());
      mockRepository.delete.mockResolvedValue(Result.ok());

      // Act
      const result = await useCase.execute(request);

      // Assert
      expect(result.isSuccess).toBe(true);
      expect(mockRepository.delete).toHaveBeenCalledTimes(1);
    });

    it('should delete a DRAFT device successfully', async () => {
      // Arrange
      const deviceId = NetworkDeviceId.create().value;
      const ipAddress = IPAddress.create('192.168.1.101').value;
      const macAddress = MACAddress.create('BB:CC:DD:EE:FF:00').value;
      const pollingConfigId = PollingConfigurationId.create().value;
      const pollingConfig = PollingConfiguration.createDefault(
        deviceId,
        pollingConfigId
      ).value;

      const draftProps: NetworkDeviceProps = {
        name: 'unknown',
        deviceType: NetworkDeviceType.createUnknown(),
        status: NetworkDeviceStatus.createOffline(),
        description: null,
        ipAddress,
        macAddress,
        connectivityType: ConnectivityType.createEthernet(),
        managementProtocol: ManagementProtocol.createSnmp(),
        managementPort: 161,
        enabledRemoteAccess: false,
        deviceId: 'device-002',
        pollingConfiguration: pollingConfig,
        installDate: new Date(),
        createdAt: new Date(),
        updatedAt: new Date(),
        deletedAt: null,
        deletedBy: null,
        activatedAt: null,
        activatedBy: null,
        replacedByDeviceId: null,
        replacedAt: null,
        activationStatus: ActivationStatus.DRAFT
      };

      const draftDevice = NetworkDevice.create(
        draftProps,
        deviceId
      ).value;

      const request: DeleteNetworkDeviceDTO = {
        id: draftDevice.id.toString()
      };

      mockRepository.findById.mockResolvedValue(
        Result.ok(draftDevice)
      );
      mockRepository.save.mockResolvedValue(Result.ok());
      mockRepository.delete.mockResolvedValue(Result.ok());

      // Act
      const result = await useCase.execute(request);

      // Assert
      expect(result.isSuccess).toBe(true);
    });

    it('should call markForDeletion before deleting', async () => {
      // Arrange
      const device = createMockActiveDevice();
      const markForDeletionSpy = jest.spyOn(
        device,
        'markForDeletion'
      );

      const request: DeleteNetworkDeviceDTO = {
        id: device.id.toString()
      };

      mockRepository.findById.mockResolvedValue(Result.ok(device));
      mockRepository.save.mockResolvedValue(Result.ok());
      mockRepository.delete.mockResolvedValue(Result.ok());

      // Act
      await useCase.execute(request);

      // Assert
      expect(markForDeletionSpy).toHaveBeenCalledTimes(1);
    });

    it('should save device before deleting (to dispatch event)', async () => {
      // Arrange
      const device = createMockActiveDevice();
      const request: DeleteNetworkDeviceDTO = {
        id: device.id.toString()
      };

      mockRepository.findById.mockResolvedValue(Result.ok(device));
      mockRepository.save.mockResolvedValue(Result.ok());
      mockRepository.delete.mockResolvedValue(Result.ok());

      // Act
      await useCase.execute(request);

      // Assert
      expect(mockRepository.save).toHaveBeenCalledTimes(1);
      expect(mockRepository.delete).toHaveBeenCalledTimes(1);

      // Verify save was called before delete
      const saveCallOrder =
        mockRepository.save.mock.invocationCallOrder[0];
      const deleteCallOrder =
        mockRepository.delete.mock.invocationCallOrder[0];
      expect(saveCallOrder).toBeLessThan(deleteCallOrder);
    });

    it('should call repository.delete with correct device ID', async () => {
      // Arrange
      const device = createMockActiveDevice();
      const request: DeleteNetworkDeviceDTO = {
        id: device.id.toString()
      };

      mockRepository.findById.mockResolvedValue(Result.ok(device));
      mockRepository.save.mockResolvedValue(Result.ok());
      mockRepository.delete.mockResolvedValue(Result.ok());

      // Act
      await useCase.execute(request);

      // Assert
      expect(mockRepository.delete).toHaveBeenCalledTimes(1);
      const calledWithId = mockRepository.delete.mock.calls[0][0];
      expect(calledWithId).toBeInstanceOf(NetworkDeviceId);
      expect(calledWithId.toString()).toBe(device.id.toString());
    });

    it('should fail when deleting soft-deleted device', async () => {
      // Arrange
      const device = createMockActiveDevice();
      device.markForDeletion('test-user');

      const request: DeleteNetworkDeviceDTO = {
        id: device.id.toString()
      };

      mockRepository.findById.mockResolvedValue(Result.ok(device));
      mockRepository.save.mockResolvedValue(Result.ok());
      mockRepository.delete.mockResolvedValue(Result.ok());

      // Act
      const result = await useCase.execute(request);

      // Assert
      expect(result.isSuccess).toBe(false);
    });
  });

  // ========================================
  // Input Validation Tests
  // ========================================

  describe('Input Validation', () => {
    it('should fail when device ID is invalid', async () => {
      // Arrange
      const request: DeleteNetworkDeviceDTO = {
        id: 'invalid-uuid'
      };

      // Act
      const result = await useCase.execute(request);

      // Assert
      expect(result.isFailure).toBe(true);
      expect(result.error).toContain('Invalid device ID');
      expect(mockRepository.findById).not.toHaveBeenCalled();
    });

    it('should fail when device ID is empty', async () => {
      // Arrange
      const request: DeleteNetworkDeviceDTO = {
        id: ''
      };

      // Act
      const result = await useCase.execute(request);

      // Assert
      expect(result.isFailure).toBe(true);
      expect(result.error).toContain('Device ID is required');
    });
  });

  // ========================================
  // Business Rules Tests
  // ========================================

  describe('Business Rules', () => {
    it('should fail when device does not exist', async () => {
      // Arrange
      const request: DeleteNetworkDeviceDTO = {
        id: NetworkDeviceId.create().value.toString()
      };

      mockRepository.findById.mockResolvedValue(Result.ok(null));

      // Act
      const result = await useCase.execute(request);

      // Assert
      expect(result.isFailure).toBe(true);
      expect(result.error).toContain('not found');
      expect(mockRepository.delete).not.toHaveBeenCalled();
    });
  });

  // ========================================
  // Repository Interaction Tests
  // ========================================

  describe('Repository Interactions', () => {
    it('should load device by ID', async () => {
      // Arrange
      const device = createMockActiveDevice();
      const request: DeleteNetworkDeviceDTO = {
        id: device.id.toString()
      };

      mockRepository.findById.mockResolvedValue(Result.ok(device));
      mockRepository.save.mockResolvedValue(Result.ok());
      mockRepository.delete.mockResolvedValue(Result.ok());

      // Act
      await useCase.execute(request);

      // Assert
      expect(mockRepository.findById).toHaveBeenCalledTimes(1);
      const calledWithId = mockRepository.findById.mock.calls[0][0];
      expect(calledWithId).toBeInstanceOf(NetworkDeviceId);
    });

    it('should handle repository findById error', async () => {
      // Arrange
      const request: DeleteNetworkDeviceDTO = {
        id: NetworkDeviceId.create().value.toString()
      };

      mockRepository.findById.mockResolvedValue(
        Result.fail('Database connection error')
      );

      // Act
      const result = await useCase.execute(request);

      // Assert
      expect(result.isFailure).toBe(true);
      expect(result.error).toContain('Database connection error');
      expect(mockRepository.delete).not.toHaveBeenCalled();
    });

    it('should handle repository save error (event dispatch)', async () => {
      // Arrange
      const device = createMockActiveDevice();
      const request: DeleteNetworkDeviceDTO = {
        id: device.id.toString()
      };

      mockRepository.findById.mockResolvedValue(Result.ok(device));
      mockRepository.save.mockResolvedValue(
        Result.fail('Event dispatch error')
      );

      // Act
      const result = await useCase.execute(request);

      // Assert
      expect(result.isFailure).toBe(true);
      expect(mockRepository.delete).not.toHaveBeenCalled();
    });

    it('should handle repository delete error', async () => {
      // Arrange
      const device = createMockActiveDevice();
      const request: DeleteNetworkDeviceDTO = {
        id: device.id.toString()
      };

      mockRepository.findById.mockResolvedValue(Result.ok(device));
      mockRepository.save.mockResolvedValue(Result.ok());
      mockRepository.delete.mockResolvedValue(
        Result.fail('Foreign key constraint error')
      );

      // Act
      const result = await useCase.execute(request);

      // Assert
      expect(result.isFailure).toBe(true);
      expect(result.error).toContain('Foreign key constraint error');
    });
  });

  // ========================================
  // Logging Tests
  // ========================================

  describe('Logging', () => {
    it('should log deletion as warning', async () => {
      // Arrange
      const device = createMockActiveDevice();
      const request: DeleteNetworkDeviceDTO = {
        id: device.id.toString()
      };

      mockRepository.findById.mockResolvedValue(Result.ok(device));
      mockRepository.save.mockResolvedValue(Result.ok());
      mockRepository.delete.mockResolvedValue(Result.ok());

      // Act
      await useCase.execute(request);

      // Assert
      expect(mockLogger.warn).toHaveBeenCalled();
      expect(mockLogger.warn.mock.calls[0][0]).toContain(
        'Permanently deleting network device'
      );
    });
  });

  // ========================================
  // Edge Cases Tests
  // ========================================

  describe('Edge Cases', () => {
    it('should handle deletion of device with special characters in name', async () => {
      // Arrange
      const device = createMockActiveDevice();
      device.updateName('Router (Core) - "Main" [Active]');

      const request: DeleteNetworkDeviceDTO = {
        id: device.id.toString()
      };

      mockRepository.findById.mockResolvedValue(Result.ok(device));
      mockRepository.save.mockResolvedValue(Result.ok());
      mockRepository.delete.mockResolvedValue(Result.ok());

      // Act
      const result = await useCase.execute(request);

      // Assert
      expect(result.isSuccess).toBe(true);
    });

    it('should handle deletion when markForDeletion returns error', async () => {
      // Arrange
      const device = createMockActiveDevice();
      jest
        .spyOn(device, 'markForDeletion')
        .mockReturnValue(Result.fail('Deletion not allowed'));

      const request: DeleteNetworkDeviceDTO = {
        id: device.id.toString()
      };

      mockRepository.findById.mockResolvedValue(Result.ok(device));

      // Act
      const result = await useCase.execute(request);

      // Assert
      expect(result.isFailure).toBe(true);
      expect(result.error).toBe('Deletion not allowed');
      expect(mockRepository.delete).not.toHaveBeenCalled();
    });
  });

  // ========================================
  // Integration Tests
  // ========================================

  describe('Integration Tests', () => {
    it('should complete full deletion workflow', async () => {
      // Arrange
      const device = createMockActiveDevice();
      const request: DeleteNetworkDeviceDTO = {
        id: device.id.toString()
      };

      mockRepository.findById.mockResolvedValue(Result.ok(device));
      mockRepository.save.mockResolvedValue(Result.ok());
      mockRepository.delete.mockResolvedValue(Result.ok());

      // Act
      const result = await useCase.execute(request);

      // Assert - Verify complete workflow
      expect(result.isSuccess).toBe(true);
      expect(mockRepository.findById).toHaveBeenCalledTimes(1);
      expect(mockRepository.save).toHaveBeenCalledTimes(1);
      expect(mockRepository.delete).toHaveBeenCalledTimes(1);
      expect(mockLogger.warn).toHaveBeenCalled();
    });
  });
});
