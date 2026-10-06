import { Result } from 'domain/shared/core';

export interface BillableCustomer {
  customerId: string;
  paymentDay: number;
}

// Read-only view of the customers context: every customer holding at least
// one ACTIVE subscription, with the day their bill falls due (CUS-024).
export interface IBillableCustomersQuery {
  listBillable(): Promise<Result<BillableCustomer[]>>;
}
