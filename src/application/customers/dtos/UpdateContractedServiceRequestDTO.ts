export interface UpdateContractedServiceRequestDTO {
  id: string;
  servicePlanId?: string;
  // string assigns a device; null releases the current device
  deviceId?: string | null;
  // target lifecycle state: ACTIVE | SUSPENDED | CANCELLED
  status?: string;
}
