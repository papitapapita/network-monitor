import { CollectionAccountLineItemRequestDTO } from './CollectionAccountLineItemDTO';

export interface CreateCollectionAccountRequestDTO {
  customerId?: string;
  customerName?: string;
  customerDocument?: string;
  customerPhone?: string;
  customerEmail?: string;
  customerAddress?: string;
  issueDate?: string;
  dueDate?: string;
  notes?: string;
  lineItems: CollectionAccountLineItemRequestDTO[];
  // Omitted: every registered bank account is listed. [] lists none.
  bankAccountIds?: string[];
  createdBy?: string;
}
