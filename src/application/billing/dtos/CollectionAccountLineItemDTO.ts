export interface CollectionAccountLineItemRequestDTO {
  description: string;
  unitPrice: number;
  quantity: number;
}

export interface CollectionAccountLineItemDTO {
  description: string;
  unitPrice: number;
  quantity: number;
  lineTotal: number;
}
