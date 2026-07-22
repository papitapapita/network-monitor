export interface GenerateBillRequestDTO {
  customerId: string;
  year: number;
  month: number;
  issueDate?: string;
  dueDate?: string;
}
