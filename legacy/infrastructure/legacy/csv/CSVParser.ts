import { CSVDeviceRow } from '../../application/device-inventory/use-cases/BulkImportNetworkDevicesUseCase';

/**
 * CSVParser
 *
 * REQ-002 (FR-002.7): Utility for parsing CSV files containing network device data.
 *
 * Features:
 * - Parses CSV with header row
 * - Validates CSV structure (required columns present)
 * - Handles quoted fields, escaped characters
 * - Trims whitespace from field values
 * - Validates file size (<10MB)
 * - Prevents CSV injection attacks
 *
 * Required Columns:
 * - ipAddress
 * - macAddress
 *
 * Optional Columns:
 * - name, deviceType, description, location, connectivityType,
 *   managementProtocol, managementPort, enabledRemoteAccess, deviceId
 *
 * CSV Injection Prevention:
 * - Strips leading =, +, -, @ from all cell values
 * - These characters can trigger formula execution in Excel/Google Sheets
 *
 * Usage:
 * ```typescript
 * const parser = new CSVParser();
 * const result = parser.parse(csvContent);
 *
 * if (result.isSuccess) {
 *   const devices = result.value;
 *   // Pass to BulkImportNetworkDevicesUseCase
 * } else {
 *   console.error(result.error);
 * }
 * ```
 */

/**
 * CSV parsing result.
 */
export interface CSVParseResult {
  isSuccess: boolean;
  value?: CSVDeviceRow[];
  error?: string;
}

export class CSVParser {
  // REQ-002: Maximum file size 10MB (~10,000 devices)
  private readonly MAX_FILE_SIZE = 10 * 1024 * 1024; // 10MB

  // Required CSV columns
  private readonly REQUIRED_COLUMNS = ['ipAddress', 'macAddress'];

  // All supported columns
  private readonly SUPPORTED_COLUMNS = [
    'ipAddress',
    'macAddress',
    'name',
    'deviceType',
    'description',
    'location',
    'connectivityType',
    'managementProtocol',
    'managementPort',
    'enabledRemoteAccess',
    'deviceId'
  ];

  /**
   * Parses CSV content to array of device rows.
   *
   * @param csvContent - Raw CSV file content as string
   * @returns Parse result with devices or error message
   */
  public parse(csvContent: string): CSVParseResult {
    // Validate file size
    const sizeInBytes = new Blob([csvContent]).size;
    if (sizeInBytes > this.MAX_FILE_SIZE) {
      return {
        isSuccess: false,
        error: `File size ${(sizeInBytes / (1024 * 1024)).toFixed(2)}MB exceeds maximum ${this.MAX_FILE_SIZE / (1024 * 1024)}MB. Please split into smaller files.`
      };
    }

    // Parse CSV lines
    const lines = this.parseCSVLines(csvContent);

    if (lines.length === 0) {
      return {
        isSuccess: false,
        error: 'CSV file is empty'
      };
    }

    if (lines.length === 1) {
      return {
        isSuccess: false,
        error: 'CSV file contains only header row, no data rows'
      };
    }

    // Extract header row
    const headerRow = lines[0];
    const headers = headerRow.map((h) => h.trim());

    // Validate required columns present
    const missingColumns = this.REQUIRED_COLUMNS.filter(
      (col) => !headers.includes(col)
    );
    if (missingColumns.length > 0) {
      return {
        isSuccess: false,
        error: `Missing required columns: ${missingColumns.join(', ')}. Required: ${this.REQUIRED_COLUMNS.join(', ')}`
      };
    }

    // Validate no unknown columns
    const unknownColumns = headers.filter(
      (h) => !this.SUPPORTED_COLUMNS.includes(h) && h !== ''
    );
    if (unknownColumns.length > 0) {
      return {
        isSuccess: false,
        error: `Unknown columns: ${unknownColumns.join(', ')}. Supported: ${this.SUPPORTED_COLUMNS.join(', ')}`
      };
    }

    // Parse data rows
    const devices: CSVDeviceRow[] = [];

    for (let i = 1; i < lines.length; i++) {
      const row = lines[i];

      // Skip empty rows
      if (row.every((cell) => cell.trim() === '')) {
        continue;
      }

      const device: any = {};

      for (let j = 0; j < headers.length; j++) {
        const header = headers[j];
        const value = row[j] || '';

        // CSV injection prevention: strip leading dangerous characters
        const sanitizedValue = this.sanitizeValue(value.trim());

        if (sanitizedValue !== '') {
          device[header] = sanitizedValue;
        }
      }

      devices.push(device as CSVDeviceRow);
    }

    if (devices.length === 0) {
      return {
        isSuccess: false,
        error: 'No valid data rows found in CSV'
      };
    }

    return {
      isSuccess: true,
      value: devices
    };
  }

  /**
   * Parses CSV content into 2D array of cells.
   * Handles quoted fields and escaped quotes.
   *
   * @private
   */
  private parseCSVLines(csvContent: string): string[][] {
    const lines: string[][] = [];
    const rows = csvContent.split('\n');

    for (let row of rows) {
      row = row.trim();
      if (row === '') continue;

      const cells: string[] = [];
      let currentCell = '';
      let insideQuotes = false;

      for (let i = 0; i < row.length; i++) {
        const char = row[i];
        const nextChar = row[i + 1];

        if (char === '"') {
          if (insideQuotes && nextChar === '"') {
            // Escaped quote
            currentCell += '"';
            i++; // Skip next quote
          } else {
            // Toggle quote state
            insideQuotes = !insideQuotes;
          }
        } else if (char === ',' && !insideQuotes) {
          // End of cell
          cells.push(currentCell);
          currentCell = '';
        } else {
          currentCell += char;
        }
      }

      // Add last cell
      cells.push(currentCell);
      lines.push(cells);
    }

    return lines;
  }

  /**
   * Sanitizes cell value to prevent CSV injection attacks.
   *
   * Strips leading =, +, -, @ characters which can trigger
   * formula execution in Excel/Google Sheets.
   *
   * @private
   */
  private sanitizeValue(value: string): string {
    if (value.length === 0) return value;

    // Strip leading dangerous characters
    const dangerousChars = ['=', '+', '-', '@'];
    let sanitized = value;

    while (
      sanitized.length > 0 &&
      dangerousChars.includes(sanitized[0])
    ) {
      sanitized = sanitized.substring(1);
    }

    return sanitized;
  }

  /**
   * Generates a CSV template with example data.
   * Useful for providing users with a correctly formatted template.
   *
   * @returns CSV template as string
   */
  public generateTemplate(): string {
    const header = this.SUPPORTED_COLUMNS.join(',');
    const example1 =
      '192.168.1.100,AA:BB:CC:DD:EE:FF,Router-Core-01,ROUTER,Main core router,Building A Floor 2,ETHERNET,SNMP,161,false,device-001';
    const example2 =
      '192.168.1.101,AA:BB:CC:DD:EE:FE,Switch-Access-01,SWITCH,Access switch,Building A Floor 1,FIBER_OPTIC,SSH,22,true,device-002';

    return `${header}\n${example1}\n${example2}\n`;
  }
}

/**
 * Standalone function for parsing CSV files.
 * Convenience wrapper around CSVParser class.
 *
 * @param csvContent - Raw CSV file content
 * @returns Parse result
 */
export function parseDeviceCSV(csvContent: string): CSVParseResult {
  const parser = new CSVParser();
  return parser.parse(csvContent);
}

/**
 * Standalone function for generating CSV template.
 *
 * @returns CSV template as string
 */
export function generateDeviceCSVTemplate(): string {
  const parser = new CSVParser();
  return parser.generateTemplate();
}
