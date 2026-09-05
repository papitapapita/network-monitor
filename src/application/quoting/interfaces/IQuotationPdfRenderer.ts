import { Result } from 'domain/shared/core';

export interface QuotationPdfLineItem {
  imageBuffer: Buffer | null;
  description: string;
  vendorName: string;
  quantity: number;
  unitPrice: number;
  lineTotal: number;
}

export interface QuotationPdfRenderModel {
  quoteNumber: string;
  status: string;
  issueDate: Date;
  validUntil: Date;
  notes: string | null;
  customer: {
    name: string;
    phone: string | null;
    email: string | null;
    address: string | null;
  };
  lineItems: QuotationPdfLineItem[];
  subtotal: number;
  total: number;
}

export interface IQuotationPdfRenderer {
  render(model: QuotationPdfRenderModel): Promise<Result<Buffer>>;
}
