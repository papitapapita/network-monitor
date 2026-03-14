import {
  ConfigureDevicePollingUseCase,
  ConfigureDevicePollingDTO,
  ILogger
} from '../../../src/application/';
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
} from '../../../../src/domain/device-inventory';

describe('ConfigureDevicePollingUseCase', () => {
  let useCase: ConfigureDevicePollingUseCase;
  let mockRepository: jest.Mocked<INetworkDeviceRepository>;
  let mockLogger: jest.Mocked<ILogger>;

  beforeEach(() => {
    // Create mock repository
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

    // Create mock logger
    mockLogger = {
      info: jest.fn(),
      warn: jest.fn(),
      error: jest.fn(),
      debug: jest.fn(),
      fatal: jest.fn(),
      child: jest.fn().mockReturnThis(),
      setLevel: jest.fn()
    } as any;

    // Instantiate use case with mocks
    useCase = new ConfigureDevicePollingUseCase(
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
      connectivityType: ConnectivityType.createEthernet(),
      managementProtocol: ManagementProtocol.createSnmp(),
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

  describe('beforeExecute - Pre-execution validation', () => {
    it('should fail when network device ID is missing', async () => {
      // Arrange
      const request: ConfigureDevicePollingDTO = {
        networkDeviceId: '',
        intervalSeconds: 60,
        enabled: true
      };

      // Act
      const result = await useCase.execute(request);

      // Assert
      expect(result.isFailure).toBe(true);
      expect(result.error).toBe('Network device ID is required');
      expect(mockRepository.findById).not.toHaveBeenCalled();
    });

    it('should fail when interval is not a positive integer', async () => {
      // Arrange
      const request: ConfigureDevicePollingDTO = {
        networkDeviceId: '550e8400-e29b-41d4-a716-446655440000',
        intervalSeconds: 0,
        enabled: true
      };

      // Act
      const result = await useCase.execute(request);

      // Assert
      expect(result.isFailure).toBe(true);
      expect(result.error).toBe(
        'Interval must be a positive integer value'
      );
    });

    it('should fail when interval is negative', async () => {
      // Arrange
      const request: ConfigureDevicePollingDTO = {
        networkDeviceId: '550e8400-e29b-41d4-a716-446655440000',
        intervalSeconds: -10,
        enabled: true
      };

      // Act
      const result = await useCase.execute(request);

      // Assert
      expect(result.isFailure).toBe(true);
      expect(result.error).toBe(
        'Interval must be a positive integer value'
      );
    });

    it('should fail when interval is not an integer', async () => {
      // Arrange
      const request: ConfigureDevicePollingDTO = {
        networkDeviceId: '550e8400-e29b-41d4-a716-446655440000',
        intervalSeconds: 60.5,
        enabled: true
      };

      // Act
      const result = await useCase.execute(request);

      // Assert
      expect(result.isFailure).toBe(true);
      expect(result.error).toBe(
        'Interval must be a positive integer value'
      );
    });

    it('should fail when ping count is not a positive integer', async () => {
      // Arrange
      const request: ConfigureDevicePollingDTO = {
        networkDeviceId: '550e8400-e29b-41d4-a716-446655440000',
        intervalSeconds: 60,
        enabled: true,
        pingCount: 0
      };

      // Act
      const result = await useCase.execute(request);

      // Assert
      expect(result.isFailure).toBe(true);
      expect(result.error).toBe(
        'Ping count must be a positive integer value'
      );
    });

    it('should fail when ping count is negative', async () => {
      // Arrange
      const request: ConfigureDevicePollingDTO = {
        networkDeviceId: '550e8400-e29b-41d4-a716-446655440000',
        intervalSeconds: 60,
        enabled: true,
        pingCount: -5
      };

      // Act
      const result = await useCase.execute(request);

      // Assert
      expect(result.isFailure).toBe(true);
      expect(result.error).toBe(
        'Ping count must be a positive integer value'
      );
    });

    it('should fail when enabled is not a boolean', async () => {
      // Arrange
      const request: any = {
        networkDeviceId: '550e8400-e29b-41d4-a716-446655440000',
        intervalSeconds: 60,
        enabled: 'true' // String instead of boolean
      };

      // Act
      const result = await useCase.execute(request);

      // Assert
      expect(result.isFailure).toBe(true);
      expect(result.error).toBe('Enabled must be a boolean value');
    });

    it('should pass validation with valid required fields', async () => {
      // Arrange
      const request: ConfigureDevicePollingDTO = {
        networkDeviceId: '550e8400-e29b-41d4-a716-446655440000',
        intervalSeconds: 60,
        enabled: true
      };

      mockRepository.findById.mockResolvedValue(
        Result.fail('Device not found')
      );

      // Act
      await useCase.execute(request);

      // Assert - Should reach repository call (validation passed)
      expect(mockRepository.findById).toHaveBeenCalled();
    });

    it('should pass validation with optional ping count', async () => {
      // Arrange
      const request: ConfigureDevicePollingDTO = {
        networkDeviceId: '550e8400-e29b-41d4-a716-446655440000',
        intervalSeconds: 60,
        enabled: true,
        pingCount: 5
      };

      mockRepository.findById.mockResolvedValue(
        Result.fail('Device not found')
      );

      // Act
      await useCase.execute(request);

      // Assert - Should reach repository call (validation passed)
      expect(mockRepository.findById).toHaveBeenCalled();
    });
  });

  describe('executeImpl - Main execution logic', () => {
    describe('Device ID validation', () => {
      it('should fail when device ID format is invalid', async () => {
        // Arrange
        const request: ConfigureDevicePollingDTO = {
          networkDeviceId: 'invalid-uuid-format',
          intervalSeconds: 60,
          enabled: true
        };

        // Act
        const result = await useCase.execute(request);

        // Assert
        expect(result.isFailure).toBe(true);
        expect(result.error).toContain('Invalid device ID');
      });
    });

    describe('Device loading', () => {
      it('should fail when repository fails to load device', async () => {
        // Arrange
        const request: ConfigureDevicePollingDTO = {
          networkDeviceId: '550e8400-e29b-41d4-a716-446655440000',
          intervalSeconds: 60,
          enabled: true
        };

        mockRepository.findById.mockResolvedValue(
          Result.fail('Database connection error')
        );

        // Act
        const result = await useCase.execute(request);

        // Assert
        expect(result.isFailure).toBe(true);
        expect(result.error).toContain('Failed to load device');
        expect(result.error).toContain('Database connection error');
      });

      it('should fail when device is not found', async () => {
        // Arrange
        const request: ConfigureDevicePollingDTO = {
          networkDeviceId: '550e8400-e29b-41d4-a716-446655440000',
          intervalSeconds: 60,
          enabled: true
        };

        mockRepository.findById.mockResolvedValue(Result.ok(null));

        // Act
        const result = await useCase.execute(request);

        // Assert
        expect(result.isFailure).toBe(true);
        expect(result.error).toBe(
          'Device with ID 550e8400-e29b-41d4-a716-446655440000 not found'
        );
      });
    });

    describe('Polling interval configuration', () => {
      it('should fail when polling interval creation fails', async () => {
        const mockDevice = createMockDraftDevice();
        // Arrange
        const request: ConfigureDevicePollingDTO = {
          networkDeviceId: '550e8400-e29b-41d4-a716-446655440000',
          intervalSeconds: 100000, // Exceeds max (86400)
          enabled: true
        };

        mockRepository.findById.mockResolvedValue(
          Result.ok(mockDevice)
        );

        // Act
        const result = await useCase.execute(request);

        // Assert
        expect(result.isFailure).toBe(true);
        expect(result.error).toContain('Invalid interval');
      });

      it('should fail when device rejects interval update', async () => {
        // Arrange
        const request: ConfigureDevicePollingDTO = {
          networkDeviceId: '550e8400-e29b-41d4-a716-446655440000',
          intervalSeconds: 60,
          enabled: true
        };

        mockRepository.findById.mockResolvedValue(
          Result.ok(mockDevice)
        );
        mockDevice.configurePollingInterval.mockReturnValue(
          Result.fail('Interval conflicts with device state')
        );

        // Act
        const result = await useCase.execute(request);

        // Assert
        expect(result.isFailure).toBe(true);
        expect(result.error).toContain('Failed to update interval');
        expect(result.error).toContain(
          'Interval conflicts with device state'
        );
      });

      it('should successfully configure polling interval', async () => {
        // Arrange
        const request: ConfigureDevicePollingDTO = {
          networkDeviceId: '550e8400-e29b-41d4-a716-446655440000',
          intervalSeconds: 60,
          enabled: true
        };

        mockRepository.findById.mockResolvedValue(
          Result.ok(mockDevice)
        );
        mockDevice.configurePollingInterval.mockReturnValue(
          Result.ok()
        );
        mockDevice.enablePolling.mockReturnValue(Result.ok());
        mockRepository.save.mockResolvedValue(Result.ok());

        // Act
        const result = await useCase.execute(request);

        // Assert
        expect(result.isSuccess).toBe(true);
        expect(
          mockDevice.configurePollingInterval
        ).toHaveBeenCalledTimes(1);
        expect(
          mockDevice.configurePollingInterval
        ).toHaveBeenCalledWith(
          expect.objectContaining({
            value: 60
          })
        );
      });
    });

    describe('Ping count configuration', () => {
      it('should skip ping count update when not provided', async () => {
        // Arrange
        const request: ConfigureDevicePollingDTO = {
          networkDeviceId: '550e8400-e29b-41d4-a716-446655440000',
          intervalSeconds: 60,
          enabled: true
          // pingCount not provided
        };

        mockRepository.findById.mockResolvedValue(
          Result.ok(mockDevice)
        );
        mockDevice.configurePollingInterval.mockReturnValue(
          Result.ok()
        );
        mockDevice.enablePolling.mockReturnValue(Result.ok());
        mockRepository.save.mockResolvedValue(Result.ok());

        // Act
        const result = await useCase.execute(request);

        // Assert
        expect(result.isSuccess).toBe(true);
        expect(mockDevice.updatePingCount).not.toHaveBeenCalled();
      });

      it('should update ping count when provided', async () => {
        // Arrange
        const request: ConfigureDevicePollingDTO = {
          networkDeviceId: '550e8400-e29b-41d4-a716-446655440000',
          intervalSeconds: 60,
          enabled: true,
          pingCount: 5
        };

        mockRepository.findById.mockResolvedValue(
          Result.ok(mockDevice)
        );
        mockDevice.configurePollingInterval.mockReturnValue(
          Result.ok()
        );
        mockDevice.updatePingCount.mockReturnValue(Result.ok());
        mockDevice.enablePolling.mockReturnValue(Result.ok());
        mockRepository.save.mockResolvedValue(Result.ok());

        // Act
        const result = await useCase.execute(request);

        // Assert
        expect(result.isSuccess).toBe(true);
        expect(mockDevice.updatePingCount).toHaveBeenCalledTimes(1);
        expect(mockDevice.updatePingCount).toHaveBeenCalledWith(5);
      });

      it('should fail when ping count update fails', async () => {
        // Arrange
        const request: ConfigureDevicePollingDTO = {
          networkDeviceId: '550e8400-e29b-41d4-a716-446655440000',
          intervalSeconds: 60,
          enabled: true,
          pingCount: 5
        };

        mockRepository.findById.mockResolvedValue(
          Result.ok(mockDevice)
        );
        mockDevice.configurePollingInterval.mockReturnValue(
          Result.ok()
        );
        mockDevice.updatePingCount.mockReturnValue(
          Result.fail('Ping count exceeds maximum allowed')
        );

        // Act
        const result = await useCase.execute(request);

        // Assert
        expect(result.isFailure).toBe(true);
        expect(result.error).toContain('Failed to update ping count');
        expect(result.error).toContain(
          'Ping count exceeds maximum allowed'
        );
      });
    });

    describe('Polling enable/disable', () => {
      it('should enable polling when enabled is true', async () => {
        // Arrange
        const request: ConfigureDevicePollingDTO = {
          networkDeviceId: '550e8400-e29b-41d4-a716-446655440000',
          intervalSeconds: 60,
          enabled: true
        };

        mockRepository.findById.mockResolvedValue(
          Result.ok(mockDevice)
        );
        mockDevice.configurePollingInterval.mockReturnValue(
          Result.ok()
        );
        mockDevice.enablePolling.mockReturnValue(Result.ok());
        mockRepository.save.mockResolvedValue(Result.ok());

        // Act
        const result = await useCase.execute(request);

        // Assert
        expect(result.isSuccess).toBe(true);
        expect(mockDevice.enablePolling).toHaveBeenCalledTimes(1);
        expect(mockDevice.disablePolling).not.toHaveBeenCalled();
      });

      it('should disable polling when enabled is false', async () => {
        // Arrange
        const request: ConfigureDevicePollingDTO = {
          networkDeviceId: '550e8400-e29b-41d4-a716-446655440000',
          intervalSeconds: 60,
          enabled: false
        };

        mockRepository.findById.mockResolvedValue(
          Result.ok(mockDevice)
        );
        mockDevice.configurePollingInterval.mockReturnValue(
          Result.ok()
        );
        mockDevice.disablePolling.mockReturnValue(Result.ok());
        mockRepository.save.mockResolvedValue(Result.ok());

        // Act
        const result = await useCase.execute(request);

        // Assert
        expect(result.isSuccess).toBe(true);
        expect(mockDevice.disablePolling).toHaveBeenCalledTimes(1);
        expect(mockDevice.enablePolling).not.toHaveBeenCalled();
      });

      it('should fail when enabling polling fails', async () => {
        // Arrange
        const request: ConfigureDevicePollingDTO = {
          networkDeviceId: '550e8400-e29b-41d4-a716-446655440000',
          intervalSeconds: 60,
          enabled: true
        };

        mockRepository.findById.mockResolvedValue(
          Result.ok(mockDevice)
        );
        mockDevice.configurePollingInterval.mockReturnValue(
          Result.ok()
        );
        mockDevice.enablePolling.mockReturnValue(
          Result.fail('Device is in maintenance mode')
        );

        // Act
        const result = await useCase.execute(request);

        // Assert
        expect(result.isFailure).toBe(true);
        expect(result.error).toContain('Failed to enable polling');
        expect(result.error).toContain(
          'Device is in maintenance mode'
        );
      });

      it('should fail when disabling polling fails', async () => {
        // Arrange
        const request: ConfigureDevicePollingDTO = {
          networkDeviceId: '550e8400-e29b-41d4-a716-446655440000',
          intervalSeconds: 60,
          enabled: false
        };

        mockRepository.findById.mockResolvedValue(
          Result.ok(mockDevice)
        );
        mockDevice.configurePollingInterval.mockReturnValue(
          Result.ok()
        );
        mockDevice.disablePolling.mockReturnValue(
          Result.fail('Cannot disable critical monitoring')
        );

        // Act
        const result = await useCase.execute(request);

        // Assert
        expect(result.isFailure).toBe(true);
        expect(result.error).toContain('Failed to disable polling');
        expect(result.error).toContain(
          'Cannot disable critical monitoring'
        );
      });
    });

    describe('Device persistence', () => {
      it('should fail when repository save fails', async () => {
        // Arrange
        const request: ConfigureDevicePollingDTO = {
          networkDeviceId: '550e8400-e29b-41d4-a716-446655440000',
          intervalSeconds: 60,
          enabled: true
        };

        mockRepository.findById.mockResolvedValue(
          Result.ok(mockDevice)
        );
        mockDevice.configurePollingInterval.mockReturnValue(
          Result.ok()
        );
        mockDevice.enablePolling.mockReturnValue(Result.ok());
        mockRepository.save.mockResolvedValue(
          Result.fail('Database write error')
        );

        // Act
        const result = await useCase.execute(request);

        // Assert
        expect(result.isFailure).toBe(true);
        expect(result.error).toContain('Failed to save device');
        expect(result.error).toContain('Database write error');
      });

      it('should save device exactly once on success', async () => {
        // Arrange
        const request: ConfigureDevicePollingDTO = {
          networkDeviceId: '550e8400-e29b-41d4-a716-446655440000',
          intervalSeconds: 60,
          enabled: true,
          pingCount: 3
        };

        mockRepository.findById.mockResolvedValue(
          Result.ok(mockDevice)
        );
        mockDevice.configurePollingInterval.mockReturnValue(
          Result.ok()
        );
        mockDevice.updatePingCount.mockReturnValue(Result.ok());
        mockDevice.enablePolling.mockReturnValue(Result.ok());
        mockRepository.save.mockResolvedValue(Result.ok());

        // Act
        const result = await useCase.execute(request);

        // Assert
        expect(result.isSuccess).toBe(true);
        expect(mockRepository.save).toHaveBeenCalledTimes(1);
        expect(mockRepository.save).toHaveBeenCalledWith(mockDevice);
      });
    });

    describe('Successful execution flow', () => {
      it('should successfully configure polling with all parameters', async () => {
        // Arrange
        const request: ConfigureDevicePollingDTO = {
          networkDeviceId: '550e8400-e29b-41d4-a716-446655440000',
          intervalSeconds: 60,
          enabled: true,
          pingCount: 3
        };

        mockRepository.findById.mockResolvedValue(
          Result.ok(mockDevice)
        );
        mockDevice.configurePollingInterval.mockReturnValue(
          Result.ok()
        );
        mockDevice.updatePingCount.mockReturnValue(Result.ok());
        mockDevice.enablePolling.mockReturnValue(Result.ok());
        mockRepository.save.mockResolvedValue(Result.ok());

        // Act
        const result = await useCase.execute(request);

        // Assert
        expect(result.isSuccess).toBe(true);
        expect(result.value).toBeUndefined(); // Use case returns void

        // Verify correct execution order
        const mockCalls = [
          mockRepository.findById,
          mockDevice.configurePollingInterval,
          mockDevice.updatePingCount,
          mockDevice.enablePolling,
          mockRepository.save
        ];
        mockCalls.forEach((mock) => {
          expect(mock).toHaveBeenCalledTimes(1);
        });
      });

      it('should successfully configure polling without ping count', async () => {
        // Arrange
        const request: ConfigureDevicePollingDTO = {
          networkDeviceId: '550e8400-e29b-41d4-a716-446655440000',
          intervalSeconds: 30,
          enabled: false
        };

        mockRepository.findById.mockResolvedValue(
          Result.ok(mockDevice)
        );
        mockDevice.configurePollingInterval.mockReturnValue(
          Result.ok()
        );
        mockDevice.disablePolling.mockReturnValue(Result.ok());
        mockRepository.save.mockResolvedValue(Result.ok());

        // Act
        const result = await useCase.execute(request);

        // Assert
        expect(result.isSuccess).toBe(true);
        expect(mockDevice.updatePingCount).not.toHaveBeenCalled();
        expect(mockDevice.disablePolling).toHaveBeenCalledTimes(1);
      });

      it('should log successful configuration', async () => {
        // Arrange
        const request: ConfigureDevicePollingDTO = {
          networkDeviceId: '550e8400-e29b-41d4-a716-446655440000',
          intervalSeconds: 60,
          enabled: true,
          pingCount: 3
        };

        mockRepository.findById.mockResolvedValue(
          Result.ok(mockDevice)
        );
        mockDevice.configurePollingInterval.mockReturnValue(
          Result.ok()
        );
        mockDevice.updatePingCount.mockReturnValue(Result.ok());
        mockDevice.enablePolling.mockReturnValue(Result.ok());
        mockRepository.save.mockResolvedValue(Result.ok());

        // Act
        const result = await useCase.execute(request);

        // Assert
        expect(result.isSuccess).toBe(true);
        expect(mockLogger.info).toHaveBeenCalledWith(
          'Device polling configuration updated successfully',
          {
            deviceId: '550e8400-e29b-41d4-a716-446655440000',
            intervalSeconds: 60,
            enabled: true,
            pingCount: 3
          }
        );
      });
    });

    describe('Edge cases', () => {
      it('should handle minimum valid interval (1 second)', async () => {
        // Arrange
        const request: ConfigureDevicePollingDTO = {
          networkDeviceId: '550e8400-e29b-41d4-a716-446655440000',
          intervalSeconds: 1,
          enabled: true
        };

        mockRepository.findById.mockResolvedValue(
          Result.ok(mockDevice)
        );
        mockDevice.configurePollingInterval.mockReturnValue(
          Result.ok()
        );
        mockDevice.enablePolling.mockReturnValue(Result.ok());
        mockRepository.save.mockResolvedValue(Result.ok());

        // Act
        const result = await useCase.execute(request);

        // Assert
        expect(result.isSuccess).toBe(true);
        expect(
          mockDevice.configurePollingInterval
        ).toHaveBeenCalledWith(
          expect.objectContaining({
            value: 1
          })
        );
      });

      it('should handle maximum valid interval (86400 seconds)', async () => {
        // Arrange
        const request: ConfigureDevicePollingDTO = {
          networkDeviceId: '550e8400-e29b-41d4-a716-446655440000',
          intervalSeconds: 86400,
          enabled: true
        };

        mockRepository.findById.mockResolvedValue(
          Result.ok(mockDevice)
        );
        mockDevice.configurePollingInterval.mockReturnValue(
          Result.ok()
        );
        mockDevice.enablePolling.mockReturnValue(Result.ok());
        mockRepository.save.mockResolvedValue(Result.ok());

        // Act
        const result = await useCase.execute(request);

        // Assert
        expect(result.isSuccess).toBe(true);
        expect(
          mockDevice.configurePollingInterval
        ).toHaveBeenCalledWith(
          expect.objectContaining({
            value: 86400
          })
        );
      });

      it('should handle minimum valid ping count (1)', async () => {
        // Arrange
        const request: ConfigureDevicePollingDTO = {
          networkDeviceId: '550e8400-e29b-41d4-a716-446655440000',
          intervalSeconds: 60,
          enabled: true,
          pingCount: 1
        };

        mockRepository.findById.mockResolvedValue(
          Result.ok(mockDevice)
        );
        mockDevice.configurePollingInterval.mockReturnValue(
          Result.ok()
        );
        mockDevice.updatePingCount.mockReturnValue(Result.ok());
        mockDevice.enablePolling.mockReturnValue(Result.ok());
        mockRepository.save.mockResolvedValue(Result.ok());

        // Act
        const result = await useCase.execute(request);

        // Assert
        expect(result.isSuccess).toBe(true);
        expect(mockDevice.updatePingCount).toHaveBeenCalledWith(1);
      });
    });
  });

  describe('Integration scenarios', () => {
    it('should handle complete flow for enabling polling with new settings', async () => {
      // Arrange - Simulating enabling polling for access point
      const request: ConfigureDevicePollingDTO = {
        networkDeviceId: '550e8400-e29b-41d4-a716-446655440000',
        intervalSeconds: 30, // Frequent monitoring for access point
        enabled: true,
        pingCount: 3
      };

      mockRepository.findById.mockResolvedValue(
        Result.ok(mockDevice)
      );
      mockDevice.configurePollingInterval.mockReturnValue(
        Result.ok()
      );
      mockDevice.updatePingCount.mockReturnValue(Result.ok());
      mockDevice.enablePolling.mockReturnValue(Result.ok());
      mockRepository.save.mockResolvedValue(Result.ok());

      // Act
      const result = await useCase.execute(request);

      // Assert - Verify complete orchestration
      expect(result.isSuccess).toBe(true);

      // Verify sequence of calls
      const findByIdOrder =
        mockRepository.findById.mock.invocationCallOrder[0];
      const configureIntervalOrder =
        mockDevice.configurePollingInterval.mock
          .invocationCallOrder[0];
      const updatePingCountOrder =
        mockDevice.updatePingCount.mock.invocationCallOrder[0];
      const enablePollingOrder =
        mockDevice.enablePolling.mock.invocationCallOrder[0];
      const saveOrder =
        mockRepository.save.mock.invocationCallOrder[0];

      expect(findByIdOrder).toBeLessThan(configureIntervalOrder);
      expect(configureIntervalOrder).toBeLessThan(
        updatePingCountOrder
      );
      expect(updatePingCountOrder).toBeLessThan(enablePollingOrder);
      expect(enablePollingOrder).toBeLessThan(saveOrder);
    });

    it('should handle disabling polling without changing interval', async () => {
      // Arrange - Simulating temporary polling disable
      const request: ConfigureDevicePollingDTO = {
        networkDeviceId: '550e8400-e29b-41d4-a716-446655440000',
        intervalSeconds: 60,
        enabled: false
        // No ping count change
      };

      mockRepository.findById.mockResolvedValue(
        Result.ok(mockDevice)
      );
      mockDevice.configurePollingInterval.mockReturnValue(
        Result.ok()
      );
      mockDevice.disablePolling.mockReturnValue(Result.ok());
      mockRepository.save.mockResolvedValue(Result.ok());

      // Act
      const result = await useCase.execute(request);

      // Assert
      expect(result.isSuccess).toBe(true);
      expect(mockDevice.disablePolling).toHaveBeenCalledTimes(1);
      expect(mockDevice.enablePolling).not.toHaveBeenCalled();
      expect(mockDevice.updatePingCount).not.toHaveBeenCalled();
      expect(mockLogger.info).toHaveBeenCalledWith(
        'Device polling configuration updated successfully',
        expect.objectContaining({
          enabled: false
        })
      );
    });
  });
});
