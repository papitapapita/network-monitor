import { Result } from 'domain/shared/core';

export interface ServiceAccessOutcome {
  // Services whose status changed.
  changed: number;
  failed: { id: string; error: string }[];
}

// Write port into the customers context: billing suspends an unpaid
// customer's services (BIL-310) and brings them back once paid (BIL-311).
// Status changes there drive enforcement and the customer's notice.
export interface ICustomerServiceAccess {
  suspendActiveServices(
    customerId: string
  ): Promise<Result<ServiceAccessOutcome>>;
  restoreSuspendedServices(
    customerId: string
  ): Promise<Result<ServiceAccessOutcome>>;
}
