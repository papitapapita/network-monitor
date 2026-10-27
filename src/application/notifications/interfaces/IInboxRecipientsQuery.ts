import { Result } from 'domain/shared/core';

// Identity's accounts, read to address inbox notifications (NOT-266).
export interface IInboxRecipientsQuery {
  // Ids of every account that is not disabled; with `adminsOnly`, only the
  // ones that administer the install (ADMIN, VENDOR).
  findActiveUserIds(adminsOnly: boolean): Promise<Result<string[]>>;
}
