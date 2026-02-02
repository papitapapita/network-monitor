import {
  BulkImportNetworkDevicesUseCase,
  BulkImportRequestDTO,
  CSVDeviceRow,
  ILogger
} from '../../../src/application';
import {
  Result,
  NetworkDevice,
  INetworkDeviceRepository
} from '../../../src/domain';

describe('BulkImportNetworkDevicesUseCase', () => {
  // ========================================
  // Mocks
  // ========================================

  let useCase: BulkImportNetworkDevicesUseCase;
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
      debug: jest.fn(),
      fatal: jest.fn(),
      child: jest.fn().mockReturnThis(),
      setLevel: jest.fn()
    } as any;

    useCase = new BulkImportNetworkDevicesUseCase(
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

  const createValidCSVRow = (index: number = 1): CSVDeviceRow => {
    // Generate valid IP: 10.x.y.z where x,y,z are derived from index (supports up to 16M devices)
    const octet4 = (index % 255) + 1; // Avoid .0 addresses
    const remaining = Math.floor(index / 255);

    const octet3 = remaining % 256;
    const octet2 = Math.floor(remaining / 256) % 256;

    // Generate valid MAC: last 3 octets derived from index (supports up to 16M devices)
    const macOctet4 = ((index >> 16) & 0xff)
      .toString(16)
      .padStart(2, '0')
      .toUpperCase();
    const macOctet5 = ((index >> 8) & 0xff)
      .toString(16)
      .padStart(2, '0')
      .toUpperCase();
    const macOctet6 = (index & 0xff)
      .toString(16)
      .padStart(2, '0')
      .toUpperCase();

    return {
      ipAddress: `10.${octet2}.${octet3}.${octet4}`,
      macAddress: `AA:BB:CC:${macOctet4}:${macOctet5}:${macOctet6}`,
      deviceId: `device-${index.toString().padStart(3, '0')}`
    };
  };

  const createValidActiveCSVRow = (
    index: number = 1
  ): CSVDeviceRow => ({
    ...createValidCSVRow(index),
    name: `Router-${index}`,
    deviceType: 'ROUTER'
  });

  // ========================================
  // Success Cases - DRAFT Mode
  // ========================================

  describe('DRAFT Mode (activateImmediately = false)', () => {
    it('should import devices in DRAFT status with minimal fields', async () => {
      // Arrange
      const csvData = [createValidCSVRow(1), createValidCSVRow(2)];

      const request: BulkImportRequestDTO = {
        csvData,
        activateImmediately: false
      };

      mockRepository.existsByIpAddress.mockResolvedValue(
        Result.ok(false)
      );
      mockRepository.existsByMacAddress.mockResolvedValue(
        Result.ok(false)
      );
      mockRepository.saveMany.mockResolvedValue(Result.ok());

      // Act
      const result = await useCase.execute(request);

      // Assert
      expect(result.isSuccess).toBe(true);
      expect(result.value.success).toBe(true);
      expect(result.value.created).toBe(2);
      expect(result.value.failed).toBe(0);
      expect(result.value.deviceIds).toHaveLength(2);
    });

    it('should accept devices without name in DRAFT mode', async () => {
      // Arrange
      const csvData = [createValidCSVRow(1)];
      const request: BulkImportRequestDTO = {
        csvData,
        activateImmediately: false
      };

      mockRepository.existsByIpAddress.mockResolvedValue(
        Result.ok(false)
      );
      mockRepository.existsByMacAddress.mockResolvedValue(
        Result.ok(false)
      );
      mockRepository.saveMany.mockResolvedValue(Result.ok());

      // Act
      const result = await useCase.execute(request);

      // Assert
      expect(result.isSuccess).toBe(true);
      expect(result.value.success).toBe(true);
    });

    it('should accept devices without deviceType in DRAFT mode', async () => {
      // Arrange
      const csvData = [createValidCSVRow(1)];
      const request: BulkImportRequestDTO = {
        csvData,
        activateImmediately: false
      };

      mockRepository.existsByIpAddress.mockResolvedValue(
        Result.ok(false)
      );
      mockRepository.existsByMacAddress.mockResolvedValue(
        Result.ok(false)
      );
      mockRepository.saveMany.mockResolvedValue(Result.ok());

      // Act
      const result = await useCase.execute(request);

      // Assert
      expect(result.isSuccess).toBe(true);
      expect(result.value.success).toBe(true);
    });
  });

  // ========================================
  // Success Cases - ACTIVE Mode
  // ========================================

  describe('ACTIVE Mode (activateImmediately = true)', () => {
    it('should import devices in ACTIVE status with full fields', async () => {
      // Arrange
      const csvData = [
        createValidActiveCSVRow(1),
        createValidActiveCSVRow(2)
      ];

      const request: BulkImportRequestDTO = {
        csvData,
        activateImmediately: true
      };

      mockRepository.existsByIpAddress.mockResolvedValue(
        Result.ok(false)
      );
      mockRepository.existsByMacAddress.mockResolvedValue(
        Result.ok(false)
      );
      mockRepository.saveMany.mockResolvedValue(Result.ok());

      // Act
      const result = await useCase.execute(request);

      // Assert
      expect(result.isSuccess).toBe(true);
      expect(result.value.success).toBe(true);
      expect(result.value.created).toBe(2);
    });
  });

  // ========================================
  // Validation Tests - Format
  // ========================================

  describe('Format Validation', () => {
    it('should fail when IP address is invalid', async () => {
      // Arrange
      const csvData = [
        {
          ipAddress: '999.999.999.999',
          macAddress: 'AA:BB:CC:DD:EE:FF',
          deviceId: 'device-001'
        }
      ];

      const request: BulkImportRequestDTO = {
        csvData,
        activateImmediately: false
      };

      // Act
      const result = await useCase.execute(request);

      // Assert
      expect(result.isSuccess).toBe(true);
      expect(result.value.success).toBe(false);
      expect(result.value.failed).toBe(1);
      expect(result.value.validationErrors).toHaveLength(1);
      expect(result.value.validationErrors![0].field).toBe(
        'ipAddress'
      );
      expect(result.value.validationErrors![0].error).toContain(
        'Invalid IP address'
      );
    });

    it('should fail when MAC address is invalid', async () => {
      // Arrange
      const csvData = [
        {
          ipAddress: '192.168.1.100',
          macAddress: 'invalid-mac',
          deviceId: 'device-001'
        }
      ];

      const request: BulkImportRequestDTO = {
        csvData,
        activateImmediately: false
      };

      // Act
      const result = await useCase.execute(request);

      // Assert
      expect(result.isSuccess).toBe(true);
      expect(result.value.success).toBe(false);
      expect(result.value.failed).toBe(1);
      expect(result.value.validationErrors).toHaveLength(1);
      expect(result.value.validationErrors![0].field).toBe(
        'macAddress'
      );
    });

    it('should fail when required field is missing', async () => {
      // Arrange
      const csvData = [
        {
          ipAddress: '192.168.1.100',
          // Missing macAddress
          deviceId: 'device-001'
        } as any
      ];

      const request: BulkImportRequestDTO = {
        csvData,
        activateImmediately: false
      };

      // Act
      const result = await useCase.execute(request);

      // Assert
      expect(result.isSuccess).toBe(true);
      expect(result.value.success).toBe(false);
      expect(result.value.failed).toBe(1);
    });
  });

  // ========================================
  // Validation Tests - Business Rules
  // ========================================

  describe('Business Rules Validation', () => {
    it('should require name in ACTIVE mode', async () => {
      // Arrange
      const csvData = [
        {
          ipAddress: '192.168.1.100',
          macAddress: 'AA:BB:CC:DD:EE:FF',
          deviceId: 'device-001'
          // Missing name
        }
      ];

      const request: BulkImportRequestDTO = {
        csvData,
        activateImmediately: true
      };

      // Act
      const result = await useCase.execute(request);

      if (result.isFailure) {
        throw new Error(result.error);
      }

      // Assert
      expect(result.isSuccess).toBe(true);
      expect(result.value.success).toBe(false);
      expect(result.value.validationErrors![0].error).toContain(
        'name'
      );
    });

    it('should require deviceType in ACTIVE mode', async () => {
      // Arrange
      const csvData = [
        {
          ipAddress: '192.168.1.100',
          macAddress: 'AA:BB:CC:DD:EE:FF',
          deviceId: 'device-001',
          name: 'Router-01'
          // Missing deviceType
        }
      ];

      const request: BulkImportRequestDTO = {
        csvData,
        activateImmediately: true
      };

      // Act
      const result = await useCase.execute(request);

      // Assert
      expect(result.isSuccess).toBe(true);
      expect(result.value.success).toBe(false);
      expect(result.value.validationErrors![0].error).toContain(
        'deviceType'
      );
    });
  });

  // ========================================
  // Uniqueness Validation Tests
  // ========================================

  describe('Uniqueness Validation', () => {
    it('should fail when duplicate IP within CSV', async () => {
      // Arrange
      const row1 = createValidCSVRow(1);
      const csvData = [
        row1,
        { ...createValidCSVRow(2), ipAddress: row1.ipAddress } // Same IP as row 1
      ];

      const request: BulkImportRequestDTO = {
        csvData,
        activateImmediately: false
      };

      // Act
      const result = await useCase.execute(request);

      // Assert
      expect(result.isSuccess).toBe(true);
      expect(result.value.success).toBe(false);
      expect(result.value.validationErrors!.length).toBeGreaterThan(
        0
      );
      expect(
        result.value.validationErrors!.some((e) =>
          e.error.includes('duplicate')
        )
      ).toBe(true);
    });

    it('should fail when duplicate MAC within CSV', async () => {
      // Arrange
      const row1 = createValidCSVRow(1);
      const csvData = [
        row1,
        { ...createValidCSVRow(2), macAddress: row1.macAddress } // Same MAC as row 1
      ];

      const request: BulkImportRequestDTO = {
        csvData,
        activateImmediately: false
      };

      // Act
      const result = await useCase.execute(request);

      // Assert
      expect(result.isSuccess).toBe(true);
      expect(result.value.success).toBe(false);
      expect(
        result.value.validationErrors!.some((e) =>
          e.error.includes('duplicate')
        )
      ).toBe(true);
    });

    it('should fail when IP exists in database', async () => {
      // Arrange
      const csvData = [createValidCSVRow(1)];
      const request: BulkImportRequestDTO = {
        csvData,
        activateImmediately: false
      };

      mockRepository.existsByIpAddress.mockResolvedValue(
        Result.ok(true)
      ); // Already exists

      // Act
      const result = await useCase.execute(request);

      // Assert
      expect(result.isSuccess).toBe(true);
      expect(result.value.success).toBe(false);
      expect(result.value.validationErrors!.length).toBeGreaterThan(
        0
      );
      expect(
        result.value.validationErrors!.some((e) =>
          e.error.includes('already exists')
        )
      ).toBe(true);
    });

    it('should fail when MAC exists in database', async () => {
      // Arrange
      const csvData = [createValidCSVRow(1)];
      const request: BulkImportRequestDTO = {
        csvData,
        activateImmediately: false
      };

      mockRepository.existsByIpAddress.mockResolvedValue(
        Result.ok(false)
      );
      mockRepository.existsByMacAddress.mockResolvedValue(
        Result.ok(true)
      ); // Already exists

      // Act
      const result = await useCase.execute(request);

      // Assert
      expect(result.isSuccess).toBe(true);
      expect(result.value.success).toBe(false);
      expect(
        result.value.validationErrors!.some((e) =>
          e.error.includes('already exists')
        )
      ).toBe(true);
    });
  });

  // ========================================
  // All-or-Nothing Transaction Tests
  // ========================================

  describe('All-or-Nothing Transaction', () => {
    it('should fail entire import if one row is invalid', async () => {
      // Arrange
      const csvData = [
        createValidCSVRow(1), // Valid
        createValidCSVRow(2), // Valid
        {
          ipAddress: 'invalid-ip',
          macAddress: 'AA:BB:CC:DD:EE:FF',
          deviceId: 'device-003'
        } // Invalid
      ];

      const request: BulkImportRequestDTO = {
        csvData,
        activateImmediately: false
      };

      // Act
      const result = await useCase.execute(request);

      // Assert
      expect(result.isSuccess).toBe(true);
      expect(result.value.success).toBe(false);
      expect(result.value.created).toBe(0); // None created
      expect(result.value.failed).toBe(3); // All failed
      expect(mockRepository.saveMany).not.toHaveBeenCalled();
    });

    it('should not save anything if validation fails', async () => {
      // Arrange
      const csvData = [
        createValidCSVRow(1),
        {
          ipAddress: 'invalid',
          macAddress: 'AA:BB:CC:DD:EE:FF',
          deviceId: 'device-002'
        }
      ];

      const request: BulkImportRequestDTO = {
        csvData,
        activateImmediately: false
      };

      // Act
      await useCase.execute(request);

      // Assert
      expect(mockRepository.saveMany).not.toHaveBeenCalled();
    });
  });

  // ========================================
  // Limits Tests
  // ========================================

  describe('Import Limits', () => {
    it('should enforce 1000 device limit', async () => {
      // Arrange
      const csvData = Array.from({ length: 1001 }, (_, i) =>
        createValidCSVRow(i + 1)
      );

      const request: BulkImportRequestDTO = {
        csvData,
        activateImmediately: false
      };

      // Act
      const result = await useCase.execute(request);

      // Assert
      expect(result.isSuccess).toBe(true);
      expect(result.value.success).toBe(false);
      expect(result.value.validationErrors![0].error).toContain(
        '1,000 devices'
      );
    });

    it('should accept exactly 1000 devices', async () => {
      // Arrange
      const csvData = Array.from({ length: 1000 }, (_, i) =>
        createValidCSVRow(i + 1)
      );

      const request: BulkImportRequestDTO = {
        csvData,
        activateImmediately: false
      };

      mockRepository.existsByIpAddress.mockResolvedValue(
        Result.ok(false)
      );
      mockRepository.existsByMacAddress.mockResolvedValue(
        Result.ok(false)
      );
      mockRepository.saveMany.mockResolvedValue(Result.ok());

      // Act
      const result = await useCase.execute(request);

      console.log(result.value.validationErrors);
      if (result.isFailure) {
        throw new Error(result.error);
      }

      // Assert
      expect(result.isSuccess).toBe(true);
      expect(result.value.success).toBe(true);
      expect(result.value.created).toBe(1000);
    });

    it('should fail when CSV is empty', async () => {
      // Arrange
      const request: BulkImportRequestDTO = {
        csvData: [],
        activateImmediately: false
      };

      // Act
      const result = await useCase.execute(request);

      // Assert
      expect(result.isSuccess).toBe(true);
      expect(result.value.success).toBe(false);
    });
  });

  // ========================================
  // Repository Interaction Tests
  // ========================================

  describe('Repository Interactions', () => {
    it('should call saveMany() with all devices', async () => {
      // Arrange
      const csvData = [createValidCSVRow(1), createValidCSVRow(2)];

      const request: BulkImportRequestDTO = {
        csvData,
        activateImmediately: false
      };

      mockRepository.existsByIpAddress.mockResolvedValue(
        Result.ok(false)
      );
      mockRepository.existsByMacAddress.mockResolvedValue(
        Result.ok(false)
      );
      mockRepository.saveMany.mockResolvedValue(Result.ok());

      // Act
      await useCase.execute(request);

      // Assert
      expect(mockRepository.saveMany).toHaveBeenCalledTimes(1);
      const savedDevices = mockRepository.saveMany.mock.calls[0][0];
      expect(savedDevices).toHaveLength(2);
      expect(savedDevices[0]).toBeInstanceOf(NetworkDevice);
      expect(savedDevices[1]).toBeInstanceOf(NetworkDevice);
    });

    it('should handle repository saveMany error', async () => {
      // Arrange
      const csvData = [createValidCSVRow(1)];
      const request: BulkImportRequestDTO = {
        csvData,
        activateImmediately: false
      };

      mockRepository.existsByIpAddress.mockResolvedValue(
        Result.ok(false)
      );
      mockRepository.existsByMacAddress.mockResolvedValue(
        Result.ok(false)
      );
      mockRepository.saveMany.mockResolvedValue(
        Result.fail('Database transaction error')
      );

      // Act
      const result = await useCase.execute(request);

      // Assert
      expect(result.isFailure).toBe(true);
      expect(result.error).toContain('Database transaction error');
    });
  });

  // ========================================
  // Performance Tests
  // ========================================

  describe('Performance', () => {
    it('should complete import within reasonable time', async () => {
      // Arrange
      const csvData = Array.from({ length: 100 }, (_, i) =>
        createValidCSVRow(i + 1)
      );

      const request: BulkImportRequestDTO = {
        csvData,
        activateImmediately: false
      };

      mockRepository.existsByIpAddress.mockResolvedValue(
        Result.ok(false)
      );
      mockRepository.existsByMacAddress.mockResolvedValue(
        Result.ok(false)
      );
      mockRepository.saveMany.mockResolvedValue(Result.ok());

      // Act
      const startTime = Date.now();
      const result = await useCase.execute(request);
      const duration = Date.now() - startTime;

      // Assert
      expect(result.isSuccess).toBe(true);
      expect(result.value.success).toBe(true);
      expect(result.value.duration).toBeLessThan(30000); // 30 seconds
      expect(duration).toBeLessThan(5000); // Should be much faster in tests
    });

    it('should return duration in response', async () => {
      // Arrange
      const csvData = [createValidCSVRow(1)];
      const request: BulkImportRequestDTO = {
        csvData,
        activateImmediately: false
      };

      mockRepository.existsByIpAddress.mockResolvedValue(
        Result.ok(false)
      );
      mockRepository.existsByMacAddress.mockResolvedValue(
        Result.ok(false)
      );
      mockRepository.saveMany.mockResolvedValue(Result.ok());

      // Act
      const result = await useCase.execute(request);

      // Assert
      expect(result.isSuccess).toBe(true);
      expect(result.value.duration).toBeGreaterThan(0);
    });
  });

  // ========================================
  // Error Reporting Tests
  // ========================================

  describe('Error Reporting', () => {
    it('should include row number in validation errors', async () => {
      // Arrange
      const csvData = [
        createValidCSVRow(1),
        {
          ipAddress: 'invalid',
          macAddress: 'AA:BB:CC:DD:EE:FF',
          deviceId: 'device-002'
        }
      ];

      const request: BulkImportRequestDTO = {
        csvData,
        activateImmediately: false
      };

      // Act
      const result = await useCase.execute(request);

      // Assert
      expect(result.value.validationErrors![0].row).toBe(2);
    });

    it('should include field name in validation errors', async () => {
      // Arrange
      const csvData = [
        {
          ipAddress: 'invalid',
          macAddress: 'AA:BB:CC:DD:EE:FF',
          deviceId: 'device-001'
        }
      ];

      const request: BulkImportRequestDTO = {
        csvData,
        activateImmediately: false
      };

      // Act
      const result = await useCase.execute(request);

      // Assert
      expect(result.value.validationErrors![0].field).toBe(
        'ipAddress'
      );
    });

    it('should include problematic value in validation errors', async () => {
      // Arrange
      const csvData = [
        {
          ipAddress: '999.999.999.999',
          macAddress: 'AA:BB:CC:DD:EE:FF',
          deviceId: 'device-001'
        }
      ];

      const request: BulkImportRequestDTO = {
        csvData,
        activateImmediately: false
      };

      // Act
      const result = await useCase.execute(request);

      // Assert
      expect(result.value.validationErrors![0].value).toBe(
        '999.999.999.999'
      );
    });
  });
});
