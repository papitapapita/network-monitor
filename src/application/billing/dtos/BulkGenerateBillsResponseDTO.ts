import { BillResponseDTO } from './BillResponseDTO';

export interface BulkGenerateBillsResponseDTO {
  period: string;
  generated: BillResponseDTO[];
  skipped: { contractedServiceId: string; reason: string }[];
  failed: { contractedServiceId: string; error: string }[];
}
