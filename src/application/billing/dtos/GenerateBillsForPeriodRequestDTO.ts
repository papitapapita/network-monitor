export interface GenerateBillsForPeriodRequestDTO {
  year: number;
  month: number;
  issueDate?: string;
  dueDate?: string;
}
