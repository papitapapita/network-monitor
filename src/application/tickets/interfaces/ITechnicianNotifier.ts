import { Result } from 'domain/shared/core';

export interface TechnicianAssignmentNotice {
  phone: string;
  technicianName: string;
  ticketCode: string;
  ticketTitle: string;
  scheduledFor: string | null;
}

/**
 * Outbound port for telling a technician they have been given a job.
 *
 * Declared locally rather than reusing ICustomerNotificationService, whose
 * `to: PhoneNumber` is a customers-context value object the tickets context
 * must not import. The infrastructure adapter bridges the two.
 */
export interface ITechnicianNotifier {
  notifyAssignment(
    notice: TechnicianAssignmentNotice
  ): Promise<Result<void>>;
}
