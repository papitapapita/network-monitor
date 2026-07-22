export interface ListBillsQueryDTO {
  customerId?: string;
  status?: string;
  year?: number;
  month?: number;
  limit?: number;
  offset?: number;
}
