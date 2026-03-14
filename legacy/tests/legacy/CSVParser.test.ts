import {
  CSVParser,
  parseDeviceCSV,
  generateDeviceCSVTemplate
} from '../../../src/infrastructure/csv/CSVParser';
import { CSVDeviceRow } from '../../../../src/application/legacy/use-cases/BulkImportNetworkDevicesUseCase';

describe('CSVParser', () => {
  // ========================================
  // Setup
  // ========================================

  let parser: CSVParser;

  beforeEach(() => {
    parser = new CSVParser();
  });

  // ========================================
  // Test Data Helpers
  // ========================================

  const createValidCSV = (): string => {
    return `ipAddress,macAddress,name,deviceType,description,location,connectivityType,managementProtocol,managementPort,enabledRemoteAccess,deviceId
192.168.1.100,AA:BB:CC:DD:EE:FF,Router-Core-01,ROUTER,Main core router,Building A,ETHERNET,SNMP,161,false,device-001
192.168.1.101,AA:BB:CC:DD:EE:FE,Switch-Access-01,SWITCH,Access switch,Building B,FIBER_OPTIC,SSH,22,true,device-002`;
  };

  const createMinimalCSV = (): string => {
    return `ipAddress,macAddress
192.168.1.100,AA:BB:CC:DD:EE:FF
192.168.1.101,AA:BB:CC:DD:EE:FE`;
  };

  const createPartialCSV = (): string => {
    return `ipAddress,macAddress,name,deviceType
192.168.1.100,AA:BB:CC:DD:EE:FF,Router-Core-01,ROUTER
192.168.1.101,AA:BB:CC:DD:EE:FE,Switch-Access-01,SWITCH`;
  };

  // ========================================
  // Valid CSV Parsing Tests
  // ========================================

  describe('Valid CSV Parsing', () => {
    it('should parse valid CSV with all fields', () => {
      // Arrange
      const csv = createValidCSV();

      // Act
      const result = parser.parse(csv);

      // Assert
      expect(result.isSuccess).toBe(true);
      expect(result.value).toBeDefined();
      expect(result.value!.length).toBe(2);
      expect(result.value![0].ipAddress).toBe('192.168.1.100');
      expect(result.value![0].macAddress).toBe('AA:BB:CC:DD:EE:FF');
      expect(result.value![0].name).toBe('Router-Core-01');
      expect(result.value![0].deviceType).toBe('ROUTER');
      expect(result.value![0].description).toBe('Main core router');
      expect(result.value![0].location).toBe('Building A');
    });

    it('should parse CSV with only required fields', () => {
      // Arrange
      const csv = createMinimalCSV();

      // Act
      const result = parser.parse(csv);

      // Assert
      expect(result.isSuccess).toBe(true);
      expect(result.value).toBeDefined();
      expect(result.value!.length).toBe(2);
      expect(result.value![0].ipAddress).toBe('192.168.1.100');
      expect(result.value![0].macAddress).toBe('AA:BB:CC:DD:EE:FF');
      expect(result.value![0].name).toBeUndefined();
      expect(result.value![0].deviceType).toBeUndefined();
    });

    it('should parse CSV with some optional fields', () => {
      // Arrange
      const csv = createPartialCSV();

      // Act
      const result = parser.parse(csv);

      // Assert
      expect(result.isSuccess).toBe(true);
      expect(result.value).toBeDefined();
      expect(result.value!.length).toBe(2);
      expect(result.value![0].name).toBe('Router-Core-01');
      expect(result.value![0].deviceType).toBe('ROUTER');
      expect(result.value![0].description).toBeUndefined();
    });

    it('should trim whitespace from field values', () => {
      // Arrange
      const csv = `ipAddress,macAddress,name
  192.168.1.100  ,  AA:BB:CC:DD:EE:FF  ,  Router-Core-01  `;

      // Act
      const result = parser.parse(csv);

      // Assert
      expect(result.isSuccess).toBe(true);
      expect(result.value![0].ipAddress).toBe('192.168.1.100');
      expect(result.value![0].macAddress).toBe('AA:BB:CC:DD:EE:FF');
      expect(result.value![0].name).toBe('Router-Core-01');
    });

    it('should skip empty rows', () => {
      // Arrange
      const csv = `ipAddress,macAddress
192.168.1.100,AA:BB:CC:DD:EE:FF

192.168.1.101,AA:BB:CC:DD:EE:FE

192.168.1.102,AA:BB:CC:DD:EE:FD`;

      // Act
      const result = parser.parse(csv);

      // Assert
      expect(result.isSuccess).toBe(true);
      expect(result.value!.length).toBe(3);
    });
  });

  // ========================================
  // Quoted Field Handling Tests
  // ========================================

  describe('Quoted Field Handling', () => {
    it('should handle quoted fields with commas inside', () => {
      // Arrange
      const csv = `ipAddress,macAddress,description
192.168.1.100,AA:BB:CC:DD:EE:FF,"Main router, core network"`;

      // Act
      const result = parser.parse(csv);

      // Assert
      expect(result.isSuccess).toBe(true);
      expect(result.value![0].description).toBe(
        'Main router, core network'
      );
    });

    it('should handle escaped quotes (double quotes)', () => {
      // Arrange
      const csv = `ipAddress,macAddress,description
192.168.1.100,AA:BB:CC:DD:EE:FF,"Router with ""high availability"""`;

      // Act
      const result = parser.parse(csv);

      // Assert
      expect(result.isSuccess).toBe(true);
      expect(result.value![0].description).toBe(
        'Router with "high availability"'
      );
    });

    it('should handle mixed quoted and unquoted fields', () => {
      // Arrange
      const csv = `ipAddress,macAddress,name,description
192.168.1.100,AA:BB:CC:DD:EE:FF,Router-01,"Core router, primary"`;

      // Act
      const result = parser.parse(csv);

      // Assert
      expect(result.isSuccess).toBe(true);
      expect(result.value![0].name).toBe('Router-01');
      expect(result.value![0].description).toBe(
        'Core router, primary'
      );
    });

    it('should handle quoted fields with newlines', () => {
      // Arrange
      const csv = `ipAddress,macAddress,name
192.168.1.100,AA:BB:CC:DD:EE:FF,"Router-01"`;

      // Act
      const result = parser.parse(csv);

      // Assert
      expect(result.isSuccess).toBe(true);
      expect(result.value![0].name).toBe('Router-01');
    });
  });

  // ========================================
  // CSV Injection Prevention Tests
  // ========================================

  describe('CSV Injection Prevention', () => {
    it('should strip leading = character', () => {
      // Arrange
      const csv = `ipAddress,macAddress,name
192.168.1.100,AA:BB:CC:DD:EE:FF,=SUM(A1:A10)`;

      // Act
      const result = parser.parse(csv);

      // Assert
      expect(result.isSuccess).toBe(true);
      expect(result.value![0].name).toBe('SUM(A1:A10)');
    });

    it('should strip leading + character', () => {
      // Arrange
      const csv = `ipAddress,macAddress,name
192.168.1.100,AA:BB:CC:DD:EE:FF,+cmd|'/c calc'!A1`;

      // Act
      const result = parser.parse(csv);

      // Assert
      expect(result.isSuccess).toBe(true);
      expect(result.value![0].name).toBe("cmd|'/c calc'!A1");
    });

    it('should strip leading - character', () => {
      // Arrange
      const csv = `ipAddress,macAddress,name
192.168.1.100,AA:BB:CC:DD:EE:FF,-2+3`;

      // Act
      const result = parser.parse(csv);

      // Assert
      expect(result.isSuccess).toBe(true);
      expect(result.value![0].name).toBe('2+3');
    });

    it('should strip leading @ character', () => {
      // Arrange
      const csv = `ipAddress,macAddress,name
192.168.1.100,AA:BB:CC:DD:EE:FF,@SUM(A1:A10)`;

      // Act
      const result = parser.parse(csv);

      // Assert
      expect(result.isSuccess).toBe(true);
      expect(result.value![0].name).toBe('SUM(A1:A10)');
    });

    it('should strip multiple leading dangerous characters', () => {
      // Arrange
      const csv = `ipAddress,macAddress,name
192.168.1.100,AA:BB:CC:DD:EE:FF,=+-@malicious`;

      // Act
      const result = parser.parse(csv);

      // Assert
      expect(result.isSuccess).toBe(true);
      expect(result.value![0].name).toBe('malicious');
    });

    it('should not strip dangerous characters in the middle', () => {
      // Arrange
      const csv = `ipAddress,macAddress,name
192.168.1.100,AA:BB:CC:DD:EE:FF,Router-01=test`;

      // Act
      const result = parser.parse(csv);

      // Assert
      expect(result.isSuccess).toBe(true);
      expect(result.value![0].name).toBe('Router-01=test');
    });

    it('should handle field that becomes empty after sanitization', () => {
      // Arrange
      const csv = `ipAddress,macAddress,name
192.168.1.100,AA:BB:CC:DD:EE:FF,=+-@`;

      // Act
      const result = parser.parse(csv);

      // Assert
      expect(result.isSuccess).toBe(true);
      expect(result.value![0].name).toBeUndefined();
    });
  });

  // ========================================
  // Required Column Validation Tests
  // ========================================

  describe('Required Column Validation', () => {
    it('should fail when ipAddress column is missing', () => {
      // Arrange
      const csv = `macAddress,name
AA:BB:CC:DD:EE:FF,Router-01`;

      // Act
      const result = parser.parse(csv);

      // Assert
      expect(result.isSuccess).toBe(false);
      expect(result.error).toContain('Missing required columns');
      expect(result.error).toContain('ipAddress');
    });

    it('should fail when macAddress column is missing', () => {
      // Arrange
      const csv = `ipAddress,name
192.168.1.100,Router-01`;

      // Act
      const result = parser.parse(csv);

      // Assert
      expect(result.isSuccess).toBe(false);
      expect(result.error).toContain('Missing required columns');
      expect(result.error).toContain('macAddress');
    });

    it('should fail when both required columns are missing', () => {
      // Arrange
      const csv = `name,description
Router-01,Main router`;

      // Act
      const result = parser.parse(csv);

      // Assert
      expect(result.isSuccess).toBe(false);
      expect(result.error).toContain('Missing required columns');
      expect(result.error).toContain('ipAddress');
      expect(result.error).toContain('macAddress');
    });

    it('should list all required columns in error message', () => {
      // Arrange
      const csv = `name,description
Router-01,Main router`;

      // Act
      const result = parser.parse(csv);

      // Assert
      expect(result.isSuccess).toBe(false);
      expect(result.error).toContain(
        'Required: ipAddress, macAddress'
      );
    });
  });

  // ========================================
  // Unknown Column Detection Tests
  // ========================================

  describe('Unknown Column Detection', () => {
    it('should fail when unknown columns are present', () => {
      // Arrange
      const csv = `ipAddress,macAddress,unknownColumn
192.168.1.100,AA:BB:CC:DD:EE:FF,someValue`;

      // Act
      const result = parser.parse(csv);

      // Assert
      expect(result.isSuccess).toBe(false);
      expect(result.error).toContain('Unknown columns');
      expect(result.error).toContain('unknownColumn');
    });

    it('should list all supported columns in error message', () => {
      // Arrange
      const csv = `ipAddress,macAddress,invalidCol1,invalidCol2
192.168.1.100,AA:BB:CC:DD:EE:FF,val1,val2`;

      // Act
      const result = parser.parse(csv);

      // Assert
      expect(result.isSuccess).toBe(false);
      expect(result.error).toContain('Supported:');
      expect(result.error).toContain('ipAddress');
      expect(result.error).toContain('macAddress');
      expect(result.error).toContain('name');
      expect(result.error).toContain('deviceType');
    });

    it('should accept all supported columns', () => {
      // Arrange
      const csv = `ipAddress,macAddress,name,deviceType,description,location,connectivityType,managementProtocol,managementPort,enabledRemoteAccess,deviceId
192.168.1.100,AA:BB:CC:DD:EE:FF,Router-01,ROUTER,Main router,Building A,ETHERNET,SNMP,161,false,device-001`;

      // Act
      const result = parser.parse(csv);

      // Assert
      expect(result.isSuccess).toBe(true);
      expect(result.value).toBeDefined();
    });
  });

  // ========================================
  // Empty File Handling Tests
  // ========================================

  describe('Empty File Handling', () => {
    it('should fail when CSV is completely empty', () => {
      // Arrange
      const csv = '';

      // Act
      const result = parser.parse(csv);

      // Assert
      expect(result.isSuccess).toBe(false);
      expect(result.error).toBe('CSV file is empty');
    });

    it('should fail when CSV contains only whitespace', () => {
      // Arrange
      const csv = '   \n  \n  ';

      // Act
      const result = parser.parse(csv);

      // Assert
      expect(result.isSuccess).toBe(false);
      expect(result.error).toBe('CSV file is empty');
    });

    it('should fail when CSV contains only header row', () => {
      // Arrange
      const csv = 'ipAddress,macAddress';

      // Act
      const result = parser.parse(csv);

      // Assert
      expect(result.isSuccess).toBe(false);
      expect(result.error).toBe(
        'CSV file contains only header row, no data rows'
      );
    });

    it('should fail when all data rows are empty', () => {
      // Arrange
      const csv = `ipAddress,macAddress


      `;

      // Act
      const result = parser.parse(csv);

      // Assert
      expect(result.isSuccess).toBe(false);
      expect(result.error).toBe('No valid data rows found in CSV');
    });
  });

  // ========================================
  // File Size Limit Tests
  // ========================================

  describe('File Size Limit', () => {
    it('should accept file under 10MB', () => {
      // Arrange
      const csv = createValidCSV();

      // Act
      const result = parser.parse(csv);

      // Assert
      expect(result.isSuccess).toBe(true);
    });

    it('should fail when file exceeds 10MB', () => {
      // Arrange
      // Create a CSV larger than 10MB
      const header = 'ipAddress,macAddress\n';
      const row = '192.168.1.100,AA:BB:CC:DD:EE:FF\n';
      const rowCount = Math.ceil((10 * 1024 * 1024 + 1) / row.length);
      const csv = header + row.repeat(rowCount);

      // Act
      const result = parser.parse(csv);

      // Assert
      expect(result.isSuccess).toBe(false);
      expect(result.error).toContain('exceeds maximum 10MB');
      expect(result.error).toContain('split into smaller files');
    });

    it('should include file size in error message', () => {
      // Arrange
      const header = 'ipAddress,macAddress\n';
      const row = '192.168.1.100,AA:BB:CC:DD:EE:FF\n';
      const rowCount = Math.ceil((11 * 1024 * 1024) / row.length);
      const csv = header + row.repeat(rowCount);

      // Act
      const result = parser.parse(csv);

      // Assert
      expect(result.isSuccess).toBe(false);
      expect(result.error).toMatch(/File size \d+\.\d{2}MB/);
    });
  });

  // ========================================
  // Template Generation Tests
  // ========================================

  describe('Template Generation', () => {
    it('should generate valid CSV template', () => {
      // Act
      const template = parser.generateTemplate();

      // Assert
      expect(template).toBeDefined();
      expect(typeof template).toBe('string');
      expect(template.length).toBeGreaterThan(0);
    });

    it('should include all supported columns in header', () => {
      // Act
      const template = parser.generateTemplate();

      // Assert
      expect(template).toContain('ipAddress');
      expect(template).toContain('macAddress');
      expect(template).toContain('name');
      expect(template).toContain('deviceType');
      expect(template).toContain('description');
      expect(template).toContain('location');
      expect(template).toContain('connectivityType');
      expect(template).toContain('managementProtocol');
      expect(template).toContain('managementPort');
      expect(template).toContain('enabledRemoteAccess');
      expect(template).toContain('deviceId');
    });

    it('should include example data rows', () => {
      // Act
      const template = parser.generateTemplate();

      // Assert
      const lines = template.split('\n');
      expect(lines.length).toBeGreaterThanOrEqual(3); // Header + at least 2 examples
      expect(lines[1]).toContain('192.168.1.100');
      expect(lines[2]).toContain('192.168.1.101');
    });

    it('should generate parseable CSV', () => {
      // Act
      const template = parser.generateTemplate();
      const result = parser.parse(template);

      // Assert
      expect(result.isSuccess).toBe(true);
      expect(result.value!.length).toBe(2);
    });

    it('should include realistic example data', () => {
      // Act
      const template = parser.generateTemplate();

      // Assert
      expect(template).toContain('Router-Core-01');
      expect(template).toContain('Switch-Access-01');
      expect(template).toContain('AA:BB:CC:DD:EE:FF');
      expect(template).toContain('ROUTER');
      expect(template).toContain('SWITCH');
    });
  });

  // ========================================
  // Edge Cases Tests
  // ========================================

  describe('Edge Cases', () => {
    it('should handle single data row', () => {
      // Arrange
      const csv = `ipAddress,macAddress
192.168.1.100,AA:BB:CC:DD:EE:FF`;

      // Act
      const result = parser.parse(csv);

      // Assert
      expect(result.isSuccess).toBe(true);
      expect(result.value!.length).toBe(1);
    });

    it('should handle very long field values', () => {
      // Arrange
      const longDescription = 'A'.repeat(1000);
      const csv = `ipAddress,macAddress,description
192.168.1.100,AA:BB:CC:DD:EE:FF,${longDescription}`;

      // Act
      const result = parser.parse(csv);

      // Assert
      expect(result.isSuccess).toBe(true);
      expect(result.value![0].description).toBe(longDescription);
    });

    it('should handle empty optional fields', () => {
      // Arrange
      const csv = `ipAddress,macAddress,name,description
192.168.1.100,AA:BB:CC:DD:EE:FF,,`;

      // Act
      const result = parser.parse(csv);

      // Assert
      expect(result.isSuccess).toBe(true);
      expect(result.value![0].name).toBeUndefined();
      expect(result.value![0].description).toBeUndefined();
    });

    it('should handle missing trailing cells', () => {
      // Arrange
      const csv = `ipAddress,macAddress,name,deviceType
192.168.1.100,AA:BB:CC:DD:EE:FF`;

      // Act
      const result = parser.parse(csv);

      // Assert
      expect(result.isSuccess).toBe(true);
      expect(result.value![0].ipAddress).toBe('192.168.1.100');
      expect(result.value![0].macAddress).toBe('AA:BB:CC:DD:EE:FF');
      expect(result.value![0].name).toBeUndefined();
      expect(result.value![0].deviceType).toBeUndefined();
    });

    it('should handle Windows line endings (CRLF)', () => {
      // Arrange
      const csv =
        'ipAddress,macAddress\r\n192.168.1.100,AA:BB:CC:DD:EE:FF\r\n192.168.1.101,AA:BB:CC:DD:EE:FE';

      // Act
      const result = parser.parse(csv);

      // Assert
      expect(result.isSuccess).toBe(true);
      expect(result.value!.length).toBe(2);
    });

    it('should handle special characters in field values', () => {
      // Arrange
      const csv = `ipAddress,macAddress,description
192.168.1.100,AA:BB:CC:DD:EE:FF,Router (core) - primary [active]`;

      // Act
      const result = parser.parse(csv);

      // Assert
      expect(result.isSuccess).toBe(true);
      expect(result.value![0].description).toBe(
        'Router (core) - primary [active]'
      );
    });
  });

  // ========================================
  // Standalone Function Tests
  // ========================================

  describe('Standalone Functions', () => {
    it('parseDeviceCSV should work correctly', () => {
      // Arrange
      const csv = createValidCSV();

      // Act
      const result = parseDeviceCSV(csv);

      // Assert
      expect(result.isSuccess).toBe(true);
      expect(result.value).toBeDefined();
      expect(result.value!.length).toBe(2);
    });

    it('parseDeviceCSV should handle errors', () => {
      // Arrange
      const csv = 'invalidColumn\ndata';

      // Act
      const result = parseDeviceCSV(csv);

      // Assert
      expect(result.isSuccess).toBe(false);
      expect(result.error).toBeDefined();
    });

    it('generateDeviceCSVTemplate should work correctly', () => {
      // Act
      const template = generateDeviceCSVTemplate();

      // Assert
      expect(template).toBeDefined();
      expect(typeof template).toBe('string');
      expect(template).toContain('ipAddress');
      expect(template).toContain('macAddress');
    });

    it('generateDeviceCSVTemplate should produce parseable CSV', () => {
      // Act
      const template = generateDeviceCSVTemplate();
      const result = parseDeviceCSV(template);

      // Assert
      expect(result.isSuccess).toBe(true);
      expect(result.value!.length).toBe(2);
    });
  });

  // ========================================
  // Integration Tests
  // ========================================

  describe('Integration Tests', () => {
    it('should parse generated template successfully', () => {
      // Arrange
      const template = parser.generateTemplate();

      // Act
      const result = parser.parse(template);

      // Assert
      expect(result.isSuccess).toBe(true);
      expect(result.value).toBeDefined();
      expect(result.value!.length).toBeGreaterThanOrEqual(2);
    });

    it('should handle real-world CSV with mixed data', () => {
      // Arrange
      const csv = `ipAddress,macAddress,name,deviceType,description,location
192.168.1.1,AA:BB:CC:DD:EE:01,Router-Core-01,ROUTER,"Core router, primary",Building A
192.168.1.2,AA:BB:CC:DD:EE:02,Switch-01,SWITCH,,
192.168.1.3,AA:BB:CC:DD:EE:03,AP-Floor-1,ACCESS_POINT,Wireless AP,Building B Floor 1
192.168.1.4,AA:BB:CC:DD:EE:04,,UNKNOWN,,`;

      // Act
      const result = parser.parse(csv);

      // Assert
      expect(result.isSuccess).toBe(true);
      expect(result.value!.length).toBe(4);
      expect(result.value![0].description).toBe(
        'Core router, primary'
      );
      expect(result.value![1].description).toBeUndefined();
      expect(result.value![3].name).toBeUndefined();
    });
  });
});
