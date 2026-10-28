import { Result } from 'domain/shared/core';

// Read-only view of the down alerts the notifications context keeps
// (MON-171).
export interface IReportedOutageQuery {
  // Whether the operator was told the device was down at some point between
  // `from` and `to`, by its own down notice or one it was rolled into.
  wasReportedDown(
    deviceId: string,
    from: Date,
    to: Date
  ): Promise<Result<boolean>>;
}
