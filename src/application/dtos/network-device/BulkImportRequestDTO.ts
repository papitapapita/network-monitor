import { CSVDeviceRow } from '../../';

/**
 * Bulk import request DTO.
 */
export interface BulkImportRequestDTO {
  csvData: CSVDeviceRow[];
  activateImmediately?: boolean; // Default: false (DRAFT mode)
}
