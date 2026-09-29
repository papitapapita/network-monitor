export interface SubscriptionStatusDTO {
  // NOT_ENFORCED: the install is not billed by subscription (no terms set).
  state: 'NOT_ENFORCED' | 'ACTIVE' | 'GRACE' | 'READ_ONLY' | 'LOCKED';
  // First instant not paid for, end of grace, and when the dashboard locks.
  paidThrough: string | null;
  graceEndsAt: string | null;
  lockedAt: string | null;
  // READ_ONLY or LOCKED: agents refused, monitoring and alerts stopped,
  // writes refused. LOCKED also refuses reads.
  readOnly: boolean;
  locked: boolean;
}
