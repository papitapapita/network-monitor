export interface CreateContractedServiceRequestDTO {
  customerId: string;
  servicePlanId: string;
  deviceId?: string | null;
  startDate?: string;
  // 15 or 30; omitted means 30 (CUS-025).
  paymentDay?: number;
}
