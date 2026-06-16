export interface CreateContractedServiceRequestDTO {
  customerId: string;
  servicePlanId: string;
  deviceId?: string | null;
  startDate?: string;
}
