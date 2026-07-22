import { Result } from 'domain/shared/core';

export interface BillPdfLineItem {
  planName: string;
  monthlyPrice: number;
}

export interface BillPdfRenderModel {
  billId: string;
  period: string;
  status: string;
  issueDate: Date;
  dueDate: Date;
  paidAt: Date | null;
  total: number;
  lineItems: BillPdfLineItem[];
  customer: {
    fullName: string;
    phone: string;
    email: string | null;
    cedula: string | null;
  };
}

export interface IBillPdfRenderer {
  render(model: BillPdfRenderModel): Promise<Result<Buffer>>;
}
