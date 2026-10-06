import { Result } from 'domain/shared/core';

export interface BillingContact {
  fullName: string;
  phone: string;
  email: string | null;
}

// Read-only view of the customers context: how to reach a customer about
// their bills (BIL-320, BIL-321).
export interface IBillingContactsQuery {
  findContact(
    customerId: string
  ): Promise<Result<BillingContact | null>>;
}
