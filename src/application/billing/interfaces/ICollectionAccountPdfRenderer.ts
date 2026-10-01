import { Result } from 'domain/shared/core';

export interface CollectionAccountPdfLineItem {
  description: string;
  quantity: number;
  unitPrice: number;
  lineTotal: number;
}

export interface CollectionAccountPdfPaymentAccount {
  bankName: string;
  accountType: string;
  accountNumber: string;
}

export interface CollectionAccountPdfRenderModel {
  number: string;
  status: string;
  issueDate: Date;
  dueDate: Date | null;
  notes: string | null;
  customer: {
    name: string;
    document: string | null;
    phone: string | null;
    email: string | null;
    address: string | null;
  };
  lineItems: CollectionAccountPdfLineItem[];
  paymentAccounts: CollectionAccountPdfPaymentAccount[];
  total: number;
}

// No issuer saved or in env yet (BIL-232). "Cannot" maps it to 409: the
// document exists, the install is not ready to print it.
export const ISSUER_NOT_CONFIGURED =
  'Cannot print the cuenta de cobro: the issuer is not configured';

export interface ICollectionAccountPdfRenderer {
  render(
    model: CollectionAccountPdfRenderModel
  ): Promise<Result<Buffer>>;
}
