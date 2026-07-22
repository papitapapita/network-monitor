import { BillResponseDTO } from './BillResponseDTO';

export interface BulkGenerateBillsResponseDTO {
  period: string;
  generated: BillResponseDTO[];
  skipped: { customerId: string; reason: string }[];
  failed: { customerId: string; error: string }[];
}
