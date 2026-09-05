export interface QuotationLineItemRequestDTO {
  deviceModelId: string;
  description?: string;
  unitPrice: number;
  quantity: number;
}

export interface QuotationLineItemDTO {
  deviceModelId: string | null;
  deviceModelName: string;
  vendorName: string;
  deviceType: string;
  imageUrl: string | null;
  description: string;
  unitPrice: number;
  quantity: number;
  lineTotal: number;
}
