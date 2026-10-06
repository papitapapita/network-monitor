export interface GenerateBillRequestDTO {
  customerId: string;
  year: number;
  month: number;
  issueDate?: string;
  dueDate?: string;
  // Set only by the automatic run, which prorates (BIL-287..289). Without
  // it every active service is charged the whole month.
  proration?: {
    billingMode: string;
    // YYYY-MM-DD: last month's issue day for this customer.
    previousIssueDay: string;
  };
}
