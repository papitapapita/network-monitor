import { Result } from 'domain/shared/core';

// Write port into the customers context: billing suspends a service whose
// bill went unpaid (BIL-310) and brings it back once paid (BIL-311). Status
// changes there drive enforcement and the customer's notice. Each call
// reports whether the status changed: a service not in the starting state,
// or gone, is left alone.
export interface ICustomerServiceAccess {
  suspendService(
    contractedServiceId: string
  ): Promise<Result<boolean>>;
  restoreService(
    contractedServiceId: string
  ): Promise<Result<boolean>>;
}
