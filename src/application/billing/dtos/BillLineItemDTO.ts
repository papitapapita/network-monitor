export interface BillLineItemDTO {
  contractedServiceId: string;
  servicePlanId: string;
  planName: string;
  monthlyPrice: number;
  amount: number;
  // YYYY-MM-DD, both included; null on lines issued before these were kept.
  serviceFrom: string | null;
  serviceTo: string | null;
}
