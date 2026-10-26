import { Result } from 'domain/shared/core';

export interface BillableService {
  contractedServiceId: string;
  customerId: string;
  paymentDay: number;
  // ISO instant.
  startDate: string;
}

// Read-only view of the customers context: every ACTIVE subscription, with
// the day its bill falls due (CUS-024).
export interface IBillableServicesQuery {
  listBillable(): Promise<Result<BillableService[]>>;
}
