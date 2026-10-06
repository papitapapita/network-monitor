import { Result } from 'domain/shared/core';
import { BillId } from 'domain/shared/ids';

// Which bills were reminded on which Colombian day (BIL-323). `day` is a
// calendar date held as UTC midnight.
export interface IBillReminderLog {
  wasSentOn(billId: BillId, day: Date): Promise<Result<boolean>>;
  record(billId: BillId, day: Date): Promise<Result<void>>;
}
