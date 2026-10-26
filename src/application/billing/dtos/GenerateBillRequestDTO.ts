export interface GenerateBillRequestDTO {
  contractedServiceId: string;
  year: number;
  month: number;
  issueDate?: string;
  dueDate?: string;
  // Set only by the automatic run, which prorates (BIL-287..289). Without
  // it the service is charged the whole month.
  proration?: {
    billingMode: string;
    // YYYY-MM-DD: last month's issue day for this service.
    previousIssueDay: string;
  };
}
