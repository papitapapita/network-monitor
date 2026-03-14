/**import { GetNetworkDeviceByIpUseCase } from '../../../src/application/use-cases/GetNetworkDeviceByIpUseCase';
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
import { GetNetworkDeviceByIpDTO } from '../../../src/application/dtos/network-device/NetworkDeviceDTO';

describe('GetNetworkDeviceByIpUseCase', () => {
  // ========================================
  // Mocks
  // ========================================

  let useCase: GetNetworkDeviceByIpUseCase;
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

    useCase = new GetNetworkDeviceByIpUseCase(mockRepository, mockLogger);
  });

  afterEach(() => {
    jest.clearAllMocks();
  });

  // ========================================
  // Test Data Helpers
  // ========================================

  const createMockActiveDevice = (ipStr: string): NetworkDevice => {
    const deviceId = NetworkDeviceId.create().value;
    const ipAddress = IPAddress.create(ipStr).value;
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
    it('should retrieve device by valid IPv4 address', async () => {
      // Arrange
      const device = createMockActiveDevice('192.168.1.100');
      const request: GetNetworkDeviceByIpDTO = {
        ipAddress: '192.168.1.100'
      };

      mockRepository.findByIpAddress.mockResolvedValue(
        Result.ok(device)
      );

      // Act
      const result = await useCase.execute(request);

      // Assert
      expect(result.isSuccess).toBe(true);
      expect(result.value).toBeDefined();
      expect(result.value.ipAddress).toBe('192.168.1.100');
      expect(result.value.name).toBe('Router-Core-01');
    });

    it('should retrieve device by IPv6 address', async () => {
      // Arrange
      const device = createMockActiveDevice(
        '2001:0db8:85a3:0000:0000:8a2e:0370:7334'
      );
      const request: GetNetworkDeviceByIpDTO = {
        ipAddress: '2001:0db8:85a3:0000:0000:8a2e:0370:7334'
      };

      mockRepository.findByIpAddress.mockResolvedValue(
        Result.ok(device)
      );

      // Act
      const result = await useCase.execute(request);

      // Assert
      expect(result.isSuccess).toBe(true);
      expect(result.value.ipAddress).toBe(
        '2001:0db8:85a3:0000:0000:8a2e:0370:7334'
      );
    });

    it('should return complete device information', async () => {
      // Arrange
      const device = createMockActiveDevice('192.168.1.100');
      const request: GetNetworkDeviceByIpDTO = {
        ipAddress: '192.168.1.100'
      };

      mockRepository.findByIpAddress.mockResolvedValue(
        Result.ok(device)
      );

      // Act
      const result = await useCase.execute(request);

      // Assert
      expect(result.isSuccess).toBe(true);
      expect(result.value.id).toBeDefined();
      expect(result.value.name).toBe('Router-Core-01');
      expect(result.value.deviceType).toBe('ROUTER');
      expect(result.value.status).toBe('ONLINE');
      expect(result.value.macAddress).toBe('AA:BB:CC:DD:EE:FF');
    });

    it('should retrieve DRAFT device by IP', async () => {
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

      const request: GetNetworkDeviceByIpDTO = {
        ipAddress: '192.168.1.101'
      };

      mockRepository.findByIpAddress.mockResolvedValue(
        Result.ok(draftDevice)
      );

      // Act
      const result = await useCase.execute(request);

      // Assert
      expect(result.isSuccess).toBe(true);
      expect(result.value.activationStatus).toBe('DRAFT');
    });
  });

  // ========================================
  // Input Validation Tests
  // ========================================

  describe('Input Validation', () => {
    it('should fail when IP address is invalid', async () => {
      // Arrange
      const request: GetNetworkDeviceByIpDTO = {
        ipAddress: 'invalid-ip'
      };

      // Act
      const result = await useCase.execute(request);

      // Assert
      expect(result.isFailure).toBe(true);
      expect(result.error).toContain('Invalid IP address');
      expect(mockRepository.findByIpAddress).not.toHaveBeenCalled();
    });

    it('should fail when IP address is empty', async () => {
      // Arrange
      const request: GetNetworkDeviceByIpDTO = {
        ipAddress: ''
      };

      // Act
      const result = await useCase.execute(request);

      // Assert
      expect(result.isFailure).toBe(true);
      expect(result.error).toContain('Invalid IP address');
    });

    it('should fail when IP address has invalid format (out of range)', async () => {
      // Arrange
      const request: GetNetworkDeviceByIpDTO = {
        ipAddress: '999.999.999.999'
      };

      // Act
      const result = await useCase.execute(request);

      // Assert
      expect(result.isFailure).toBe(true);
      expect(result.error).toContain('Invalid IP address');
    });

    it('should fail when IP address has invalid format (incomplete)', async () => {
      // Arrange
      const request: GetNetworkDeviceByIpDTO = {
        ipAddress: '192.168.1'
      };

      // Act
      const result = await useCase.execute(request);

      // Assert
      expect(result.isFailure).toBe(true);
      expect(result.error).toContain('Invalid IP address');
    });
  });

  // ========================================
  // Business Rules Tests
  // ========================================

  describe('Business Rules', () => {
    it('should fail when device with IP does not exist', async () => {
      // Arrange
      const request: GetNetworkDeviceByIpDTO = {
        ipAddress: '192.168.1.100'
      };

      mockRepository.findByIpAddress.mockResolvedValue(
        Result.ok(null)
      );

      // Act
      const result = await useCase.execute(request);

      // Assert
      expect(result.isFailure).toBe(true);
      expect(result.error).toContain('not found');
      expect(result.error).toContain('192.168.1.100');
    });

    it('should include IP address in not found error', async () => {
      // Arrange
      const request: GetNetworkDeviceByIpDTO = {
        ipAddress: '10.0.0.1'
      };

      mockRepository.findByIpAddress.mockResolvedValue(
        Result.ok(null)
      );

      // Act
      const result = await useCase.execute(request);

      // Assert
      expect(result.isFailure).toBe(true);
      expect(result.error).toContain('10.0.0.1');
    });
  });

  // ========================================
  // Repository Interaction Tests
  // ========================================

  describe('Repository Interactions', () => {
    it('should call repository.findByIpAddress with correct IP', async () => {
      // Arrange
      const device = createMockActiveDevice('192.168.1.100');
      const request: GetNetworkDeviceByIpDTO = {
        ipAddress: '192.168.1.100'
      };

      mockRepository.findByIpAddress.mockResolvedValue(
        Result.ok(device)
      );

      // Act
      await useCase.execute(request);

      // Assert
      expect(mockRepository.findByIpAddress).toHaveBeenCalledTimes(1);
      const calledWithIp =
        mockRepository.findByIpAddress.mock.calls[0][0];
      expect(calledWithIp).toBeInstanceOf(IPAddress);
      expect(calledWithIp.toString()).toBe('192.168.1.100');
    });

    it('should handle repository error', async () => {
      // Arrange
      const request: GetNetworkDeviceByIpDTO = {
        ipAddress: '192.168.1.100'
      };

      mockRepository.findByIpAddress.mockResolvedValue(
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
      const device = createMockActiveDevice('192.168.1.100');
      device.updateDescription(null);
      device.updateLocation(null);

      const request: GetNetworkDeviceByIpDTO = {
        ipAddress: '192.168.1.100'
      };

      mockRepository.findByIpAddress.mockResolvedValue(
        Result.ok(device)
      );

      // Act
      const result = await useCase.execute(request);

      // Assert
      expect(result.isSuccess).toBe(true);
      expect(result.value.description).toBeNull();
      expect(result.value.location).toBeNull();
    });

    it('should handle localhost IP', async () => {
      // Arrange
      const device = createMockActiveDevice('127.0.0.1');
      const request: GetNetworkDeviceByIpDTO = {
        ipAddress: '127.0.0.1'
      };

      mockRepository.findByIpAddress.mockResolvedValue(
        Result.ok(device)
      );

      // Act
      const result = await useCase.execute(request);

      // Assert
      expect(result.isSuccess).toBe(true);
      expect(result.value.ipAddress).toBe('127.0.0.1');
    });

    it('should handle private network IP range', async () => {
      // Arrange
      const device = createMockActiveDevice('10.0.0.1');
      const request: GetNetworkDeviceByIpDTO = {
        ipAddress: '10.0.0.1'
      };

      mockRepository.findByIpAddress.mockResolvedValue(
        Result.ok(device)
      );

      // Act
      const result = await useCase.execute(request);

      // Assert
      expect(result.isSuccess).toBe(true);
      expect(result.value.ipAddress).toBe('10.0.0.1');
    });

    it('should retrieve soft-deleted device by IP', async () => {
      // Arrange
      const device = createMockActiveDevice('192.168.1.100');
      device.softDelete('test-user', 'Testing');

      const request: GetNetworkDeviceByIpDTO = {
        ipAddress: '192.168.1.100'
      };

      mockRepository.findByIpAddress.mockResolvedValue(
        Result.ok(device)
      );

      // Act
      const result = await useCase.execute(request);

      // Assert
      expect(result.isSuccess).toBe(true);
      expect(result.value.deletedAt).toBeDefined();
    });
  });
});
*/
