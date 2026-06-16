export interface ContractedServiceResponseDTO {
  id: string;
  customerId: string;
  servicePlanId: string;
  deviceId: string | null;
  status: string;
  startDate: string;
  createdAt: string;
  updatedAt: string;
}
