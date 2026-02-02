import { CSVValidationError } from '../../';

/**
 * Bulk import response DTO.
 */
export interface BulkImportResponseDTO {
  success: boolean;
  created: number;
  failed: number;
  deviceIds: string[];
  validationErrors?: CSVValidationError[];
  duration: number; // milliseconds
}
