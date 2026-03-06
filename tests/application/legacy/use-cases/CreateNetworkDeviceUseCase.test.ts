import { CreateNetworkDeviceUseCase } from '../../../src/application/device-inventory/use-cases/CreateNetworkDeviceUseCase';
import {
  Result,
  NetworkDevice,
  IPAddress,
  MACAddress,
  ActivationStatus,
  INetworkDeviceRepository
} from '../../../../src/domain/device-inventory';
import { ILogger } from '../../../../src/application/shared/interfaces/ILogger';
import { CreateNetworkDeviceDTO } from '../../../../src/application/device-inventory/dtos';

describe('CreateNetworkDeviceUseCase', () => {
  // ========================================
  // Mocks
  // ========================================

  let useCase: CreateNetworkDeviceUseCase;
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

    useCase = new CreateNetworkDeviceUseCase(
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

  const createValidDraftDTO = (): CreateNetworkDeviceDTO => ({
    ipAddress: '192.168.1.100',
    macAddress: 'AA:BB:CC:DD:EE:FF',
    deviceId: 'device-001',
    activateImmediately: false
  });

  const createValidActiveDTO = (): CreateNetworkDeviceDTO => ({
    ipAddress: '192.168.1.100',
    macAddress: 'AA:BB:CC:DD:EE:FF',
    deviceId: 'device-001',
    name: 'Router-Core-01',
    deviceType: 'ROUTER',
    description: 'Main core router',
    connectivityType: 'ETHERNET',
    managementProtocol: 'SNMP',
    managementPort: 161,
    enabledRemoteAccess: false,
    activateImmediately: true
  });

  // ========================================
  // Success Cases - DRAFT Mode
  // ========================================

  describe('DRAFT Mode (activateImmediately = false)', () => {
    it('should create device in DRAFT status with minimal fields', async () => {
      // Arrange
      const dto = createValidDraftDTO();
      mockRepository.existsByIpAddress.mockResolvedValue(
        Result.ok(false)
      );
      mockRepository.existsByMacAddress.mockResolvedValue(
        Result.ok(false)
      );
      mockRepository.save.mockImplementation((device) =>
        Promise.resolve(Result.ok(device))
      );

      // Act
      const result = await useCase.execute(dto);

      // Assert
      expect(result.isSuccess).toBe(true);
      expect(result.value).toBeDefined();
      expect(result.value.ipAddress).toBe('192.168.1.100');
      expect(result.value.macAddress).toBe('AA:BB:CC:DD:EE:FF');
      expect(result.value.activationStatus).toBe(
        ActivationStatus.DRAFT
      );
      expect(result.value.activatedAt).toBeNull();
      expect(result.value.activatedBy).toBeNull();
    });

    it('should allow DRAFT creation without name (defaults to unknown)', async () => {
      // Arrange
      const dto = createValidDraftDTO();
      mockRepository.existsByIpAddress.mockResolvedValue(
        Result.ok(false)
      );
      mockRepository.existsByMacAddress.mockResolvedValue(
        Result.ok(false)
      );
      mockRepository.save.mockImplementation((device) =>
        Promise.resolve(Result.ok(device))
      );

      // Act
      const result = await useCase.execute(dto);

      // Assert
      expect(result.isSuccess).toBe(true);
      expect(result.value.name).toBe('unknown');
    });

    it('should allow DRAFT creation without deviceType (defaults to UNKNOWN)', async () => {
      // Arrange
      const dto = createValidDraftDTO();
      mockRepository.existsByIpAddress.mockResolvedValue(
        Result.ok(false)
      );
      mockRepository.existsByMacAddress.mockResolvedValue(
        Result.ok(false)
      );
      mockRepository.save.mockImplementation((device) =>
        Promise.resolve(Result.ok(device))
      );

      // Act
      const result = await useCase.execute(dto);

      // Assert
      expect(result.isSuccess).toBe(true);
      expect(result.value.deviceType).toBe('UNKNOWN');
    });

    it('should apply default values for optional fields in DRAFT mode', async () => {
      // Arrange
      const dto = createValidDraftDTO();
      mockRepository.existsByIpAddress.mockResolvedValue(
        Result.ok(false)
      );
      mockRepository.existsByMacAddress.mockResolvedValue(
        Result.ok(false)
      );
      mockRepository.save.mockImplementation((device) =>
        Promise.resolve(Result.ok(device))
      );

      // Act
      const result = await useCase.execute(dto);

      // Assert
      expect(result.isSuccess).toBe(true);
      expect(result.value.description).toBeNull();
      expect(result.value.connectivityType).toBe('ETHERNET'); // Default
      expect(result.value.managementProtocol).toBe('ICMP'); // Default
      expect(result.value.managementPort).toBe(161); // Default SNMP port
      expect(result.value.enabledRemoteAccess).toBe(false); // Default
    });

    it('should set device status to OFFLINE by default', async () => {
      // Arrange
      const dto = createValidDraftDTO();
      mockRepository.existsByIpAddress.mockResolvedValue(
        Result.ok(false)
      );
      mockRepository.existsByMacAddress.mockResolvedValue(
        Result.ok(false)
      );
      mockRepository.save.mockImplementation((device) =>
        Promise.resolve(Result.ok(device))
      );

      // Act
      const result = await useCase.execute(dto);

      // Assert
      expect(result.isSuccess).toBe(true);
      expect(result.value.status).toBe('OFFLINE');
    });

    it('should create polling configuration with enabled = false', async () => {
      // Arrange
      const dto = createValidDraftDTO();
      mockRepository.existsByIpAddress.mockResolvedValue(
        Result.ok(false)
      );
      mockRepository.existsByMacAddress.mockResolvedValue(
        Result.ok(false)
      );
      mockRepository.save.mockImplementation((device) =>
        Promise.resolve(Result.ok(device))
      );

      // Act
      const result = await useCase.execute(dto);

      // Assert
      expect(result.isSuccess).toBe(true);
      expect(result.value.pollingConfiguration).toBeDefined();
      expect(result.value.pollingConfiguration.enabled).toBe(false);
    });

    it('should set REQ-002 lifecycle fields to null for DRAFT', async () => {
      // Arrange
      const dto = createValidDraftDTO();
      mockRepository.existsByIpAddress.mockResolvedValue(
        Result.ok(false)
      );
      mockRepository.existsByMacAddress.mockResolvedValue(
        Result.ok(false)
      );
      mockRepository.save.mockImplementation((device) =>
        Promise.resolve(Result.ok(device))
      );

      // Act
      const result = await useCase.execute(dto);

      // Assert
      expect(result.isSuccess).toBe(true);
      expect(result.value.deletedAt).toBeNull();
      expect(result.value.deletedBy).toBeNull();
      expect(result.value.replacedByDeviceId).toBeNull();
      expect(result.value.replacedAt).toBeNull();
    });
  });

  // ========================================
  // Success Cases - ACTIVE Mode
  // ========================================

  describe('ACTIVE Mode (activateImmediately = true)', () => {
    it('should create device in ACTIVE status with full fields', async () => {
      // Arrange
      const dto = createValidActiveDTO();
      mockRepository.existsByIpAddress.mockResolvedValue(
        Result.ok(false)
      );
      mockRepository.existsByMacAddress.mockResolvedValue(
        Result.ok(false)
      );
      mockRepository.save.mockImplementation((device) =>
        Promise.resolve(Result.ok(device))
      );

      // Act
      const result = await useCase.execute(dto);
      if (result.isFailure) {
        throw new Error(`Test failed: ${result.error}`);
      }

      // Assert
      expect(result.isSuccess).toBe(true);
      expect(result.value).toBeDefined();
      expect(result.value.name).toBe('Router-Core-01');
      expect(result.value.deviceType).toBe('ROUTER');
      expect(result.value.activationStatus).toBe(
        ActivationStatus.ACTIVE
      );
      expect(result.value.activatedAt).not.toBeNull();
      expect(result.value.activatedBy).toBe('system:admin');
    });

    it('should require name when activateImmediately is true', async () => {
      // Arrange
      const dto: CreateNetworkDeviceDTO = {
        ...createValidActiveDTO(),
        name: undefined
      };
      mockRepository.existsByIpAddress.mockResolvedValue(
        Result.ok(false)
      );
      mockRepository.existsByMacAddress.mockResolvedValue(
        Result.ok(false)
      );

      // Act
      const result = await useCase.execute(dto);

      // Assert
      expect(result.isFailure).toBe(true);
      expect(result.error).toContain('name is required');
      expect(result.error).toContain('activateImmediately is true');
    });

    it('should require deviceType when activateImmediately is true', async () => {
      // Arrange
      const dto: CreateNetworkDeviceDTO = {
        ...createValidActiveDTO(),
        deviceType: undefined
      };
      mockRepository.existsByIpAddress.mockResolvedValue(
        Result.ok(false)
      );
      mockRepository.existsByMacAddress.mockResolvedValue(
        Result.ok(false)
      );

      // Act
      const result = await useCase.execute(dto);

      // Assert
      expect(result.isFailure).toBe(true);
      expect(result.error).toContain('Device type is required');
      expect(result.error).toContain('activateImmediately is true');
    });

    it('should reject empty name when activateImmediately is true', async () => {
      // Arrange
      const dto: CreateNetworkDeviceDTO = {
        ...createValidActiveDTO(),
        name: '   ' // Whitespace only
      };
      mockRepository.existsByIpAddress.mockResolvedValue(
        Result.ok(false)
      );
      mockRepository.existsByMacAddress.mockResolvedValue(
        Result.ok(false)
      );

      // Act
      const result = await useCase.execute(dto);

      // Assert
      expect(result.isFailure).toBe(true);
      expect(result.error).toContain('name is required');
    });

    it('should use provided optional values in ACTIVE mode', async () => {
      // Arrange
      const dto = createValidActiveDTO();
      mockRepository.existsByIpAddress.mockResolvedValue(
        Result.ok(false)
      );
      mockRepository.existsByMacAddress.mockResolvedValue(
        Result.ok(false)
      );
      mockRepository.save.mockImplementation((device) =>
        Promise.resolve(Result.ok(device))
      );

      // Act
      const result = await useCase.execute(dto);

      // Assert
      expect(result.isSuccess).toBe(true);
      expect(result.value.description).toBe('Main core router');
      expect(result.value.connectivityType).toBe('ETHERNET');
      expect(result.value.managementProtocol).toBe('SNMP');
      expect(result.value.managementPort).toBe(161);
      expect(result.value.enabledRemoteAccess).toBe(false);
    });

    it('should set activatedAt timestamp when activating immediately', async () => {
      // Arrange
      const dto = createValidActiveDTO();
      mockRepository.existsByIpAddress.mockResolvedValue(
        Result.ok(false)
      );
      mockRepository.existsByMacAddress.mockResolvedValue(
        Result.ok(false)
      );
      mockRepository.save.mockImplementation((device) =>
        Promise.resolve(Result.ok(device))
      );

      // Act
      const result = await useCase.execute(dto);

      // Assert
      expect(result.isSuccess).toBe(true);
      expect(result.value.activatedAt).not.toBeNull();
      // activatedAt is ISO string in response
      expect(typeof result.value.activatedAt).toBe('string');
    });
  });

  // ========================================
  // Input Validation Tests
  // ========================================

  describe('Input Validation', () => {
    it('should fail when IP address is invalid', async () => {
      // Arrange
      const dto: CreateNetworkDeviceDTO = {
        ...createValidDraftDTO(),
        ipAddress: '999.999.999.999' // Invalid
      };

      // Act
      const result = await useCase.execute(dto);

      // Assert
      expect(result.isFailure).toBe(true);
      expect(result.error).toContain('Invalid IP address');
    });

    it('should fail when IP address is missing', async () => {
      // Arrange
      const dto: CreateNetworkDeviceDTO = {
        ...createValidDraftDTO(),
        ipAddress: undefined as any
      };

      // Act
      const result = await useCase.execute(dto);

      // Assert
      expect(result.isFailure).toBe(true);
      expect(result.error).toContain('IP address is required');
    });

    it('should fail when MAC address is invalid', async () => {
      // Arrange
      const dto: CreateNetworkDeviceDTO = {
        ...createValidDraftDTO(),
        macAddress: 'invalid-mac'
      };
      mockRepository.existsByIpAddress.mockResolvedValue(
        Result.ok(false)
      );

      // Act
      const result = await useCase.execute(dto);

      // Assert
      expect(result.isFailure).toBe(true);
      expect(result.error).toContain('Invalid MAC address');
    });

    it('should fail when MAC address is missing', async () => {
      // Arrange
      const dto: CreateNetworkDeviceDTO = {
        ...createValidDraftDTO(),
        macAddress: undefined as any
      };

      // Act
      const result = await useCase.execute(dto);

      // Assert
      expect(result.isFailure).toBe(true);
      expect(result.error).toContain('MAC address is required');
    });

    it('should fail when deviceId is missing', async () => {
      // Arrange
      const dto: CreateNetworkDeviceDTO = {
        ...createValidDraftDTO(),
        deviceId: undefined as any
      };
      mockRepository.existsByIpAddress.mockResolvedValue(
        Result.ok(false)
      );
      mockRepository.existsByMacAddress.mockResolvedValue(
        Result.ok(false)
      );

      // Act
      const result = await useCase.execute(dto);

      // Assert
      expect(result.isFailure).toBe(true);
      expect(result.error).toContain('Device ID is required');
    });

    it('should fail when installDate is invalid', async () => {
      // Arrange
      const dto: CreateNetworkDeviceDTO = {
        ...createValidDraftDTO(),
        installDate: 'invalid-date'
      };
      mockRepository.existsByIpAddress.mockResolvedValue(
        Result.ok(false)
      );
      mockRepository.existsByMacAddress.mockResolvedValue(
        Result.ok(false)
      );

      // Act
      const result = await useCase.execute(dto);

      // Assert
      expect(result.isFailure).toBe(true);
      expect(result.error).toContain('Invalid install date');
    });
  });

  // ========================================
  // Uniqueness Validation Tests
  // ========================================

  describe('Uniqueness Validation', () => {
    it('should fail when IP address already exists', async () => {
      // Arrange
      const dto = createValidDraftDTO();
      mockRepository.existsByIpAddress.mockResolvedValue(
        Result.ok(true) // Already exists
      );

      // Act
      const result = await useCase.execute(dto);

      // Assert
      expect(result.isFailure).toBe(true);
      expect(result.error).toContain('IP address');
      expect(result.error).toContain('already exists');
      expect(mockRepository.save).not.toHaveBeenCalled();
    });

    it('should fail when MAC address already exists', async () => {
      // Arrange
      const dto = createValidDraftDTO();
      mockRepository.existsByIpAddress.mockResolvedValue(
        Result.ok(false)
      );
      mockRepository.existsByMacAddress.mockResolvedValue(
        Result.ok(true) // Already exists
      );

      // Act
      const result = await useCase.execute(dto);

      // Assert
      expect(result.isFailure).toBe(true);
      expect(result.error).toContain('MAC address');
      expect(result.error).toContain('already exists');
      expect(mockRepository.save).not.toHaveBeenCalled();
    });

    it('should handle repository error when checking IP uniqueness', async () => {
      // Arrange
      const dto = createValidDraftDTO();
      mockRepository.existsByIpAddress.mockResolvedValue(
        Result.fail('Database connection error')
      );

      // Act
      const result = await useCase.execute(dto);

      // Assert
      expect(result.isFailure).toBe(true);
      expect(result.error).toContain('Error checking IP uniqueness');
      expect(mockRepository.save).not.toHaveBeenCalled();
    });

    it('should handle repository error when checking MAC uniqueness', async () => {
      // Arrange
      const dto = createValidDraftDTO();
      mockRepository.existsByIpAddress.mockResolvedValue(
        Result.ok(false)
      );
      mockRepository.existsByMacAddress.mockResolvedValue(
        Result.fail('Database connection error')
      );

      // Act
      const result = await useCase.execute(dto);

      // Assert
      expect(result.isFailure).toBe(true);
      expect(result.error).toContain('Error checking MAC uniqueness');
      expect(mockRepository.save).not.toHaveBeenCalled();
    });
  });

  // ========================================
  // Enum Mapping Tests
  // ========================================

  describe('Enum Mapping', () => {
    describe('deviceType mapping', () => {
      it('should map valid deviceType string to enum', async () => {
        // Arrange
        const dto: CreateNetworkDeviceDTO = {
          ...createValidActiveDTO(),
          deviceType: 'SWITCH'
        };
        mockRepository.existsByIpAddress.mockResolvedValue(
          Result.ok(false)
        );
        mockRepository.existsByMacAddress.mockResolvedValue(
          Result.ok(false)
        );
        mockRepository.save.mockImplementation((device) =>
          Promise.resolve(Result.ok(device))
        );

        // Act
        const result = await useCase.execute(dto);

        // Assert
        expect(result.isSuccess).toBe(true);
        expect(result.value.deviceType).toBe('SWITCH');
      });

      it('should handle case-insensitive deviceType', async () => {
        // Arrange
        const dto: CreateNetworkDeviceDTO = {
          ...createValidActiveDTO(),
          deviceType: 'router' // Lowercase
        };
        mockRepository.existsByIpAddress.mockResolvedValue(
          Result.ok(false)
        );
        mockRepository.existsByMacAddress.mockResolvedValue(
          Result.ok(false)
        );
        mockRepository.save.mockImplementation((device) =>
          Promise.resolve(Result.ok(device))
        );

        // Act
        const result = await useCase.execute(dto);

        // Assert
        expect(result.isSuccess).toBe(true);
        expect(result.value.deviceType).toBe('ROUTER');
      });

      it('should fallback to UNKNOWN for invalid deviceType', async () => {
        // Arrange
        const dto: CreateNetworkDeviceDTO = {
          ...createValidActiveDTO(),
          deviceType: 'INVALID_TYPE'
        };
        mockRepository.existsByIpAddress.mockResolvedValue(
          Result.ok(false)
        );
        mockRepository.existsByMacAddress.mockResolvedValue(
          Result.ok(false)
        );
        mockRepository.save.mockImplementation((device) =>
          Promise.resolve(Result.ok(device))
        );

        // Act
        const result = await useCase.execute(dto);

        // Assert
        expect(result.isSuccess).toBe(true);
        expect(result.value.deviceType).toBe('UNKNOWN');
      });

      it('should map AP alias to ACCESS_POINT', async () => {
        // Arrange
        const dto: CreateNetworkDeviceDTO = {
          ...createValidActiveDTO(),
          deviceType: 'AP'
        };
        mockRepository.existsByIpAddress.mockResolvedValue(
          Result.ok(false)
        );
        mockRepository.existsByMacAddress.mockResolvedValue(
          Result.ok(false)
        );
        mockRepository.save.mockImplementation((device) =>
          Promise.resolve(Result.ok(device))
        );

        // Act
        const result = await useCase.execute(dto);

        // Assert
        expect(result.isSuccess).toBe(true);
        expect(result.value.deviceType).toBe('ACCESS_POINT');
      });

      it.each([
        ['ROUTER', 'ROUTER'],
        ['SWITCH', 'SWITCH'],
        ['ACCESS_POINT', 'ACCESS_POINT'],
        ['STATION', 'STATION'],
        ['PTP_RADIO', 'PTP_RADIO'],
        ['PTMP_RADIO', 'PTMP_RADIO'],
        ['FIREWALL', 'FIREWALL'],
        ['SERVER', 'SERVER']
      ])(
        'should map %s to %s',
        async (input: string, expected: string) => {
          // Arrange
          const dto: CreateNetworkDeviceDTO = {
            ...createValidActiveDTO(),
            deviceType: input
          };
          mockRepository.existsByIpAddress.mockResolvedValue(
            Result.ok(false)
          );
          mockRepository.existsByMacAddress.mockResolvedValue(
            Result.ok(false)
          );
          mockRepository.save.mockImplementation((device) =>
            Promise.resolve(Result.ok(device))
          );

          // Act
          const result = await useCase.execute(dto);

          // Assert
          expect(result.isSuccess).toBe(true);
          expect(result.value.deviceType).toBe(expected);
        }
      );
    });

    describe('connectivityType mapping', () => {
      it('should map valid connectivityType string to enum', async () => {
        // Arrange
        const dto: CreateNetworkDeviceDTO = {
          ...createValidActiveDTO(),
          connectivityType: 'FIBER_OPTIC'
        };
        mockRepository.existsByIpAddress.mockResolvedValue(
          Result.ok(false)
        );
        mockRepository.existsByMacAddress.mockResolvedValue(
          Result.ok(false)
        );
        mockRepository.save.mockImplementation((device) =>
          Promise.resolve(Result.ok(device))
        );

        // Act
        const result = await useCase.execute(dto);

        // Assert
        expect(result.isSuccess).toBe(true);
        expect(result.value.connectivityType).toBe('FIBER_OPTIC');
      });

      it('should map FIBER alias to FIBER_OPTIC', async () => {
        // Arrange
        const dto: CreateNetworkDeviceDTO = {
          ...createValidActiveDTO(),
          connectivityType: 'FIBER'
        };
        mockRepository.existsByIpAddress.mockResolvedValue(
          Result.ok(false)
        );
        mockRepository.existsByMacAddress.mockResolvedValue(
          Result.ok(false)
        );
        mockRepository.save.mockImplementation((device) =>
          Promise.resolve(Result.ok(device))
        );

        // Act
        const result = await useCase.execute(dto);

        // Assert
        expect(result.isSuccess).toBe(true);
        expect(result.value.connectivityType).toBe('FIBER_OPTIC');
      });

      it('should map WIFI alias to WIRELESS', async () => {
        // Arrange
        const dto: CreateNetworkDeviceDTO = {
          ...createValidActiveDTO(),
          connectivityType: 'WIFI'
        };
        mockRepository.existsByIpAddress.mockResolvedValue(
          Result.ok(false)
        );
        mockRepository.existsByMacAddress.mockResolvedValue(
          Result.ok(false)
        );
        mockRepository.save.mockImplementation((device) =>
          Promise.resolve(Result.ok(device))
        );

        // Act
        const result = await useCase.execute(dto);

        // Assert
        expect(result.isSuccess).toBe(true);
        expect(result.value.connectivityType).toBe('WIRELESS');
      });

      it('should fallback to OTHER for invalid connectivityType', async () => {
        // Arrange
        const dto: CreateNetworkDeviceDTO = {
          ...createValidActiveDTO(),
          connectivityType: 'INVALID'
        };
        mockRepository.existsByIpAddress.mockResolvedValue(
          Result.ok(false)
        );
        mockRepository.existsByMacAddress.mockResolvedValue(
          Result.ok(false)
        );
        mockRepository.save.mockImplementation((device) =>
          Promise.resolve(Result.ok(device))
        );

        // Act
        const result = await useCase.execute(dto);

        // Assert
        expect(result.isSuccess).toBe(true);
        expect(result.value.connectivityType).toBe('OTHER');
      });
    });

    describe('managementProtocol mapping', () => {
      it('should map valid managementProtocol string to enum', async () => {
        // Arrange
        const dto: CreateNetworkDeviceDTO = {
          ...createValidActiveDTO(),
          managementProtocol: 'SSH'
        };
        mockRepository.existsByIpAddress.mockResolvedValue(
          Result.ok(false)
        );
        mockRepository.existsByMacAddress.mockResolvedValue(
          Result.ok(false)
        );
        mockRepository.save.mockImplementation((device) =>
          Promise.resolve(Result.ok(device))
        );

        // Act
        const result = await useCase.execute(dto);

        // Assert
        expect(result.isSuccess).toBe(true);
        expect(result.value.managementProtocol).toBe('SSH');
      });

      it('should fallback to OTHER for invalid managementProtocol', async () => {
        // Arrange
        const dto: CreateNetworkDeviceDTO = {
          ...createValidActiveDTO(),
          managementProtocol: 'INVALID'
        };
        mockRepository.existsByIpAddress.mockResolvedValue(
          Result.ok(false)
        );
        mockRepository.existsByMacAddress.mockResolvedValue(
          Result.ok(false)
        );
        mockRepository.save.mockImplementation((device) =>
          Promise.resolve(Result.ok(device))
        );

        // Act
        const result = await useCase.execute(dto);

        // Assert
        expect(result.isSuccess).toBe(true);
        expect(result.value.managementProtocol).toBe('OTHER');
      });

      it.each([
        ['SNMP', 'SNMP'],
        ['SSH', 'SSH'],
        ['TELNET', 'TELNET'],
        ['HTTP', 'HTTP'],
        ['HTTPS', 'HTTPS'],
        ['ICMP', 'ICMP']
      ])(
        'should map %s to %s',
        async (input: string, expected: string) => {
          // Arrange
          const dto: CreateNetworkDeviceDTO = {
            ...createValidActiveDTO(),
            managementProtocol: input
          };
          mockRepository.existsByIpAddress.mockResolvedValue(
            Result.ok(false)
          );
          mockRepository.existsByMacAddress.mockResolvedValue(
            Result.ok(false)
          );
          mockRepository.save.mockImplementation((device) =>
            Promise.resolve(Result.ok(device))
          );

          // Act
          const result = await useCase.execute(dto);

          // Assert
          expect(result.isSuccess).toBe(true);
          expect(result.value.managementProtocol).toBe(expected);
        }
      );
    });
  });

  // ========================================
  // Polling Configuration Tests
  // ========================================

  describe('Polling Configuration', () => {
    it('should set default polling interval for ACCESS_POINT (30s)', async () => {
      // Arrange
      const dto: CreateNetworkDeviceDTO = {
        ...createValidActiveDTO(),
        deviceType: 'ACCESS_POINT'
      };
      mockRepository.existsByIpAddress.mockResolvedValue(
        Result.ok(false)
      );
      mockRepository.existsByMacAddress.mockResolvedValue(
        Result.ok(false)
      );
      mockRepository.save.mockImplementation((device) =>
        Promise.resolve(Result.ok(device))
      );

      // Act
      const result = await useCase.execute(dto);

      // Assert
      expect(result.isSuccess).toBe(true);
      expect(result.value.pollingConfiguration.intervalSeconds).toBe(
        30
      );
    });

    it('should set default polling interval for STATION (300s)', async () => {
      // Arrange
      const dto: CreateNetworkDeviceDTO = {
        ...createValidActiveDTO(),
        deviceType: 'STATION'
      };
      mockRepository.existsByIpAddress.mockResolvedValue(
        Result.ok(false)
      );
      mockRepository.existsByMacAddress.mockResolvedValue(
        Result.ok(false)
      );
      mockRepository.save.mockImplementation((device) =>
        Promise.resolve(Result.ok(device))
      );

      // Act
      const result = await useCase.execute(dto);

      // Assert
      expect(result.isSuccess).toBe(true);
      expect(result.value.pollingConfiguration.intervalSeconds).toBe(
        300
      );
    });

    it('should set default polling interval for ROUTER (60s)', async () => {
      // Arrange
      const dto = createValidActiveDTO(); // ROUTER
      mockRepository.existsByIpAddress.mockResolvedValue(
        Result.ok(false)
      );
      mockRepository.existsByMacAddress.mockResolvedValue(
        Result.ok(false)
      );
      mockRepository.save.mockImplementation((device) =>
        Promise.resolve(Result.ok(device))
      );

      // Act
      const result = await useCase.execute(dto);

      // Assert
      expect(result.isSuccess).toBe(true);
      expect(result.value.pollingConfiguration.intervalSeconds).toBe(
        60
      );
    });

    it('should set default polling interval for SWITCH (60s)', async () => {
      // Arrange
      const dto: CreateNetworkDeviceDTO = {
        ...createValidActiveDTO(),
        deviceType: 'SWITCH'
      };
      mockRepository.existsByIpAddress.mockResolvedValue(
        Result.ok(false)
      );
      mockRepository.existsByMacAddress.mockResolvedValue(
        Result.ok(false)
      );
      mockRepository.save.mockImplementation((device) =>
        Promise.resolve(Result.ok(device))
      );

      // Act
      const result = await useCase.execute(dto);

      // Assert
      expect(result.isSuccess).toBe(true);
      expect(result.value.pollingConfiguration.intervalSeconds).toBe(
        60
      );
    });

    it('should set default polling interval for FIREWALL (60s)', async () => {
      // Arrange
      const dto: CreateNetworkDeviceDTO = {
        ...createValidActiveDTO(),
        deviceType: 'FIREWALL'
      };
      mockRepository.existsByIpAddress.mockResolvedValue(
        Result.ok(false)
      );
      mockRepository.existsByMacAddress.mockResolvedValue(
        Result.ok(false)
      );
      mockRepository.save.mockImplementation((device) =>
        Promise.resolve(Result.ok(device))
      );

      // Act
      const result = await useCase.execute(dto);

      // Assert
      expect(result.isSuccess).toBe(true);
      expect(result.value.pollingConfiguration.intervalSeconds).toBe(
        60
      );
    });

    it('should set default polling interval for UNKNOWN (60s)', async () => {
      // Arrange
      const dto = createValidDraftDTO(); // Will default to UNKNOWN
      mockRepository.existsByIpAddress.mockResolvedValue(
        Result.ok(false)
      );
      mockRepository.existsByMacAddress.mockResolvedValue(
        Result.ok(false)
      );
      mockRepository.save.mockImplementation((device) =>
        Promise.resolve(Result.ok(device))
      );

      // Act
      const result = await useCase.execute(dto);

      // Assert
      expect(result.isSuccess).toBe(true);
      expect(result.value.pollingConfiguration.intervalSeconds).toBe(
        60
      );
    });

    it('should include polling configuration with all fields', async () => {
      // Arrange
      const dto = createValidDraftDTO();
      mockRepository.existsByIpAddress.mockResolvedValue(
        Result.ok(false)
      );
      mockRepository.existsByMacAddress.mockResolvedValue(
        Result.ok(false)
      );
      mockRepository.save.mockImplementation((device) =>
        Promise.resolve(Result.ok(device))
      );

      // Act
      const result = await useCase.execute(dto);

      // Assert
      expect(result.isSuccess).toBe(true);
      const pollingConfig = result.value.pollingConfiguration;
      expect(pollingConfig.id).toBeDefined();
      expect(pollingConfig.networkDeviceId).toBeDefined();
      expect(pollingConfig.enabled).toBe(false);
      expect(pollingConfig.intervalSeconds).toBeDefined();
      expect(pollingConfig.pingCount).toBeDefined();
      expect(pollingConfig.retryPolicy).toBeDefined();
      expect(pollingConfig.retryPolicy.maxAttempts).toBeDefined();
      expect(pollingConfig.retryPolicy.baseDelayMs).toBeDefined();
    });
  });

  // ========================================
  // Repository Interaction Tests
  // ========================================

  describe('Repository Interactions', () => {
    it('should call repository.save() with created device', async () => {
      // Arrange
      const dto = createValidDraftDTO();
      mockRepository.existsByIpAddress.mockResolvedValue(
        Result.ok(false)
      );
      mockRepository.existsByMacAddress.mockResolvedValue(
        Result.ok(false)
      );
      mockRepository.save.mockImplementation((device) =>
        Promise.resolve(Result.ok(device))
      );

      // Act
      await useCase.execute(dto);

      // Assert
      expect(mockRepository.save).toHaveBeenCalledTimes(1);
      const savedDevice = mockRepository.save.mock.calls[0][0];
      expect(savedDevice).toBeInstanceOf(NetworkDevice);
      expect(savedDevice.ipAddress.toString()).toBe('192.168.1.100');
      expect(savedDevice.macAddress.toString()).toBe(
        'AA:BB:CC:DD:EE:FF'
      );
    });

    it('should handle repository save failure', async () => {
      // Arrange
      const dto = createValidDraftDTO();
      mockRepository.existsByIpAddress.mockResolvedValue(
        Result.ok(false)
      );
      mockRepository.existsByMacAddress.mockResolvedValue(
        Result.ok(false)
      );
      mockRepository.save.mockResolvedValue(
        Result.fail('Database write error')
      );

      // Act
      const result = await useCase.execute(dto);

      // Assert
      expect(result.isFailure).toBe(true);
      expect(result.error).toContain('Database write error');
    });

    it('should check IP uniqueness before MAC uniqueness', async () => {
      // Arrange
      const dto = createValidDraftDTO();
      const callOrder: string[] = [];

      mockRepository.existsByIpAddress.mockImplementation(() => {
        callOrder.push('ip');
        return Promise.resolve(Result.ok(false));
      });
      mockRepository.existsByMacAddress.mockImplementation(() => {
        callOrder.push('mac');
        return Promise.resolve(Result.ok(false));
      });
      mockRepository.save.mockImplementation((device) =>
        Promise.resolve(Result.ok(device))
      );

      // Act
      await useCase.execute(dto);

      // Assert
      expect(callOrder).toEqual(['ip', 'mac']);
    });

    it('should check IP uniqueness with correct IPAddress value object', async () => {
      // Arrange
      const dto = createValidDraftDTO();
      mockRepository.existsByIpAddress.mockResolvedValue(
        Result.ok(false)
      );
      mockRepository.existsByMacAddress.mockResolvedValue(
        Result.ok(false)
      );
      mockRepository.save.mockImplementation((device) =>
        Promise.resolve(Result.ok(device))
      );

      // Act
      await useCase.execute(dto);

      // Assert
      expect(mockRepository.existsByIpAddress).toHaveBeenCalledTimes(
        1
      );
      const calledWithIp =
        mockRepository.existsByIpAddress.mock.calls[0][0];
      expect(calledWithIp).toBeInstanceOf(IPAddress);
      expect(calledWithIp.toString()).toBe('192.168.1.100');
    });

    it('should check MAC uniqueness with correct MACAddress value object', async () => {
      // Arrange
      const dto = createValidDraftDTO();
      mockRepository.existsByIpAddress.mockResolvedValue(
        Result.ok(false)
      );
      mockRepository.existsByMacAddress.mockResolvedValue(
        Result.ok(false)
      );
      mockRepository.save.mockImplementation((device) =>
        Promise.resolve(Result.ok(device))
      );

      // Act
      await useCase.execute(dto);

      // Assert
      expect(mockRepository.existsByMacAddress).toHaveBeenCalledTimes(
        1
      );
      const calledWithMac =
        mockRepository.existsByMacAddress.mock.calls[0][0];
      expect(calledWithMac).toBeInstanceOf(MACAddress);
      expect(calledWithMac.toString()).toBe('AA:BB:CC:DD:EE:FF');
    });

    it('should not call save if IP uniqueness check fails', async () => {
      // Arrange
      const dto = createValidDraftDTO();
      mockRepository.existsByIpAddress.mockResolvedValue(
        Result.ok(true)
      );

      // Act
      await useCase.execute(dto);

      // Assert
      expect(mockRepository.save).not.toHaveBeenCalled();
      expect(
        mockRepository.existsByMacAddress
      ).not.toHaveBeenCalled();
    });

    it('should not call save if MAC uniqueness check fails', async () => {
      // Arrange
      const dto = createValidDraftDTO();
      mockRepository.existsByIpAddress.mockResolvedValue(
        Result.ok(false)
      );
      mockRepository.existsByMacAddress.mockResolvedValue(
        Result.ok(true)
      );

      // Act
      await useCase.execute(dto);

      // Assert
      expect(mockRepository.save).not.toHaveBeenCalled();
    });
  });

  // ========================================
  // Logging Tests
  // ========================================

  describe('Logging', () => {
    it('should log device creation', async () => {
      // Arrange
      const dto = createValidDraftDTO();
      mockRepository.existsByIpAddress.mockResolvedValue(
        Result.ok(false)
      );
      mockRepository.existsByMacAddress.mockResolvedValue(
        Result.ok(false)
      );
      mockRepository.save.mockImplementation((device) =>
        Promise.resolve(Result.ok(device))
      );

      // Act
      await useCase.execute(dto);

      // Assert
      expect(mockLogger.info).toHaveBeenCalled();
    });

    it('should log ping test when performPingTest is true', async () => {
      // Arrange
      const dto: CreateNetworkDeviceDTO = {
        ...createValidDraftDTO(),
        performPingTest: true
      };
      mockRepository.existsByIpAddress.mockResolvedValue(
        Result.ok(false)
      );
      mockRepository.existsByMacAddress.mockResolvedValue(
        Result.ok(false)
      );
      mockRepository.save.mockImplementation((device) =>
        Promise.resolve(Result.ok(device))
      );

      // Act
      await useCase.execute(dto);

      // Assert
      expect(mockLogger.info).toHaveBeenCalledWith(
        expect.stringContaining('Ping test requested'),
        expect.anything()
      );
    });
  });

  // ========================================
  // Edge Cases
  // ========================================

  describe('Edge Cases', () => {
    it('should handle null description', async () => {
      // Arrange
      const dto: CreateNetworkDeviceDTO = {
        ...createValidDraftDTO(),
        description: null
      };
      mockRepository.existsByIpAddress.mockResolvedValue(
        Result.ok(false)
      );
      mockRepository.existsByMacAddress.mockResolvedValue(
        Result.ok(false)
      );
      mockRepository.save.mockImplementation((device) =>
        Promise.resolve(Result.ok(device))
      );

      // Act
      const result = await useCase.execute(dto);

      // Assert
      expect(result.isSuccess).toBe(true);
      expect(result.value.description).toBeNull();
    });

    it('should handle all optional fields provided', async () => {
      // Arrange
      const dto: CreateNetworkDeviceDTO = {
        ...createValidActiveDTO(),
        description: 'Test description',
        managementPort: 8080,
        enabledRemoteAccess: true,
        performPingTest: false
      };
      mockRepository.existsByIpAddress.mockResolvedValue(
        Result.ok(false)
      );
      mockRepository.existsByMacAddress.mockResolvedValue(
        Result.ok(false)
      );
      mockRepository.save.mockImplementation((device) =>
        Promise.resolve(Result.ok(device))
      );

      // Act
      const result = await useCase.execute(dto);

      // Assert
      expect(result.isSuccess).toBe(true);
      expect(result.value.description).toBe('Test description');
      expect(result.value.managementPort).toBe(8080);
      expect(result.value.enabledRemoteAccess).toBe(true);
    });

    it('should generate unique ID for the device', async () => {
      // Arrange
      const dto = createValidDraftDTO();
      mockRepository.existsByIpAddress.mockResolvedValue(
        Result.ok(false)
      );
      mockRepository.existsByMacAddress.mockResolvedValue(
        Result.ok(false)
      );
      mockRepository.save.mockImplementation((device) =>
        Promise.resolve(Result.ok(device))
      );

      // Act
      const result = await useCase.execute(dto);

      // Assert
      expect(result.isSuccess).toBe(true);
      expect(result.value.id).toBeDefined();
      expect(typeof result.value.id).toBe('string');
      expect(result.value.id.length).toBeGreaterThan(0);
    });

    it('should set createdAt and updatedAt timestamps', async () => {
      // Arrange
      const dto = createValidDraftDTO();
      mockRepository.existsByIpAddress.mockResolvedValue(
        Result.ok(false)
      );
      mockRepository.existsByMacAddress.mockResolvedValue(
        Result.ok(false)
      );
      mockRepository.save.mockImplementation((device) =>
        Promise.resolve(Result.ok(device))
      );

      // Act
      const result = await useCase.execute(dto);

      // Assert
      expect(result.isSuccess).toBe(true);
      expect(result.value.createdAt).toBeDefined();
      expect(result.value.updatedAt).toBeDefined();
    });

    it('should use provided installDate', async () => {
      // Arrange
      const installDate = '2025-01-01T00:00:00.000Z';
      const dto: CreateNetworkDeviceDTO = {
        ...createValidDraftDTO(),
        installDate
      };
      mockRepository.existsByIpAddress.mockResolvedValue(
        Result.ok(false)
      );
      mockRepository.existsByMacAddress.mockResolvedValue(
        Result.ok(false)
      );
      mockRepository.save.mockImplementation((device) =>
        Promise.resolve(Result.ok(device))
      );

      // Act
      const result = await useCase.execute(dto);

      // Assert
      expect(result.isSuccess).toBe(true);
      expect(result.value.installDate).toBe(installDate);
    });

    it('should use current date as default installDate', async () => {
      // Arrange
      const dto = createValidDraftDTO();
      mockRepository.existsByIpAddress.mockResolvedValue(
        Result.ok(false)
      );
      mockRepository.existsByMacAddress.mockResolvedValue(
        Result.ok(false)
      );
      mockRepository.save.mockImplementation((device) =>
        Promise.resolve(Result.ok(device))
      );

      const beforeExecution = new Date();

      // Act
      const result = await useCase.execute(dto);

      const afterExecution = new Date();

      // Assert
      expect(result.isSuccess).toBe(true);
      const installDate = new Date(result.value.installDate);
      expect(installDate.getTime()).toBeGreaterThanOrEqual(
        beforeExecution.getTime()
      );
      expect(installDate.getTime()).toBeLessThanOrEqual(
        afterExecution.getTime()
      );
    });

    it('should handle MAC address with hyphen format', async () => {
      // Arrange
      const dto: CreateNetworkDeviceDTO = {
        ...createValidDraftDTO(),
        macAddress: 'AA-BB-CC-DD-EE-FF' // Hyphen format
      };
      mockRepository.existsByIpAddress.mockResolvedValue(
        Result.ok(false)
      );
      mockRepository.existsByMacAddress.mockResolvedValue(
        Result.ok(false)
      );
      mockRepository.save.mockImplementation((device) =>
        Promise.resolve(Result.ok(device))
      );

      // Act
      const result = await useCase.execute(dto);

      // Assert
      expect(result.isSuccess).toBe(true);
      // MAC should be normalized to colon format
      expect(result.value.macAddress).toMatch(
        /^([0-9A-F]{2}:){5}[0-9A-F]{2}$/
      );
    });

    it('should handle lowercase MAC address', async () => {
      // Arrange
      const dto: CreateNetworkDeviceDTO = {
        ...createValidDraftDTO(),
        macAddress: 'aa:bb:cc:dd:ee:ff' // Lowercase
      };
      mockRepository.existsByIpAddress.mockResolvedValue(
        Result.ok(false)
      );
      mockRepository.existsByMacAddress.mockResolvedValue(
        Result.ok(false)
      );
      mockRepository.save.mockImplementation((device) =>
        Promise.resolve(Result.ok(device))
      );

      // Act
      const result = await useCase.execute(dto);

      // Assert
      expect(result.isSuccess).toBe(true);
      // MAC should be normalized to uppercase
      expect(result.value.macAddress).toBe('AA:BB:CC:DD:EE:FF');
    });
  });

  // ========================================
  // Response DTO Structure Tests
  // ========================================

  describe('Response DTO Structure', () => {
    it('should return complete response DTO with all required fields', async () => {
      // Arrange
      const dto = createValidActiveDTO();
      mockRepository.existsByIpAddress.mockResolvedValue(
        Result.ok(false)
      );
      mockRepository.existsByMacAddress.mockResolvedValue(
        Result.ok(false)
      );
      mockRepository.save.mockImplementation((device) =>
        Promise.resolve(Result.ok(device))
      );

      // Act
      const result = await useCase.execute(dto);

      // Assert
      expect(result.isSuccess).toBe(true);
      const response = result.value;

      // Core identification
      expect(response.id).toBeDefined();
      expect(response.name).toBeDefined();
      expect(response.deviceType).toBeDefined();
      expect(response.status).toBeDefined();
      expect(response.ipAddress).toBeDefined();
      expect(response.macAddress).toBeDefined();
      expect(response.deviceId).toBeDefined();

      // REQ-002 lifecycle fields
      expect(response.activationStatus).toBeDefined();
      expect(response).toHaveProperty('activatedAt');
      expect(response).toHaveProperty('activatedBy');
      expect(response).toHaveProperty('deletedAt');
      expect(response).toHaveProperty('deletedBy');
      expect(response).toHaveProperty('replacedByDeviceId');
      expect(response).toHaveProperty('replacedAt');

      // Network configuration
      expect(response.connectivityType).toBeDefined();
      expect(response.managementProtocol).toBeDefined();
      expect(response.managementPort).toBeDefined();
      expect(response.enabledRemoteAccess).toBeDefined();

      // Timestamps
      expect(response.installDate).toBeDefined();
      expect(response.createdAt).toBeDefined();
      expect(response.updatedAt).toBeDefined();

      // Polling configuration
      expect(response.pollingConfiguration).toBeDefined();
      expect(response.pollingConfiguration.id).toBeDefined();
      expect(
        response.pollingConfiguration.networkDeviceId
      ).toBeDefined();
      expect(response.pollingConfiguration.enabled).toBeDefined();
      expect(
        response.pollingConfiguration.intervalSeconds
      ).toBeDefined();
      expect(response.pollingConfiguration.pingCount).toBeDefined();
      expect(response.pollingConfiguration.retryPolicy).toBeDefined();
    });
  });
});
