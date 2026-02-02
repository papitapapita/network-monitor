/**
 * Validation error for a specific row and field.
 */
export interface CSVValidationError {
  row: number; // 1-indexed (excluding header)
  field: string;
  value: string | undefined;
  error: string;
}
